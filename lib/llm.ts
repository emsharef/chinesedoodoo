import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'

export type LLMProvider = 'anthropic' | 'openai'

const ANTHROPIC_GENERATION_MODEL = 'claude-sonnet-4-6'
const ANTHROPIC_LOOKUP_MODEL = 'claude-haiku-4-5'
const OPENAI_GENERATION_MODEL = 'gpt-5.4'
const OPENAI_LOOKUP_MODEL = 'gpt-5.4-nano'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface GenerateStoryInput {
    provider: LLMProvider
    systemPrompt: string
    userPrompt: string
}

export interface GenerateStoryResult {
    title: string
    content: string
    estimated_level: number
}

const STORY_SCHEMA = {
    type: 'object',
    properties: {
        title: { type: 'string' },
        content: { type: 'string' },
        estimated_level: { type: 'integer' },
    },
    required: ['title', 'content', 'estimated_level'],
    additionalProperties: false,
} as const

export async function generateStory(
    input: GenerateStoryInput,
): Promise<GenerateStoryResult> {
    if (input.provider === 'anthropic') {
        const response = await anthropic.messages.create({
            model: ANTHROPIC_GENERATION_MODEL,
            max_tokens: 4096,
            thinking: { type: 'adaptive' },
            output_config: {
                effort: 'medium',
                format: { type: 'json_schema', schema: STORY_SCHEMA },
            },
            system: input.systemPrompt,
            messages: [{ role: 'user', content: input.userPrompt }],
        })
        const textBlock = response.content.find((b) => b.type === 'text')
        if (!textBlock || textBlock.type !== 'text') {
            throw new Error('No text response from Claude')
        }
        return JSON.parse(textBlock.text)
    }

    const completion = await openai.chat.completions.create({
        model: OPENAI_GENERATION_MODEL,
        messages: [
            { role: 'system', content: input.systemPrompt },
            { role: 'user', content: input.userPrompt },
        ],
        response_format: { type: 'json_object' },
    })
    return JSON.parse(completion.choices[0].message.content || '{}')
}

// Streaming generation. Yields events as the model emits text. We instruct the
// model to emit a small framing prefix that lets us extract level + title
// before the body, so the client can render title + content progressively.
//
// Format the model is instructed to produce:
//   [LEVEL]N[/LEVEL][TITLE]story title[/TITLE]
//   <story body>
//
// The framing tags are unlikely to appear in natural prose and are easy to parse.

export interface GenerateStoryStreamInput {
    provider: LLMProvider
    systemPrompt: string
    userPrompt: string
}

export type StoryStreamEvent =
    | { type: 'level'; level: number }
    | { type: 'title'; title: string }
    | { type: 'chunk'; text: string }
    | { type: 'done'; title: string; content: string; level: number }

const STREAMING_FORMAT_INSTRUCTION = `

OUTPUT FORMAT — produce nothing but the following, in this exact order:
[LEVEL]<integer 1-6>[/LEVEL][TITLE]<story title in target language>[/TITLE]
<story body in target language>

Do not include any other prose, markdown, or framing. The body starts on the line after [/TITLE].`

export async function* generateStoryStream(
    input: GenerateStoryStreamInput,
): AsyncGenerator<StoryStreamEvent> {
    const system = input.systemPrompt + STREAMING_FORMAT_INSTRUCTION

    let buffer = ''
    let level: number | undefined
    let title: string | undefined
    let bodyStarted = false
    let bodyEmittedUpTo = 0

    function processBuffer(): StoryStreamEvent[] {
        const out: StoryStreamEvent[] = []

        if (level === undefined) {
            const m = buffer.match(/\[LEVEL\]\s*(\d+)\s*\[\/LEVEL\]/i)
            if (m) {
                level = parseInt(m[1], 10)
                out.push({ type: 'level', level })
            }
        }

        if (title === undefined) {
            const m = buffer.match(/\[TITLE\]([\s\S]*?)\[\/TITLE\]/i)
            if (m) {
                title = m[1].trim()
                out.push({ type: 'title', title })
            }
        }

        if (title !== undefined && !bodyStarted) {
            const closeIdx = buffer.search(/\[\/TITLE\]/i)
            if (closeIdx >= 0) {
                bodyStarted = true
                bodyEmittedUpTo = closeIdx + '[/TITLE]'.length
                // Skip a single optional leading newline after the close tag
                if (buffer[bodyEmittedUpTo] === '\n') bodyEmittedUpTo += 1
            }
        }

        if (bodyStarted && buffer.length > bodyEmittedUpTo) {
            const chunk = buffer.slice(bodyEmittedUpTo)
            bodyEmittedUpTo = buffer.length
            if (chunk) out.push({ type: 'chunk', text: chunk })
        }

        return out
    }

    if (input.provider === 'anthropic') {
        // Streaming wants the first token ASAP for responsive UX. Adaptive
        // thinking can add 5-30s of latency before any text streams, which
        // looks like a hang in the browser. Disable thinking for the stream.
        const stream = anthropic.messages.stream({
            model: ANTHROPIC_GENERATION_MODEL,
            max_tokens: 4096,
            thinking: { type: 'disabled' },
            system,
            messages: [{ role: 'user', content: input.userPrompt }],
        })

        for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                buffer += event.delta.text
                for (const out of processBuffer()) yield out
            }
        }
    } else {
        const completion = await openai.chat.completions.create({
            model: OPENAI_GENERATION_MODEL,
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: input.userPrompt },
            ],
            stream: true,
        })

        for await (const chunk of completion) {
            const text = chunk.choices[0]?.delta?.content
            if (text) {
                buffer += text
                for (const out of processBuffer()) yield out
            }
        }
    }

    // Flush any final state. The body might have content after the last yielded chunk
    // if the buffer grew but we already emitted everything (bodyEmittedUpTo === buffer.length).
    const finalTitle = title ?? 'Untitled'
    const finalContent = bodyStarted ? buffer.slice(buffer.search(/\[\/TITLE\]/i) + '[/TITLE]'.length).replace(/^\n/, '') : ''
    const finalLevel = level ?? 1
    yield { type: 'done', title: finalTitle, content: finalContent, level: finalLevel }
}

export interface LookupWordInput {
    provider: LLMProvider
    word: string
    language: string
}

export interface LookupWordResult {
    pinyin?: string
    english: string
}

const LOOKUP_SCHEMA = {
    type: 'object',
    properties: {
        pinyin: { type: 'string' },
        english: { type: 'string' },
    },
    required: ['english'],
    additionalProperties: false,
} as const

export async function lookupWord(
    input: LookupWordInput,
): Promise<LookupWordResult> {
    const isChinese = input.language === 'zh-CN' || input.language === 'zh-TW'
    const pronunciationLabel = isChinese
        ? 'pinyin with tone marks'
        : 'phonetic pronunciation (IPA or standard transcription)'
    const prompt = `Define the word "${input.word}" (Language: ${input.language}).
Output JSON: { "pinyin": "${pronunciationLabel}", "english": "concise english definition" }`

    if (input.provider === 'anthropic') {
        const response = await anthropic.messages.create({
            model: ANTHROPIC_LOOKUP_MODEL,
            max_tokens: 256,
            output_config: {
                format: { type: 'json_schema', schema: LOOKUP_SCHEMA },
            },
            messages: [{ role: 'user', content: prompt }],
        })
        const textBlock = response.content.find((b) => b.type === 'text')
        if (!textBlock || textBlock.type !== 'text') {
            throw new Error('No text response from Claude')
        }
        return JSON.parse(textBlock.text)
    }

    const completion = await openai.chat.completions.create({
        model: OPENAI_LOOKUP_MODEL,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
    })
    return JSON.parse(completion.choices[0].message.content || '{}')
}
