import { ChatOpenAI } from '@langchain/openai'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { BaseMessageChunk } from '@langchain/core/messages'
import { Runnable } from '@langchain/core/runnables'

const QA_OVER_PAPER_PROMPT = ChatPromptTemplate.fromMessages([
  [
    'ai',
    `You are a tenured professor of computer science helping a student with their research.
The student has a question regarding a paper they are reading.
Here are their notes on the paper:
{notes}

And here are some relevant parts of the paper relating to their question
{relevantDocuments}

Answer the student's question in the context of the paper. You should also suggest followup questions.
Take a deep breath, and think through your reply carefully, step by step.`
  ],
  ['human', 'Question: {question}']
])

const ANSWER_QUESTION_TOOL_SCHEMA = {
  type: 'function',
  function: {
    name: 'questionAnswer',
    description: 'The answer to the question',
    parameters: {
      type: 'object',
      properties: {
        answer: {
          type: 'string',
          description: 'The answer to the question'
        },
        followupQuestions: {
          type: 'array',
          items: {
            type: 'string',
            description: 'Followup questions the student should also ask'
          }
        }
      },
      required: ['answer', 'followupQuestions']
    }
  }
}

const answerOutputParser = (
  output: BaseMessageChunk
): Array<{ answer: string; followupQuestions: string[] }> => {
  const toolCalls = output.additional_kwargs.tool_calls
  if (!toolCalls) {
    throw new Error("Missing 'tool_calls' in notes output")
  }
  const response = toolCalls
    .map((call) => {
      const args = JSON.parse(call.function.arguments)
      return args
    })
    .flat()
  return response
}

export async function qaModel(): Promise<
  Runnable<
    {
      relevantDocuments: string
      notes: string
      question: string
    },
    Array<{ answer: string; followupQuestions: string[] }>
  >
> {
  const model = new ChatOpenAI({
    modelName: 'gpt-4-1106-preview',
    temperature: 0
  })
  const modelWithTools = model.bind({
    tools: [ANSWER_QUESTION_TOOL_SCHEMA],
    tool_choice: 'auto'
  })

  const chain =
    QA_OVER_PAPER_PROMPT.pipe(modelWithTools).pipe(answerOutputParser)

  return chain
}
