'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Smile, ThumbsUp, Dumbbell, ChevronLeft, ChevronRight, Languages } from 'lucide-react'
import { lookupWord } from '@/app/actions/lookup'
import { paginate, defaultTargetChars } from '@/lib/pagination'
import { saveReadingProgress } from '@/app/actions/reading-progress'
import { pinyin } from 'pinyin-pro'

interface ReaderProps {
    segments: string[]
    storyId: string
    fontSize?: string
    language?: string
    initialPosition?: number
    isRead?: boolean
    readAt?: string | null
}

const FONT_SIZES: Record<string, string> = {
    small: 'text-lg',
    medium: 'text-xl',
    large: 'text-2xl',
    xl: 'text-3xl',
}

interface DefinitionResult {
    pinyin?: string
    english: string
}

const SENTENCE_END = /[。.!?！？…]$/

// Walk the measured spans and chunk into pages whose vertical extent fits
// `pageHeight`. Each break is snapped to the nearest preceding sentence-end.
function paginateByOffsets(
    spans: HTMLElement[],
    segments: string[],
    pageHeight: number,
): string[][] {
    if (spans.length === 0 || pageHeight <= 0) return [segments]
    const pages: string[][] = []
    let pageStart = 0
    let pageStartTop = spans[0].offsetTop

    for (let i = 1; i < spans.length; i++) {
        const myTop = spans[i].offsetTop
        const myBottom = myTop + spans[i].offsetHeight
        if (myBottom - pageStartTop > pageHeight) {
            let cutoff = i - 1
            while (cutoff > pageStart && !SENTENCE_END.test(segments[cutoff])) cutoff--
            if (cutoff <= pageStart) cutoff = i - 1
            pages.push(segments.slice(pageStart, cutoff + 1))
            pageStart = cutoff + 1
            pageStartTop = spans[pageStart]?.offsetTop ?? myTop
        }
    }
    if (pageStart < segments.length) pages.push(segments.slice(pageStart))
    return pages
}

// Find which page contains a given segment index. Returns the page index.
function pageOfSegment(pages: string[][], segmentIndex: number): number {
    if (pages.length === 0) return 0
    let count = 0
    for (let i = 0; i < pages.length; i++) {
        count += pages[i].length
        if (segmentIndex < count) return i
    }
    return pages.length - 1
}

// Compute the absolute segment index of the first segment on a given page.
function firstSegmentOfPage(pages: string[][], pageIndex: number): number {
    let count = 0
    for (let i = 0; i < pageIndex; i++) count += pages[i].length
    return count
}

export default function Reader({
    segments,
    storyId,
    fontSize = 'medium',
    language = 'zh-CN',
    initialPosition = 0,
    isRead = false,
    readAt = null,
}: ReaderProps) {
    const [selectedWord, setSelectedWord] = useState<string | null>(null)
    const [definition, setDefinition] = useState<DefinitionResult | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [showPinyin, setShowPinyin] = useState(false)
    const [tappedWords, setTappedWords] = useState<Set<string>>(new Set())

    const isChinese = language === 'zh-CN' || language === 'zh-TW'

    // Char-target initial pagination — replaced by DOM-measured pagination as
    // soon as the measurement div has laid out. Avoids a flash of all-content
    // before measurement completes.
    const initialPages = useMemo(() => {
        const w = typeof window !== 'undefined' ? window.innerWidth : 1024
        return paginate(segments, language, { targetChars: defaultTargetChars(w, language) })
    }, [segments, language])

    const [pages, setPages] = useState<string[][]>(initialPages)

    // Progress tracked as a segment index — stable across pagination changes.
    const [currentSegmentIndex, setCurrentSegmentIndex] = useState<number>(
        Math.max(0, Math.min(initialPosition, segments.length - 1)),
    )

    const currentPage = useMemo(() => pageOfSegment(pages, currentSegmentIndex), [pages, currentSegmentIndex])
    const totalPages = Math.max(1, pages.length)
    const isLastPage = currentPage >= totalPages - 1
    const currentSegments = pages[currentPage] ?? []

    // Measurement: hidden div renders all segments, ResizeObserver triggers
    // recomputation when the visible reader's height changes (resize, font
    // change, pinyin toggle). Wait for fonts so measurements are stable.
    const measurementRef = useRef<HTMLDivElement>(null)
    const readingAreaRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const meas = measurementRef.current
        const reading = readingAreaRef.current
        if (!meas || !reading || segments.length === 0) return

        let cancelled = false
        async function recompute() {
            try {
                await (document as any).fonts?.ready
            } catch {
                // ignore — older browsers
            }
            if (cancelled || !meas || !reading) return

            const pageHeight = reading.clientHeight
            if (pageHeight <= 0) return

            const spans = Array.from(meas.querySelectorAll('[data-seg]')) as HTMLElement[]
            if (spans.length === 0) {
                setPages([segments])
                return
            }
            const next = paginateByOffsets(spans, segments, pageHeight)
            if (!cancelled) setPages(next)
        }

        // Initial measurement
        recompute()

        // Re-measure on reading-area resize (covers viewport changes too)
        const ro = new ResizeObserver(() => recompute())
        ro.observe(reading)

        return () => {
            cancelled = true
            ro.disconnect()
        }
    }, [segments, fontSize, showPinyin, language])

    // Persist progress (max-only enforced on the server)
    useEffect(() => {
        const handle = setTimeout(() => {
            saveReadingProgress(storyId, currentSegmentIndex).catch(() => {})
        }, 600)
        return () => clearTimeout(handle)
    }, [currentSegmentIndex, storyId])

    // Keyboard nav
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') {
                if (selectedWord) setSelectedWord(null)
                return
            }
            if (selectedWord) return
            if (e.key === 'ArrowLeft') {
                e.preventDefault()
                goPrev()
            } else if (e.key === 'ArrowRight') {
                e.preventDefault()
                goNext()
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedWord, pages, currentPage])

    // Touch swipe
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
        if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return
        if (dx < 0) goNext()
        else goPrev()
    }

    function goPrev() {
        if (currentPage <= 0) return
        const target = firstSegmentOfPage(pages, currentPage - 1)
        setCurrentSegmentIndex(target)
    }
    function goNext() {
        if (currentPage >= totalPages - 1) return
        const target = firstSegmentOfPage(pages, currentPage + 1)
        setCurrentSegmentIndex(target)
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

    const readerTextClasses = `prose prose-invert prose-lg max-w-none ${FONT_SIZES[fontSize]} leading-loose tracking-wide font-serif`

    return (
        <div className="relative flex flex-col h-[calc(100vh-7rem)] sm:h-[calc(100vh-8rem)]">
            {/* Hidden measurement: renders ALL segments at the visible reader's
                width so we can derive page boundaries from offsetTop. */}
            <div
                ref={measurementRef}
                aria-hidden="true"
                className={`${readerTextClasses} absolute invisible pointer-events-none top-0 left-0 right-0`}
                style={{ visibility: 'hidden' }}
            >
                <p className="flex flex-wrap gap-x-1 gap-y-4 items-end">
                    {segments.map((word, index) => (
                        <span key={`m-${index}`} data-seg={index} className="px-0.5">
                            {isChinese && showPinyin && (
                                <span className="block text-xs text-center w-full absolute -top-5 left-0 font-sans whitespace-nowrap">
                                    {pinyin(word, { toneType: 'symbol' })}
                                </span>
                            )}
                            {word}
                        </span>
                    ))}
                </p>
            </div>

            {/* Page indicator + pinyin toggle */}
            <div className="flex justify-between items-center mb-2 shrink-0">
                <span className="text-xs text-retro-muted font-mono tabular-nums">
                    {currentPage + 1} / {totalPages}
                </span>
                {isChinese && (
                    <button
                        onClick={() => setShowPinyin(!showPinyin)}
                        aria-label={showPinyin ? 'Hide pinyin' : 'Show pinyin'}
                        title={showPinyin ? 'Hide pinyin' : 'Show pinyin'}
                        className={`p-1.5 rounded-md transition-colors ${
                            showPinyin
                                ? 'bg-retro-primary/20 text-retro-primary'
                                : 'text-retro-muted hover:text-retro-primary hover:bg-retro-primary/10'
                        }`}
                    >
                        <Languages size={18} />
                    </button>
                )}
            </div>

            {/* Visible reading area — fills remaining space */}
            <div
                ref={readingAreaRef}
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
                className={`${readerTextClasses} flex-1 overflow-hidden`}
            >
                <p className="flex flex-wrap gap-x-1 gap-y-4 items-end">
                    {currentSegments.map((word, index) => renderWord(word, `${currentPage}-${index}`))}
                </p>
            </div>

            {/* Page nav */}
            <div className="mt-3 flex items-center justify-between gap-3 shrink-0">
                <button
                    onClick={goPrev}
                    disabled={currentPage === 0}
                    aria-label="Previous page"
                    className="flex items-center gap-1 px-4 py-2 rounded-md border border-retro-primary/40 text-retro-primary hover:bg-retro-primary/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <ChevronLeft size={20} />
                    <span className="hidden sm:inline">Previous</span>
                </button>

                {totalPages > 1 && totalPages <= 12 && (
                    <div className="flex items-center gap-1.5">
                        {Array.from({ length: totalPages }).map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setCurrentSegmentIndex(firstSegmentOfPage(pages, i))}
                                aria-label={`Go to page ${i + 1}`}
                                className={`w-2 h-2 rounded-full transition-all ${
                                    i === currentPage ? 'bg-retro-primary w-6' : 'bg-retro-muted/30 hover:bg-retro-muted/60'
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

            {/* Footer slot — always reserved (~110px) so the reading area's
                height is stable as the user moves from non-last to last page.
                Without this, ResizeObserver would re-trigger pagination on
                each page change and we'd get oscillating page counts. */}
            <div className="mt-4 shrink-0 h-[110px] flex items-center justify-center">
                {isLastPage && (
                    isRead ? (
                        <p className="text-retro-muted text-sm">
                            ✓ Read{readAt ? ` on ${new Date(readAt).toLocaleDateString()}` : ''}
                        </p>
                    ) : (
                        <div className="flex flex-col items-center gap-2">
                            <h3 className="text-sm font-serif text-retro-muted">How was this story?</h3>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => handleCompleteStory('easy')}
                                    disabled={isLoading}
                                    className="flex flex-col items-center gap-1 p-2.5 rounded-xl bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[72px]"
                                >
                                    <Smile size={22} />
                                    <span className="font-bold text-xs">Easy</span>
                                </button>

                                <button
                                    onClick={() => handleCompleteStory('good')}
                                    disabled={isLoading}
                                    className="flex flex-col items-center gap-1 p-2.5 rounded-xl bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[72px]"
                                >
                                    <ThumbsUp size={22} />
                                    <span className="font-bold text-xs">Good</span>
                                </button>

                                <button
                                    onClick={() => handleCompleteStory('hard')}
                                    disabled={isLoading}
                                    className="flex flex-col items-center gap-1 p-2.5 rounded-xl bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[72px]"
                                >
                                    <Dumbbell size={22} />
                                    <span className="font-bold text-xs">Hard</span>
                                </button>
                            </div>
                        </div>
                    )
                )}
            </div>

            {/* Definition popover */}
            {selectedWord && (
                <>
                    <div
                        className="fixed inset-0 bg-black/20 z-[55] animate-in fade-in"
                        onClick={() => setSelectedWord(null)}
                    />

                    <div className="fixed bottom-0 left-0 right-0 p-6 pb-8 bg-retro-paper border-t border-retro-primary shadow-2xl z-[60] animate-in slide-in-from-bottom-10">
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
