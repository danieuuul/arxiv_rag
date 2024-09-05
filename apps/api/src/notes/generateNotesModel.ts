import { ChatOpenAI } from '@langchain/openai'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { BaseMessageChunk } from '@langchain/core/messages'
import { Runnable } from '@langchain/core/runnables'
import { ArxivPaperNote } from '../domain/ArxivePaperNote'

const GENERATE_NOTES_TOOL_SCHEMA = {
  type: 'function' as const,
  function: {
    name: 'formatNotes',
    description: 'Format the notes response',
    parameters: {
      title: 'formatNotesSchema',
      type: 'object',
      properties: {
        notes: {
          title: 'notes',
          type: 'array',
          items: {
            title: 'note',
            type: 'object',
            properties: {
              note: {
                type: 'string',
                description: 'The notes'
              },
              pageNumbers: {
                title: 'pageNumber',
                type: 'array',
                items: {
                  type: 'number',
                  description: 'The page number(s) of the note'
                }
              }
            }
          }
        }
      },
      required: ['notes']
    }
  }
}

const outputParser = (output: BaseMessageChunk): Array<ArxivPaperNote> => {
  const toolCalls = output.additional_kwargs.tool_calls
  if (!toolCalls) {
    throw new Error("Missing 'tool_calls' in notes output")
  }
  const notes = toolCalls
    .map((call) => {
      const { notes } = JSON.parse(call.function.arguments)
      return notes
    })
    .flat()
  return notes
}

const NOTE_PROMPT = ChatPromptTemplate.fromMessages([
  [
    'ai',
    `Take notes the following scientific paper.
This is a technical paper outlining a computer science technique.
The goal is to be able to create a complete understanding of the paper after reading all notes.

Rules:
- Include specific quotes and details inside your notes.
- Respond with as many notes as it might take to cover the entire paper.
- Go into as much detail as you can, while keeping each note on a very specific part of the paper.
- Include notes about the results of any experiments the paper describes.
- Include notes about any steps to reproduce the results of the experiments.
- DO NOT respond with notes like: "The author discusses how well XYZ works.", instead explain what XYZ is and how it works.

Respond with a JSON array with two keys: "note" and "pageNumbers".
"note" will be the specific note, and pageNumbers will be an array of numbers (if the note spans more than one page).
Take a deep breath, and work your way through the paper step by step.`
  ],
  ['human', 'Paper: {paper}']
])

export async function generateNotesModel(): Promise<
  Runnable<{ paper: string }, ArxivPaperNote[]>
> {
  const model = new ChatOpenAI({
    modelName: 'gpt-4-1106-preview',
    temperature: 0.0
  })
  const modelWithTools = model.bind({
    tools: [GENERATE_NOTES_TOOL_SCHEMA]
  })
  const chain = NOTE_PROMPT.pipe(modelWithTools).pipe(outputParser)
  return chain
}
