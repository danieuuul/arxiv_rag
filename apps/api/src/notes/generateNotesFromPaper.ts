import { writeFile, unlink } from 'fs/promises'

import { Document } from 'langchain/document'
import { UnstructuredLoader } from '@langchain/community/document_loaders/fs/unstructured'

import axios from 'axios'
import { PDFDocument } from 'pdf-lib'
import { ArxivPaperNote } from '../domain/ArxivePaperNote'
import { formatDocumentsAsString } from 'langchain/util/document'
import { generateNotesModel } from './generateNotesModel'
import { SupabaseDatabase } from '../db/database'

async function loadPdfFromUrl(url: string): Promise<Buffer> {
  const response = await axios.get(url, {
    responseType: 'arraybuffer'
  })
  return response.data
}
async function deletePagesFromPdf(
  pdf: Buffer,
  pagesToDelete: number[]
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(pdf)

  let numToOffsetBy = 1
  for (const pageNum of pagesToDelete) {
    pdfDoc.removePage(pageNum - numToOffsetBy)
    numToOffsetBy++
  }
  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

async function convertPdfToDocuments(pdf: Buffer): Promise<Array<Document>> {
  if (!process.env.UNSTRUCTURED_API_KEY) {
    throw new Error('Missing UNSTRUCTURED_API_KEY')
  }

  const randomName = Math.random().toString(36).substring(7)
  const pdfPath = `pdfs/${randomName}.pdf`
  await writeFile(pdfPath, pdf, 'binary')

  const loader = new UnstructuredLoader(pdfPath, {
    apiKey: process.env.UNSTRUCTURED_API_KEY,
    strategy: 'hi_res'
  })
  const docs = await loader.load()
  /** Delete the temporary PDF file. */
  await unlink(pdfPath)
  return docs
}

export async function generateNotesFromPaper(
  paperUrl: string,
  name: string,
  pagesToDelete?: number[]
): Promise<ArxivPaperNote[]> {
  const database = await SupabaseDatabase.fromExistingIndex()
  const existingPaper = await database.getPaper(paperUrl)
  if (existingPaper) {
    return existingPaper.notes as Array<ArxivPaperNote>
  }

  let pdfAsBuffer = await loadPdfFromUrl(paperUrl)
  if (pagesToDelete && pagesToDelete.length > 0) {
    pdfAsBuffer = await deletePagesFromPdf(pdfAsBuffer, pagesToDelete)
  }

  const documents = await convertPdfToDocuments(pdfAsBuffer)
  const documentsAsString = formatDocumentsAsString(documents)

  const model = await generateNotesModel()
  const notes = await model.invoke({
    paper: documentsAsString
  })

  const newDocs: Array<Document> = documents.map((doc) => ({
    ...doc,
    metadata: {
      ...doc.metadata,
      url: paperUrl
    }
  }))
  await Promise.all([
    database.addPaper({
      paper: formatDocumentsAsString(newDocs),
      url: paperUrl,
      notes,
      name
    }),
    database.vectorStore.addDocuments(newDocs)
  ])
  return notes
}
