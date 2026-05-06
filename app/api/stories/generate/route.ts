import { NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { generateStoryStream, type LLMProvider } from '@/lib/llm'
import { buildCalibrationContext } from '@/lib/calibration'
import { Segment, useDefault } from 'segmentit'

export const runtime = 'nodejs'

const LANG_NAMES: Record<string, string> = {
    'zh-CN': 'Chinese (Simplified)',
    'zh-TW': 'Chinese (Traditional)',
    de: 'German',
    it: 'Italian',
    es: 'Spanish',
}

const CHAR_LENGTH_MAP: Record<string, number> = {
    short: 100,
    medium: 300,
    long: 600,
}

const WORD_LENGTH_MAP: Record<string, number> = {
    short: 60,
    medium: 200,
    long: 400,
}

interface RequestBody {
    genre?: string
    theme?: string
    setting?: string
    length?: string
    freeText?: string
}

function segmentText(content: string, language: string): string[] {
    const isChinese = language === 'zh-CN' || language === 'zh-TW'
    if (isChinese) {
        const segmentit = useDefault(new Segment())
        return segmentit.doSegment(content).map((s) => s.w)
    }
    // European: words by Unicode word characters
    return Array.from(content.matchAll(/[\p{L}\p{M}]+/gu)).map((m) => m[0])
}

export async function POST(req: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new Response('Unauthorized', { status: 401 })

    const body = (await req.json()) as RequestBody

    // Read profile (provider, language, debug_mode)
    const { data: profile } = await supabase
        .from('chinese_profiles')
        .select('debug_mode, target_language, llm_provider')
        .eq('id', user.id)
        .single()

    const targetLang = profile?.target_language || 'zh-CN'
    const provider: LLMProvider = (profile?.llm_provider as LLMProvider) || 'anthropic'
    const debugMode = !!profile?.debug_mode
    const langName = LANG_NAMES[targetLang] || targetLang
    const isChinese = targetLang === 'zh-CN' || targetLang === 'zh-TW'
    const lengthKey = body.length || 'medium'
    const targetLength = (isChinese ? CHAR_LENGTH_MAP : WORD_LENGTH_MAP)[lengthKey] ?? (isChinese ? 300 : 200)
    const lengthUnit = isChinese ? 'characters' : 'words'

    // Fetch user vocab + history (filtered by language)
    const [{ count: knownCount }, { data: learningRows }, { data: recentStories }] = await Promise.all([
        supabase
            .from('chinese_vocab_items')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('language', targetLang)
            .eq('status', 'known'),
        supabase
            .from('chinese_vocab_items')
            .select('word, status')
            .eq('user_id', user.id)
            .eq('language', targetLang)
            .neq('status', 'known')
            .limit(100),
        supabase
            .from('chinese_stories')
            .select('title, content, difficulty_rating, difficulty_level')
            .eq('user_id', user.id)
            .eq('is_read', true)
            .eq('language', targetLang)
            .order('read_at', { ascending: false })
            .limit(5),
    ])

    const learningWords = (learningRows ?? []).map((r) => r.word as string)

    // Words from recent stories that the user previously got wrong (still in non-known status)
    const unknownWordsInRecent: string[] = []
    if (recentStories && recentStories.length > 0 && learningWords.length > 0) {
        const allText = recentStories.map((s) => s.content).join(' ')
        const matcher = isChinese
            ? (w: string) => allText.includes(w)
            : (w: string) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\b`, 'iu').test(allText)
        for (const w of learningWords) {
            if (matcher(w)) unknownWordsInRecent.push(w)
        }
    }

    const calibration = buildCalibrationContext({
        targetLanguage: targetLang,
        targetLanguageName: langName,
        knownVocabCount: knownCount ?? 0,
        learningWords,
        recentStories: (recentStories ?? []) as any,
        unknownWordsInRecent,
    })

    const requestedReviewWords = unknownWordsInRecent.slice(0, 20)

    // Construct prompts
    const systemPrompt = `You are an expert language teacher writing graded reading content for a student learning ${langName}.`

    const userPromptParts: string[] = []
    if (body.freeText && body.freeText.trim()) {
        userPromptParts.push(`The student wants you to write about: ${body.freeText.trim()}`)
    } else {
        userPromptParts.push(`Write a ${body.genre || 'story'} about ${body.theme || 'something interesting'} set in ${body.setting || 'an interesting place'}.`)
    }
    userPromptParts.push(`Target length: roughly ${targetLength} ${lengthUnit}.`)
    userPromptParts.push(calibration)
    if (requestedReviewWords.length > 0) {
        userPromptParts.push(`Naturally include these review words where they fit (do not force them): ${requestedReviewWords.join(', ')}.`)
    }

    const userPrompt = userPromptParts.join('\n\n')

    // Stream
    const encoder = new TextEncoder()
    const sseStream = new ReadableStream({
        async start(controller) {
            const send = (data: unknown) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
            }
            try {
                let title = ''
                let content = ''
                let level = 1

                for await (const event of generateStoryStream({ provider, systemPrompt, userPrompt })) {
                    if (event.type === 'level') {
                        level = event.level
                        send({ type: 'level', level: event.level })
                    } else if (event.type === 'title') {
                        title = event.title
                        send({ type: 'title', title: event.title })
                    } else if (event.type === 'chunk') {
                        content += event.text
                        send({ type: 'chunk', text: event.text })
                    } else if (event.type === 'done') {
                        title = event.title || title
                        content = event.content || content
                        level = event.level || level
                    }
                }

                if (!title || !content) {
                    send({ type: 'error', message: 'Empty response from model' })
                    controller.close()
                    return
                }

                // Coverage & new-word count
                const segments = segmentText(content, targetLang).filter(
                    (s) => s.trim().length > 0 && !/^[\s.,!?;:"'()\[\]，。！？；：""''（）]+$/.test(s),
                )
                const reviewWordsLandedSet = new Set(
                    requestedReviewWords.filter((w) => segments.includes(w)),
                )
                const coverage =
                    requestedReviewWords.length > 0
                        ? reviewWordsLandedSet.size / requestedReviewWords.length
                        : null

                const knownAndLearningSet = new Set([
                    ...learningWords,
                    // We don't have the full known list cheaply; treat anything in vocab table as "seen"
                ])
                const { data: allVocab } = await supabase
                    .from('chinese_vocab_items')
                    .select('word')
                    .eq('user_id', user.id)
                    .eq('language', targetLang)
                for (const r of allVocab ?? []) knownAndLearningSet.add(r.word as string)

                const uniqueSegments = new Set(segments)
                let newCount = 0
                for (const w of uniqueSegments) {
                    if (!knownAndLearningSet.has(w)) newCount += 1
                }

                const { data: story, error } = await supabase
                    .from('chinese_stories')
                    .insert({
                        user_id: user.id,
                        title,
                        content,
                        difficulty_level: level,
                        language: targetLang,
                        review_word_coverage: coverage,
                        new_word_count: newCount,
                        debug_prompt: debugMode ? `${systemPrompt}\n\n---\n\n${userPrompt}` : null,
                    })
                    .select()
                    .single()

                if (error) {
                    send({ type: 'error', message: error.message })
                    controller.close()
                    return
                }

                send({
                    type: 'done',
                    storyId: story.id,
                    coverage,
                    newWordCount: newCount,
                })
            } catch (err) {
                send({ type: 'error', message: err instanceof Error ? err.message : String(err) })
            } finally {
                controller.close()
            }
        },
    })

    return new Response(sseStream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
        },
    })
}
