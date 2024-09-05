import { formatDocumentsAsString } from 'langchain/util/document'

import { qaModel } from './qaModel'
import { SupabaseDatabase } from '../db/database'
import { ArxivPaperNote } from '../domain/ArxivePaperNote'

export async function qaOnPaper(question: string, paperUrl: string) {
  const database = await SupabaseDatabase.fromExistingIndex()
  const documents = await database.vectorStore.similaritySearch(question, 8, {
    url: paperUrl
  })

  if (!documents) {
    throw new Error('No documents found')
  }

  const paper = await database.getPaper(paperUrl)
  if (!paper?.notes) {
    throw new Error('No notes found')
  }
  const { notes } = paper as unknown as { notes: Array<ArxivPaperNote> }

  const documentsAsString = formatDocumentsAsString(documents)
  const notesAsString = notes.map((note) => note.note).join('\n')

  const model = await qaModel()

  const answerAndQuestions = await model.invoke({
    relevantDocuments: documentsAsString,
    notes: notesAsString,
    question
  })

  await Promise.all(
    answerAndQuestions.map(async (qa) =>
      database.saveQa(
        question,
        qa.answer,
        formatDocumentsAsString(documents),
        qa.followupQuestions
      )
    )
  )
  return answerAndQuestions
}
