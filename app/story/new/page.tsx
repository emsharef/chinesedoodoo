'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Shuffle, Sparkles } from 'lucide-react'
import UserLevelChip from '@/components/UserLevelChip'
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
    { label: 'Short', value: 'short' },
    { label: 'Medium', value: 'medium' },
    { label: 'Long', value: 'long' },
]

const STORAGE_KEY = 'chinesedoodoo:newStorySelection'

export default function NewStoryPage() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [genre, setGenre] = useState(GENRES[0])
    const [theme, setTheme] = useState(FICTION_THEMES[0])
    const [setting, setSetting] = useState(FICTION_SETTINGS[0])
    const [length, setLength] = useState(LENGTH_OPTIONS[1].value)
    const [freeText, setFreeText] = useState('')

    // Streaming preview state
    const [streamTitle, setStreamTitle] = useState('')
    const [streamContent, setStreamContent] = useState('')
    const [streamError, setStreamError] = useState<string | null>(null)
    const previewRef = useRef<HTMLDivElement>(null)

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

    // Restore last selection from localStorage on mount; randomize only if nothing saved
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
                if (typeof parsed.freeText === 'string') setFreeText(parsed.freeText)
            } else {
                randomize()
            }
        } catch {
            randomize()
        }
    }, [])

    // Coerce theme/setting to be valid for the current genre type
    useEffect(() => {
        if (!currentThemes.includes(theme)) setTheme(currentThemes[0])
        if (!currentSettings.includes(setting)) setSetting(currentSettings[0])
    }, [genre, currentThemes, currentSettings, theme, setting])

    // Auto-scroll the preview as content grows
    useEffect(() => {
        if (previewRef.current) {
            previewRef.current.scrollTop = previewRef.current.scrollHeight
        }
    }, [streamContent])

    function persistSelection() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ genre, theme, setting, length, freeText }))
        } catch {
            // ignore
        }
    }

    async function handleGenerate() {
        persistSelection()
        setIsLoading(true)
        setStreamTitle('')
        setStreamContent('')
        setStreamError(null)

        try {
            const response = await fetch('/api/stories/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ genre, theme, setting, length, freeText: freeText.trim() || undefined }),
            })
            if (!response.ok || !response.body) {
                throw new Error(`Server returned ${response.status}`)
            }

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            let storyId: string | null = null

            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                buffer += decoder.decode(value, { stream: true })

                // Each SSE message ends with \n\n
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
                    else if (data.type === 'chunk') setStreamContent((c) => c + data.text)
                    else if (data.type === 'error') setStreamError(data.message)
                    else if (data.type === 'done') {
                        storyId = data.storyId
                    }
                }
            }

            if (storyId) {
                router.push(`/story/${storyId}`)
            } else if (!streamError) {
                setStreamError('Generation finished without a story ID')
            }
        } catch (error) {
            console.error(error)
            setStreamError(error instanceof Error ? error.message : 'Failed to generate story')
        } finally {
            setIsLoading(false)
        }
    }

    const isStreaming = isLoading && (streamTitle || streamContent)

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
                            </span>.
                        </p>
                    </div>

                    {/* Free-text override */}
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
                                {isStreaming ? 'Streaming…' : 'Thinking…'}
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

            {/* Live preview */}
            {(streamTitle || streamContent) && (
                <div className="mt-8 bg-retro-paper p-6 rounded-xl border border-retro-muted/20 shadow-lg">
                    {streamTitle && (
                        <h2 className="text-2xl font-bold text-retro-primary mb-4">{streamTitle}</h2>
                    )}
                    <div
                        ref={previewRef}
                        className="font-serif text-retro-text whitespace-pre-wrap leading-loose max-h-96 overflow-y-auto"
                    >
                        {streamContent}
                        {isLoading && <span className="inline-block w-2 h-5 bg-retro-primary/70 animate-pulse ml-1 align-middle" />}
                    </div>
                </div>
            )}

            {streamError && (
                <div className="mt-8 bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-lg">
                    {streamError}
                </div>
            )}
        </div>
    )
}
