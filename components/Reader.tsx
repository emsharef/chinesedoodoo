'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Smile, ThumbsUp, Dumbbell, ChevronLeft, ChevronRight } from 'lucide-react'
import { lookupWord } from '@/app/actions/lookup'
import { paginate, defaultTargetChars } from '@/lib/pagination'
import { saveReadingProgress } from '@/app/actions/reading-progress'

interface ReaderProps {
    segments: string[]
    storyId: string
    fontSize?: string
    language?: string
    initialPage?: number
    isRead?: boolean
    readAt?: string | null
}

import { pinyin } from 'pinyin-pro'

const FONT_SIZES: Record<string, string> = {
    small: 'text-lg',
    medium: 'text-xl',
    large: 'text-2xl',
    xl: 'text-3xl'
}

interface DefinitionResult {
    pinyin?: string
    english: string
}

export default function Reader({
    segments,
    storyId,
    fontSize = 'medium',
    language = 'zh-CN',
    initialPage = 0,
    isRead = false,
    readAt = null,
}: ReaderProps) {
    const [selectedWord, setSelectedWord] = useState<string | null>(null)
    const [definition, setDefinition] = useState<DefinitionResult | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [showPinyin, setShowPinyin] = useState(false)
    const [tappedWords, setTappedWords] = useState<Set<string>>(new Set())
    const [viewportWidth, setViewportWidth] = useState<number>(
        typeof window !== 'undefined' ? window.innerWidth : 1024,
    )

    const isChinese = language === 'zh-CN' || language === 'zh-TW'

    // Recompute pages whenever inputs change
    const pages = useMemo(() => {
        const targetChars = defaultTargetChars(viewportWidth, language)
        return paginate(segments, language, { targetChars })
    }, [segments, language, viewportWidth])

    const totalPages = Math.max(1, pages.length)
    const [currentPage, setCurrentPage] = useState<number>(() => Math.min(initialPage, Math.max(0, pages.length - 1)))
    const isLastPage = currentPage >= totalPages - 1
    const currentSegments = pages[currentPage] ?? []

    // Track viewport width — re-paginate on resize. Cap currentPage if pages shrunk.
    useEffect(() => {
        function onResize() {
            setViewportWidth(window.innerWidth)
        }
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
    }, [])

    useEffect(() => {
        if (currentPage > totalPages - 1) setCurrentPage(Math.max(0, totalPages - 1))
    }, [totalPages, currentPage])

    // Persist page progress (max-only — saveReadingProgress server action enforces that)
    useEffect(() => {
        const handle = setTimeout(() => {
            saveReadingProgress(storyId, currentPage).catch(() => {
                // Silent fail — progress is best-effort
            })
        }, 600)
        return () => clearTimeout(handle)
    }, [currentPage, storyId])

    // Keyboard nav: ESC closes the popover, arrows turn pages
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') {
                if (selectedWord) setSelectedWord(null)
                return
            }
            // Only handle arrows when the popover isn't capturing focus
            if (selectedWord) return
            if (e.key === 'ArrowLeft') {
                e.preventDefault()
                setCurrentPage((p) => Math.max(0, p - 1))
            } else if (e.key === 'ArrowRight') {
                e.preventDefault()
                setCurrentPage((p) => Math.min(totalPages - 1, p + 1))
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [selectedWord, totalPages])

    // Swipe nav for touch
    const touchStartX = useRef<number | null>(null)
    const touchStartY = useRef<number | null>(null)

    function onTouchStart(e: React.TouchEvent) {
        const t = e.touches[0]
        touchStartX.current = t.clientX
        touchStartY.current = t.clientY
    }

    function onTouchEnd(e: React.TouchEvent) {
        if (touchStartX.current === null || touchStartY.current === null) return
        const t = e.changedTouches[0]
        const dx = t.clientX - touchStartX.current
        const dy = t.clientY - touchStartY.current
        touchStartX.current = null
        touchStartY.current = null
        // Require horizontal dominance and a 50px threshold
        if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return
        if (dx < 0) setCurrentPage((p) => Math.min(totalPages - 1, p + 1))
        else setCurrentPage((p) => Math.max(0, p - 1))
    }

    function goPrev() {
        setCurrentPage((p) => Math.max(0, p - 1))
    }
    function goNext() {
        setCurrentPage((p) => Math.min(totalPages - 1, p + 1))
    }

    async function handleWordClick(word: string) {
        if (!word.trim()) return

        setSelectedWord(word)
        setIsLoading(true)
        setDefinition(null)
        setTappedWords((s) => {
            if (s.has(word)) return s
            const next = new Set(s)
            next.add(word)
            return next
        })

        try {
            const result = await lookupWord(word, language)
            setDefinition(result)
        } catch (error) {
            console.error('Lookup failed', error)
        } finally {
            setIsLoading(false)
        }
    }

    async function handleCompleteStory(rating: 'easy' | 'good' | 'hard') {
        setIsLoading(true)
        try {
            const { markStoryAsRead } = await import('@/app/actions/complete-story')

            let words: string[] = []
            if (isChinese) {
                words = segments.filter((s) => /[一-龥]/.test(s))
            } else {
                words = segments.filter((s) => s.trim().length > 0 && !/^[.,!?;:"'()\[\]]+$/.test(s))
            }

            await markStoryAsRead(storyId, rating, words, language, Array.from(tappedWords))
            window.location.href = '/'
        } catch (error) {
            console.error(error)
            alert('Failed to mark story as read')
        } finally {
            setIsLoading(false)
        }
    }

    const renderWord = useCallback(
        (word: string, key: string | number) => (
            <span
                key={key}
                onClick={() => handleWordClick(word)}
                className={`
                    cursor-pointer hover:bg-retro-primary/20 hover:text-retro-primary rounded px-0.5 transition-colors relative group
                    ${selectedWord === word ? 'bg-retro-primary/30 text-retro-primary' : ''}
                `}
            >
                {isChinese && (showPinyin || (selectedWord === word && definition?.pinyin)) && (
                    <span className="block text-xs text-retro-muted text-center w-full absolute -top-5 left-0 font-sans whitespace-nowrap overflow-visible">
                        {selectedWord === word && definition?.pinyin
                            ? definition.pinyin
                            : pinyin(word, { toneType: 'symbol' })}
                    </span>
                )}
                {word}
            </span>
        ),
        [selectedWord, definition?.pinyin, showPinyin, isChinese],
    )

    return (
        <div className="relative pb-32 md:pb-20">
            {/* Header: pinyin toggle + page indicator */}
            <div className="flex justify-between items-center mb-4">
                <span className="text-sm text-retro-muted font-mono tabular-nums">
                    Page {currentPage + 1} / {totalPages}
                </span>
                {isChinese && (
                    <button
                        onClick={() => setShowPinyin(!showPinyin)}
                        className="bg-retro-paper border border-retro-primary/50 text-retro-primary px-3 py-1.5 rounded-md text-sm hover:bg-retro-primary/10 transition-colors"
                    >
                        {showPinyin ? 'Hide Pinyin' : 'Show Pinyin'}
                    </button>
                )}
            </div>

            {/* Text area for the current page */}
            <div
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
                className={`prose prose-invert prose-lg max-w-none ${FONT_SIZES[fontSize]} leading-loose tracking-wide font-serif min-h-[40vh]`}
            >
                <p className="flex flex-wrap gap-x-1 gap-y-4 items-end">
                    {currentSegments.map((word, index) => renderWord(word, `${currentPage}-${index}`))}
                </p>
            </div>

            {/* Page navigation */}
            <div className="mt-8 flex items-center justify-between gap-3">
                <button
                    onClick={goPrev}
                    disabled={currentPage === 0}
                    aria-label="Previous page"
                    className="flex items-center gap-1 px-4 py-2 rounded-md border border-retro-primary/40 text-retro-primary hover:bg-retro-primary/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <ChevronLeft size={20} />
                    <span className="hidden sm:inline">Previous</span>
                </button>

                {/* Page dots — only when total pages is reasonable */}
                {totalPages > 1 && totalPages <= 12 && (
                    <div className="flex items-center gap-1.5">
                        {Array.from({ length: totalPages }).map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setCurrentPage(i)}
                                aria-label={`Go to page ${i + 1}`}
                                className={`w-2 h-2 rounded-full transition-all ${
                                    i === currentPage
                                        ? 'bg-retro-primary w-6'
                                        : 'bg-retro-muted/30 hover:bg-retro-muted/60'
                                }`}
                            />
                        ))}
                    </div>
                )}

                <button
                    onClick={goNext}
                    disabled={isLastPage}
                    aria-label="Next page"
                    className="flex items-center gap-1 px-4 py-2 rounded-md border border-retro-primary/40 text-retro-primary hover:bg-retro-primary/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight size={20} />
                </button>
            </div>

            {/* Difficulty buttons / read-confirmation — only on last page */}
            {isLastPage && (
                <div className="mt-12 flex flex-col items-center gap-6 pb-12">
                    {isRead ? (
                        <div className="text-center">
                            <p className="text-retro-muted">
                                ✓ Read{readAt ? ` on ${new Date(readAt).toLocaleDateString()}` : ''}
                            </p>
                        </div>
                    ) : (
                        <>
                            <h3 className="text-xl font-serif text-retro-muted">How was this story?</h3>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => handleCompleteStory('easy')}
                                    disabled={isLoading}
                                    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-green-500/10 text-green-600 hover:bg-green-500/20 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px]"
                                >
                                    <Smile size={32} />
                                    <span className="font-bold">Easy</span>
                                </button>

                                <button
                                    onClick={() => handleCompleteStory('good')}
                                    disabled={isLoading}
                                    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px]"
                                >
                                    <ThumbsUp size={32} />
                                    <span className="font-bold">Good</span>
                                </button>

                                <button
                                    onClick={() => handleCompleteStory('hard')}
                                    disabled={isLoading}
                                    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-red-500/10 text-red-600 hover:bg-red-500/20 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px]"
                                >
                                    <Dumbbell size={32} />
                                    <span className="font-bold">Hard</span>
                                </button>
                            </div>
                            {isLoading && <p className="text-retro-muted animate-pulse">Saving progress...</p>}
                        </>
                    )}
                </div>
            )}

            {/* Definition popover */}
            {selectedWord && (
                <>
                    <div
                        className="fixed inset-0 bg-black/20 z-[55] animate-in fade-in"
                        onClick={() => setSelectedWord(null)}
                    />

                    <div className="fixed bottom-0 left-0 right-0 p-6 pb-24 md:pb-6 bg-retro-paper border-t border-retro-primary shadow-2xl z-[60] animate-in slide-in-from-bottom-10">
                        <div className="container mx-auto max-w-2xl flex justify-between items-start">
                            <div>
                                <h3 className="text-3xl font-bold text-retro-primary mb-2">{selectedWord}</h3>
                                {isLoading ? (
                                    <div className="text-retro-muted animate-pulse">Loading definition...</div>
                                ) : definition ? (
                                    <div>
                                        {isChinese && <p className="text-xl font-mono text-retro-accent mb-1">{definition.pinyin}</p>}
                                        <p className="text-lg text-retro-text">{definition.english}</p>
                                    </div>
                                ) : (
                                    <div className="text-red-400">Failed to load definition</div>
                                )}
                            </div>
                            <button
                                onClick={() => setSelectedWord(null)}
                                className="text-retro-muted hover:text-retro-text"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
