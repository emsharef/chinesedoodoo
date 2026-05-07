'use client'

import { useState, useEffect, useMemo } from 'react'
import { Loader2, Shuffle, Sparkles } from 'lucide-react'
import UserLevelChip from '@/components/UserLevelChip'
import StoryShell from '@/components/StoryShell'
import Reader from '@/components/Reader'
import { useHideChromeWhile } from '@/components/ChromeContext'
import { segmentText } from '@/lib/segment'
import { levelLabel } from '@/lib/levels'
import type { UserLevelSummary } from '@/lib/calibration'

const GENRES = [
    'Sci-Fi', 'Fantasy', 'Mystery', 'Romance', 'Slice of Life', 'Fable', 'Thriller', 'Comedy', 'Horror', 'Wuxia',
    'News', 'Finance', 'Politics', 'Science', 'Technology', 'History', 'Culture', 'Travel',
]
const NON_FICTION = new Set(['News', 'Finance', 'Politics', 'Science', 'Technology', 'History', 'Culture', 'Travel'])

const FICTION_THEMES = ['Friendship', 'Betrayal', 'Discovery', 'A lost item', 'A new skill', 'A misunderstanding', 'A celebration', 'A journey', 'Revenge', 'Forgiveness']
const NON_FICTION_THEMES = ['Market Trends', 'Global Events', 'New Policy', 'Scientific Breakthrough', 'Tech Innovation', 'Cultural Festival', 'Historical Event', 'Travel Guide', 'Investment Strategy', 'Political Debate']

const FICTION_SETTINGS = ['A futuristic city', 'An ancient village', 'A space station', 'A magical forest', 'A busy market', 'A quiet library', 'A high school', 'A mountain temple', 'An underwater base', 'A cyber cafe']
const NON_FICTION_SETTINGS = ['Wall Street', 'Silicon Valley', 'Beijing', 'The United Nations', 'A Research Lab', 'A Museum', 'A Tech Conference', 'The Stock Exchange', 'A University', 'A Government Building']

const LENGTH_OPTIONS = [
    { label: 'Short', value: 'short', chineseChars: 100, words: 60 },
    { label: 'Medium', value: 'medium', chineseChars: 300, words: 200 },
    { label: 'Long', value: 'long', chineseChars: 600, words: 400 },
]

const HSK_LEVELS = [1, 2, 3, 4, 5, 6]
const CEFR_LABELS = ['', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']

function levelOptions(language: string): { value: string; label: string }[] {
    const isChinese = language === 'zh-CN' || language === 'zh-TW'
    const opts = [{ value: 'auto', label: 'Auto' }]
    for (const n of HSK_LEVELS) {
        opts.push({ value: String(n), label: isChinese ? `HSK ${n}` : CEFR_LABELS[n] })
    }
    return opts
}

const STORAGE_KEY = 'chinesedoodoo:newStorySelection'

type Phase = 'form' | 'streaming'

export default function NewStoryPage() {
    const [phase, setPhase] = useState<Phase>('form')
    const [isLoading, setIsLoading] = useState(false)
    const [genre, setGenre] = useState(GENRES[0])
    const [theme, setTheme] = useState(FICTION_THEMES[0])
    const [setting, setSetting] = useState(FICTION_SETTINGS[0])
    const [length, setLength] = useState(LENGTH_OPTIONS[1].value)
    const [targetLevel, setTargetLevel] = useState<string>('auto')
    const [freeText, setFreeText] = useState('')

    // Streaming state — title arrives mid-stream, content fills incrementally
    const [streamTitle, setStreamTitle] = useState('')
    const [streamContent, setStreamContent] = useState('')
    const [streamLevel, setStreamLevel] = useState<number | null>(null)
    const [streamError, setStreamError] = useState<string | null>(null)
    const [savedStoryId, setSavedStoryId] = useState<string | null>(null)

    // Hide global chrome while streaming so the StoryShell layout matches what
    // /story/[id] will render after navigation — no chrome shift on done.
    useHideChromeWhile(phase === 'streaming')

    // User level chip
    const [levelInfo, setLevelInfo] = useState<{ summary: UserLevelSummary; targetLanguage: string } | null>(null)
    useEffect(() => {
        let cancelled = false
        ;(async () => {
            const { getUserLevel } = await import('@/app/actions/user-level')
            const info = await getUserLevel()
            if (!cancelled && info) setLevelInfo(info)
        })()
        return () => {
            cancelled = true
        }
    }, [])

    const isNonFiction = NON_FICTION.has(genre)
    const currentThemes = isNonFiction ? NON_FICTION_THEMES : FICTION_THEMES
    const currentSettings = isNonFiction ? NON_FICTION_SETTINGS : FICTION_SETTINGS

    function randomize() {
        const randomGenre = GENRES[Math.floor(Math.random() * GENRES.length)]
        setGenre(randomGenre)
        const themes = NON_FICTION.has(randomGenre) ? NON_FICTION_THEMES : FICTION_THEMES
        const settings = NON_FICTION.has(randomGenre) ? NON_FICTION_SETTINGS : FICTION_SETTINGS
        setTheme(themes[Math.floor(Math.random() * themes.length)])
        setSetting(settings[Math.floor(Math.random() * settings.length)])
        setLength(LENGTH_OPTIONS[Math.floor(Math.random() * LENGTH_OPTIONS.length)].value)
    }

    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY)
            if (saved) {
                const parsed = JSON.parse(saved)
                if (parsed.genre && GENRES.includes(parsed.genre)) setGenre(parsed.genre)
                const themes = NON_FICTION.has(parsed.genre) ? NON_FICTION_THEMES : FICTION_THEMES
                const settings = NON_FICTION.has(parsed.genre) ? NON_FICTION_SETTINGS : FICTION_SETTINGS
                if (parsed.theme && themes.includes(parsed.theme)) setTheme(parsed.theme)
                if (parsed.setting && settings.includes(parsed.setting)) setSetting(parsed.setting)
                if (parsed.length && LENGTH_OPTIONS.find((l) => l.value === parsed.length)) setLength(parsed.length)
                if (typeof parsed.targetLevel === 'string') setTargetLevel(parsed.targetLevel)
                if (typeof parsed.freeText === 'string') setFreeText(parsed.freeText)
            } else {
                randomize()
            }
        } catch {
            randomize()
        }
    }, [])

    useEffect(() => {
        if (!currentThemes.includes(theme)) setTheme(currentThemes[0])
        if (!currentSettings.includes(setting)) setSetting(currentSettings[0])
    }, [genre, currentThemes, currentSettings, theme, setting])

    function persistSelection() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ genre, theme, setting, length, targetLevel, freeText }))
        } catch {
            // ignore
        }
    }

    async function handleGenerate() {
        persistSelection()
        setIsLoading(true)
        setStreamTitle('')
        setStreamContent('')
        setStreamLevel(null)
        setSavedStoryId(null)
        setStreamError(null)
        setPhase('streaming')

        try {
            const response = await fetch('/api/stories/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    genre,
                    theme,
                    setting,
                    length,
                    targetLevel: targetLevel === 'auto' ? undefined : Number(targetLevel),
                    freeText: freeText.trim() || undefined,
                }),
            })
            if (!response.ok || !response.body) {
                throw new Error(`Server returned ${response.status}`)
            }

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            let storyId: string | null = null
            let sawError = false

            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                buffer += decoder.decode(value, { stream: true })

                const messages = buffer.split('\n\n')
                buffer = messages.pop() ?? ''

                for (const msg of messages) {
                    const line = msg.trim()
                    if (!line.startsWith('data: ')) continue
                    const payload = line.slice('data: '.length)
                    let data: any
                    try {
                        data = JSON.parse(payload)
                    } catch {
                        continue
                    }
                    if (data.type === 'title') setStreamTitle(data.title)
                    else if (data.type === 'level') setStreamLevel(data.level)
                    else if (data.type === 'chunk') setStreamContent((c) => c + data.text)
                    else if (data.type === 'error') {
                        sawError = true
                        setStreamError(data.message)
                    }
                    else if (data.type === 'done') storyId = data.storyId
                }
            }

            if (storyId && !sawError) {
                // Promote the streaming Reader to "ready": tap activates,
                // difficulty buttons appear on last page, progress saves.
                // Update URL silently — no navigation, no remount, no flicker.
                setSavedStoryId(storyId)
                window.history.replaceState({}, '', `/story/${storyId}`)
            } else if (!sawError) {
                setStreamError('Generation finished without a story ID')
                setPhase('form')
            } else {
                setPhase('form')
            }
        } catch (error) {
            console.error(error)
            setStreamError(error instanceof Error ? error.message : 'Failed to generate story')
            setPhase('form')
        } finally {
            setIsLoading(false)
        }
    }

    const targetLang = levelInfo?.targetLanguage ?? 'zh-CN'
    const isChineseLang = targetLang === 'zh-CN' || targetLang === 'zh-TW'
    const lengthHint = (() => {
        const opt = LENGTH_OPTIONS.find((l) => l.value === length)
        if (!opt) return ''
        return isChineseLang ? `~${opt.chineseChars} chars` : `~${opt.words} words`
    })()
    const levelOpts = levelOptions(targetLang)

    // Segment streaming content client-side as it arrives, so the Reader
    // renders identically during streaming and after completion.
    const streamSegments = useMemo(
        () => segmentText(streamContent, targetLang),
        [streamContent, targetLang],
    )

    // ─── Streaming phase ──────────────────────────────────────────────────
    // Render the same Reader component used by /story/[id]. While storyId is
    // null and isStreaming=true, tap and progress-save are no-ops; once the
    // 'done' event arrives we set savedStoryId and the Reader transitions
    // in-place to "ready" mode — no navigation, no remount.
    if (phase === 'streaming') {
        const stillStreaming = !savedStoryId
        const levelStr = streamLevel !== null ? levelLabel(targetLang, streamLevel) : null
        const headerStatus = stillStreaming
            ? (streamContent ? 'Streaming…' : 'Thinking…')
            : null
        return (
            <StoryShell
                title={streamTitle || 'Generating…'}
                level={levelStr}
                statusLabel={headerStatus}
                date={null}
                newWordCount={null}
            >
                <div className="flex-1 container mx-auto px-4 py-4 max-w-3xl w-full">
                    <Reader
                        segments={streamSegments}
                        storyId={savedStoryId}
                        language={targetLang}
                        isStreaming={stillStreaming}
                        streamingLabel={streamContent ? 'Streaming…' : 'Thinking…'}
                    />
                </div>
                {streamError && (
                    <div className="px-4 pb-4 max-w-3xl mx-auto w-full">
                        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-lg">
                            {streamError}
                        </div>
                    </div>
                )}
            </StoryShell>
        )
    }

    // ─── Form phase ───────────────────────────────────────────────────────
    return (
        <div className="container mx-auto px-4 py-8 max-w-3xl">
            <div className="flex items-center justify-between gap-3 mb-8 flex-wrap">
                <div className="flex items-center gap-3">
                    <Sparkles className="text-retro-primary" size={32} />
                    <h1 className="text-3xl font-bold text-retro-primary">Story Generator</h1>
                </div>
                {levelInfo && (
                    <UserLevelChip summary={levelInfo.summary} targetLanguage={levelInfo.targetLanguage} />
                )}
            </div>

            <div className="bg-retro-paper p-8 rounded-xl border border-retro-muted/20 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-retro-primary/5 rounded-bl-full -z-0" />

                <div className="relative z-10 space-y-6">
                    <div className="text-xl leading-loose font-serif text-retro-text space-y-4">
                        <p>
                            I want to read a
                            <span className="inline-block mx-2 relative">
                                <select
                                    value={genre}
                                    onChange={(e) => setGenre(e.target.value)}
                                    disabled={isLoading}
                                    className="appearance-none bg-retro-primary/10 border-b-2 border-retro-primary text-retro-primary font-bold px-3 py-1 pr-8 rounded-t hover:bg-retro-primary/20 transition-colors cursor-pointer focus:outline-none disabled:opacity-50"
                                >
                                    {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
                                </select>
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-retro-primary pointer-events-none text-sm">▼</span>
                            </span>
                            {isNonFiction ? 'article' : 'story'} about
                            <span className="inline-block mx-2 relative">
                                <select
                                    value={theme}
                                    onChange={(e) => setTheme(e.target.value)}
                                    disabled={isLoading}
                                    className="appearance-none bg-retro-primary/10 border-b-2 border-retro-primary text-retro-primary font-bold px-3 py-1 pr-8 rounded-t hover:bg-retro-primary/20 transition-colors cursor-pointer focus:outline-none disabled:opacity-50"
                                >
                                    {currentThemes.map((t) => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-retro-primary pointer-events-none text-sm">▼</span>
                            </span>
                            set in
                            <span className="inline-block mx-2 relative">
                                <select
                                    value={setting}
                                    onChange={(e) => setSetting(e.target.value)}
                                    disabled={isLoading}
                                    className="appearance-none bg-retro-primary/10 border-b-2 border-retro-primary text-retro-primary font-bold px-3 py-1 pr-8 rounded-t hover:bg-retro-primary/20 transition-colors cursor-pointer focus:outline-none disabled:opacity-50"
                                >
                                    {currentSettings.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-retro-primary pointer-events-none text-sm">▼</span>
                            </span>.
                        </p>

                        <p>
                            It should be
                            <span className="inline-block mx-2 relative">
                                <select
                                    value={length}
                                    onChange={(e) => setLength(e.target.value)}
                                    disabled={isLoading}
                                    className="appearance-none bg-retro-primary/10 border-b-2 border-retro-primary text-retro-primary font-bold px-3 py-1 pr-8 rounded-t hover:bg-retro-primary/20 transition-colors cursor-pointer focus:outline-none disabled:opacity-50"
                                >
                                    {LENGTH_OPTIONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                                </select>
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-retro-primary pointer-events-none text-sm">▼</span>
                            </span>
                            <span className="text-retro-muted text-base ml-1">({lengthHint})</span>
                            {' '}at level
                            <span className="inline-block mx-2 relative">
                                <select
                                    value={targetLevel}
                                    onChange={(e) => setTargetLevel(e.target.value)}
                                    disabled={isLoading}
                                    className="appearance-none bg-retro-primary/10 border-b-2 border-retro-primary text-retro-primary font-bold px-3 py-1 pr-8 rounded-t hover:bg-retro-primary/20 transition-colors cursor-pointer focus:outline-none disabled:opacity-50"
                                >
                                    {levelOpts.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                                </select>
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-retro-primary pointer-events-none text-sm">▼</span>
                            </span>.
                        </p>
                    </div>

                    <div className="pt-2">
                        <label className="block text-sm text-retro-muted mb-2 font-sans">
                            Or describe what you want (overrides the dropdowns):
                        </label>
                        <textarea
                            value={freeText}
                            onChange={(e) => setFreeText(e.target.value)}
                            disabled={isLoading}
                            placeholder="e.g. a dog visiting Tokyo, or a news-style article about climate change"
                            rows={2}
                            className="w-full bg-retro-bg border border-retro-muted/30 rounded-md px-3 py-2 text-retro-text placeholder:text-retro-muted/50 focus:outline-none focus:border-retro-primary transition-colors font-sans text-sm disabled:opacity-50"
                        />
                    </div>
                </div>

                <div className="mt-8 flex gap-4 relative z-10">
                    <button
                        type="button"
                        onClick={randomize}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-6 py-3 rounded-full border-2 border-retro-primary text-retro-primary font-bold hover:bg-retro-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Shuffle size={20} />
                        Randomize
                    </button>

                    <button
                        type="button"
                        onClick={handleGenerate}
                        disabled={isLoading}
                        className="flex-1 flex items-center justify-center gap-2 rounded-full bg-retro-primary px-6 py-3 text-lg font-bold text-retro-bg hover:bg-retro-primary/90 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="animate-spin" />
                                Thinking…
                            </>
                        ) : (
                            <>
                                <Sparkles size={20} />
                                Generate {isNonFiction ? 'Article' : 'Story'}
                            </>
                        )}
                    </button>
                </div>
            </div>

            {streamError && (
                <div className="mt-8 bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-lg">
                    {streamError}
                </div>
            )}
        </div>
    )
}
