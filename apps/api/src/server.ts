import { z } from 'zod'

import express from 'express'

import { qaOnPaper } from './qa/qaOnPaper'
import { generateNotesFromPaper } from './notes/generateNotesFromPaper'

const takeNotesBodySchema = z.object({
  paperUrl: z
    .string({
      required_error: 'Paper url is required'
    })
    .trim()
    .min(1, 'Paper url be empty'),
  name: z
    .string({
      required_error: 'Name is required'
    })
    .trim()
    .min(1, 'Name cannot be empty'),
  pagesToDelete: z.string().optional()
})

function processPagesToDelete(pagesToDelete: string): Array<number> {
  const numArr = pagesToDelete.split(',').map((num) => parseInt(num.trim()))
  return numArr
}

function main() {
  const app = express()
  const port = process.env.PORT || 8080

  app.use(express.json())

  app.get('/', (_req, res) => {
    // health check
    res.status(200).send('ok')
  })

  app.post('/take_notes', async (req, res) => {
    const { paperUrl, name, pagesToDelete } = req.body

    // convert pagesToDelete back to array numbers
    const pagesToDeleteArray = pagesToDelete
      ? processPagesToDelete(pagesToDelete)
      : undefined
    const notes = await generateNotesFromPaper(
      paperUrl,
      name,
      pagesToDeleteArray
    )
    // const notes = await generateNotesFromPaper(
    //   'https://arxiv.org/pdf/2409.02046',
    //   'human-ai'
    // )
    res.status(200).send(notes)
    return
  })

  app.post('/qa', async (req, res) => {
    const { paperUrl, question } = req.body
    const qa = await qaOnPaper(question, paperUrl)
    res.status(200).send(qa)
    return
  })

  app.listen(port, () => {
    console.log(`Listening on port ${port}`)
  })
}
main()
