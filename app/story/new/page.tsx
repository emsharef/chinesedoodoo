'use client'

import { generateStory } from '@/app/actions'
import { useState, useEffect } from 'react'
import { Loader2, Shuffle, Sparkles } from 'lucide-react'

const GENRES = [
    // Fiction
    'Sci-Fi', 'Fantasy', 'Mystery', 'Romance', 'Slice of Life', 'Fable', 'Thriller', 'Comedy', 'Horror', 'Wuxia',
    // Non-Fiction / Real World
    'News', 'Finance', 'Politics', 'Science', 'Technology', 'History', 'Culture', 'Travel'
]

const FICTION_THEMES = ['Friendship', 'Betrayal', 'Discovery', 'A lost item', 'A new skill', 'A misunderstanding', 'A celebration', 'A journey', 'Revenge', 'Forgiveness']
const NON_FICTION_THEMES = ['Market Trends', 'Global Events', 'New Policy', 'Scientific Breakthrough', 'Tech Innovation', 'Cultural Festival', 'Historical Event', 'Travel Guide', 'Investment Strategy', 'Political Debate']

const FICTION_SETTINGS = ['A futuristic city', 'An ancient village', 'A space station', 'A magical forest', 'A busy market', 'A quiet library', 'A high school', 'A mountain temple', 'An underwater base', 'A cyber cafe']
const NON_FICTION_SETTINGS = ['Wall Street', 'Silicon Valley', 'Beijing', 'The United Nations', 'A Research Lab', 'A Museum', 'A Tech Conference', 'The Stock Exchange', 'A University', 'A Government Building']

const LENGTH_OPTIONS = [
    { label: 'Short (~100 chars)', value: 'short' },
    { label: 'Medium (~300 chars)', value: 'medium' },
    { label: 'Long (~600 chars)', value: 'long' },
]

import { useRouter } from 'next/navigation'

export default function NewStoryPage() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [genre, setGenre] = useState(GENRES[0])
    const [theme, setTheme] = useState(FICTION_THEMES[0])
    const [setting, setSetting] = useState(FICTION_SETTINGS[0])
    const [length, setLength] = useState(LENGTH_OPTIONS[1].value)

    const isNonFiction = ['News', 'Finance', 'Politics', 'Science', 'Technology', 'History', 'Culture', 'Travel'].includes(genre)
    const currentThemes = isNonFiction ? NON_FICTION_THEMES : FICTION_THEMES
    const currentSettings = isNonFiction ? NON_FICTION_SETTINGS : FICTION_SETTINGS

    function randomize() {
        const randomGenre = GENRES[Math.floor(Math.random() * GENRES.length)]
        setGenre(randomGenre)

        const isNF = ['News', 'Finance', 'Politics', 'Science', 'Technology', 'History', 'Culture', 'Travel'].includes(randomGenre)
        const themes = isNF ? NON_FICTION_THEMES : FICTION_THEMES
        const settings = isNF ? NON_FICTION_SETTINGS : FICTION_SETTINGS

        setTheme(themes[Math.floor(Math.random() * themes.length)])
        setSetting(settings[Math.floor(Math.random() * settings.length)])
        setLength(LENGTH_OPTIONS[Math.floor(Math.random() * LENGTH_OPTIONS.length)].value)
    }

    // Randomize on mount
    useEffect(() => {
        randomize()
    }, [])

    // Update theme/setting if genre changes type
    useEffect(() => {
        if (!currentThemes.includes(theme)) {
            setTheme(currentThemes[0])
        }
        if (!currentSettings.includes(setting)) {
            setSetting(currentSettings[0])
        }
    }, [genre, currentThemes, currentSettings, theme, setting])

    async function handleGenerate() {
        setIsLoading(true)
        const formData = new FormData()
        formData.append('genre', genre)
        formData.append('theme', theme)
        formData.append('setting', setting)
        formData.append('length', length)

        try {
            const result = await generateStory(formData)
            if (result && result.storyId) {
                router.push(`/story/${result.storyId}`)
            } else {
                throw new Error('No story ID returned')
            }
        } catch (error) {
            console.error(error)
            alert('Failed to generate story')
            setIsLoading(false)
        }
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-3xl">
            <div className="flex items-center gap-3 mb-8">
                <Sparkles className="text-retro-primary" size={32} />
                <h1 className="text-3xl font-bold text-retro-primary">Story Generator</h1>
            </div>

            <div className="bg-retro-paper p-8 rounded-xl border border-retro-muted/20 shadow-lg relative overflow-hidden">
                {/* Decorative background element */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-retro-primary/5 rounded-bl-full -z-0" />

                <div className="relative z-10 space-y-8 text-xl leading-loose font-serif text-retro-text">
                    <p>
                        I want to read a
                        <span className="inline-block mx-2 relative">
                            <select
                                name="genre"
                                value={genre}
                                onChange={(e) => setGenre(e.target.value)}
                                className="appearance-none bg-retro-primary/10 border-b-2 border-retro-primary text-retro-primary font-bold px-3 py-1 pr-8 rounded-t hover:bg-retro-primary/20 transition-colors cursor-pointer focus:outline-none focus:bg-retro-primary/20"
                            >
                                {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-retro-primary pointer-events-none text-sm">▼</span>
                        </span>
                        {isNonFiction ? 'article' : 'story'} about
                        <span className="inline-block mx-2 relative">
                            <select
                                name="theme"
                                value={theme}
                                onChange={(e) => setTheme(e.target.value)}
                                className="appearance-none bg-retro-primary/10 border-b-2 border-retro-primary text-retro-primary font-bold px-3 py-1 pr-8 rounded-t hover:bg-retro-primary/20 transition-colors cursor-pointer focus:outline-none focus:bg-retro-primary/20"
                            >
                                {currentThemes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-retro-primary pointer-events-none text-sm">▼</span>
                        </span>
                        set in
                        <span className="inline-block mx-2 relative">
                            <select
                                name="setting"
                                value={setting}
                                onChange={(e) => setSetting(e.target.value)}
                                className="appearance-none bg-retro-primary/10 border-b-2 border-retro-primary text-retro-primary font-bold px-3 py-1 pr-8 rounded-t hover:bg-retro-primary/20 transition-colors cursor-pointer focus:outline-none focus:bg-retro-primary/20"
                            >
                                {currentSettings.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-retro-primary pointer-events-none text-sm">▼</span>
                        </span>
                        .
                    </p>

                    <p>
                        It should be
                        <span className="inline-block mx-2 relative">
                            <select
                                name="length"
                                value={length}
                                onChange={(e) => setLength(e.target.value)}
                                className="appearance-none bg-retro-primary/10 border-b-2 border-retro-primary text-retro-primary font-bold px-3 py-1 pr-8 rounded-t hover:bg-retro-primary/20 transition-colors cursor-pointer focus:outline-none focus:bg-retro-primary/20"
                            >
                                {LENGTH_OPTIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                            </select>
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-retro-primary pointer-events-none text-sm">▼</span>
                        </span>
                        long.
                    </p>
                </div>

                <div className="mt-12 flex gap-4">
                    <button
                        type="button"
                        onClick={randomize}
                        className="flex items-center gap-2 px-6 py-3 rounded-full border-2 border-retro-primary text-retro-primary font-bold hover:bg-retro-primary/10 transition-colors"
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
                                Writing your {isNonFiction ? 'article' : 'story'}...
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
        </div>
    )
}
