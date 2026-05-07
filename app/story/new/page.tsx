'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Shuffle, Sparkles } from 'lucide-react'
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

const ACTIVITY_MESSAGES = [
    'Constructing the plot…',
    'Embedding your vocabulary…',
    'Designing the characters…',
    'Calibrating difficulty…',
    'Setting the scene…',
    'Polishing the prose…',
    'Choosing just the right words…',
    'Weaving the narrative…',
    'Sketching the dialogue…',
    'Adding finishing touches…',
]

type Phase = 'form' | 'loading'

export default function NewStoryPage() {
    const router = useRouter()
    const [phase, setPhase] = useState<Phase>('form')
    const [genre, setGenre] = useState(GENRES[0])
    const [theme, setTheme] = useState(FICTION_THEMES[0])
    const [setting, setSetting] = useState(FICTION_SETTINGS[0])
    const [length, setLength] = useState(LENGTH_OPTIONS[1].value)
    const [targetLevel, setTargetLevel] = useState<string>('auto')
    const [freeText, setFreeText] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [activityIndex, setActivityIndex] = useState(0)

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
        setFreeText('')
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

    // Rotate activity messages while loading.
    useEffect(() => {
        if (phase !== 'loading') return
        const interval = setInterval(() => {
            setActivityIndex((i) => (i + 1) % ACTIVITY_MESSAGES.length)
        }, 2400)
        return () => clearInterval(interval)
    }, [phase])

    function persistSelection() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ genre, theme, setting, length, targetLevel, freeText }))
        } catch {
            // ignore
        }
    }

    async function handleGenerate() {
        persistSelection()
        setError(null)
        setActivityIndex(0)
        setPhase('loading')

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

            const data = await response.json()
            if (!response.ok || !data.storyId) {
                throw new Error(data?.error || `Server returned ${response.status}`)
            }
            router.push(`/story/${data.storyId}`)
        } catch (err) {
            console.error(err)
            setError(err instanceof Error ? err.message : 'Failed to generate story')
            setPhase('form')
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

    if (phase === 'loading') {
        return (
            <div className="container mx-auto px-4 py-12 max-w-xl flex flex-col items-center justify-center min-h-[60vh]">
                <div className="relative mb-8">
                    <div className="absolute inset-0 bg-retro-primary/20 blur-2xl rounded-full animate-pulse" />
                    <div className="relative bg-retro-paper rounded-full p-6 border border-retro-primary/30 shadow-lg">
                        <Sparkles className="text-retro-primary animate-spin [animation-duration:3s]" size={40} />
                    </div>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-retro-primary mb-3 text-center">
                    Generating your {isNonFiction ? 'article' : 'story'}…
                </h2>
                <div className="h-7 mt-2 flex items-center justify-center">
                    <p
                        key={activityIndex}
                        className="text-retro-muted text-sm sm:text-base font-serif italic animate-in fade-in slide-in-from-bottom-2 duration-500"
                    >
                        {ACTIVITY_MESSAGES[activityIndex]}
                    </p>
                </div>
                <div className="mt-8 flex gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-retro-primary/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-retro-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-retro-primary/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
            </div>
        )
    }

    const selectClass =
        'appearance-none bg-retro-primary/10 border-b-2 border-retro-primary text-retro-primary font-bold px-2 sm:px-3 py-0.5 sm:py-1 pr-7 sm:pr-8 rounded-t hover:bg-retro-primary/20 transition-colors cursor-pointer focus:outline-none disabled:opacity-50'
    const caretClass =
        'absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 text-retro-primary pointer-events-none text-xs sm:text-sm'

    return (
        <div className="container mx-auto px-4 py-6 sm:py-8 max-w-3xl">
            <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8 flex-wrap">
                <div className="flex items-center gap-2 sm:gap-3">
                    <Sparkles className="text-retro-primary" size={24} />
                    <h1 className="text-xl sm:text-3xl font-bold text-retro-primary">Story Generator</h1>
                </div>
                {levelInfo && (
                    <UserLevelChip summary={levelInfo.summary} targetLanguage={levelInfo.targetLanguage} />
                )}
            </div>

            <div className="bg-retro-paper p-4 sm:p-8 rounded-xl border border-retro-muted/20 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-retro-primary/5 rounded-bl-full -z-0" />

                <div className="relative z-10 space-y-5 sm:space-y-6">
                    <div className="text-base sm:text-xl leading-relaxed sm:leading-loose font-serif text-retro-text space-y-3 sm:space-y-4">
                        <p>
                            I want to read a
                            <span className="inline-block mx-1 sm:mx-2 relative">
                                <select
                                    value={genre}
                                    onChange={(e) => setGenre(e.target.value)}
                                    className={selectClass}
                                >
                                    {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
                                </select>
                                <span className={caretClass}>▼</span>
                            </span>
                            {isNonFiction ? 'article' : 'story'} about
                            <span className="inline-block mx-1 sm:mx-2 relative">
                                <select
                                    value={theme}
                                    onChange={(e) => setTheme(e.target.value)}
                                    className={selectClass}
                                >
                                    {currentThemes.map((t) => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <span className={caretClass}>▼</span>
                            </span>
                            set in
                            <span className="inline-block mx-1 sm:mx-2 relative">
                                <select
                                    value={setting}
                                    onChange={(e) => setSetting(e.target.value)}
                                    className={selectClass}
                                >
                                    {currentSettings.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <span className={caretClass}>▼</span>
                            </span>.
                        </p>

                        <p>
                            It should be
                            <span className="inline-block mx-1 sm:mx-2 relative">
                                <select
                                    value={length}
                                    onChange={(e) => setLength(e.target.value)}
                                    className={selectClass}
                                >
                                    {LENGTH_OPTIONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                                </select>
                                <span className={caretClass}>▼</span>
                            </span>
                            <span className="text-retro-muted text-xs sm:text-base ml-1">({lengthHint})</span>
                            {' '}at level
                            <span className="inline-block mx-1 sm:mx-2 relative">
                                <select
                                    value={targetLevel}
                                    onChange={(e) => setTargetLevel(e.target.value)}
                                    className={selectClass}
                                >
                                    {levelOpts.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                                </select>
                                <span className={caretClass}>▼</span>
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
                            placeholder="e.g. a dog visiting Tokyo, or a news-style article about climate change"
                            rows={2}
                            className="w-full bg-retro-bg border border-retro-muted/30 rounded-md px-3 py-2 text-retro-text placeholder:text-retro-muted/50 focus:outline-none focus:border-retro-primary transition-colors font-sans text-sm"
                        />
                    </div>
                </div>

                <div className="mt-6 sm:mt-8 flex gap-2 sm:gap-4 relative z-10">
                    <button
                        type="button"
                        onClick={randomize}
                        className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-6 py-2 sm:py-3 rounded-full border-2 border-retro-primary text-retro-primary font-bold text-sm sm:text-base whitespace-nowrap hover:bg-retro-primary/10 transition-colors"
                    >
                        <Shuffle size={16} className="sm:hidden" />
                        <Shuffle size={20} className="hidden sm:inline" />
                        Randomize
                    </button>

                    <button
                        type="button"
                        onClick={handleGenerate}
                        className="flex-1 flex items-center justify-center gap-1.5 sm:gap-2 rounded-full bg-retro-primary px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-lg font-bold text-retro-bg whitespace-nowrap hover:bg-retro-primary/90 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                    >
                        <Sparkles size={16} className="sm:hidden" />
                        <Sparkles size={20} className="hidden sm:inline" />
                        Generate {isNonFiction ? 'Article' : 'Story'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="mt-8 bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-lg">
                    {error}
                </div>
            )}
        </div>
    )
}
