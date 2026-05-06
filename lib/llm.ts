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
