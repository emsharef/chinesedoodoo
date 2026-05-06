'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { getReviewQueue, submitReview, findExampleSentence } from './actions'
import { lookupWord } from '@/app/actions/lookup'
import { createClient } from '@/utils/supabase/client'

interface VocabItem {
    id: string
    word: string
    pinyin?: string | null
    definition?: string | null
    status: string
    stability: number
    repetition_count: number
    lapses: number
    last_review: string | null
}

interface Definition {
    pinyin?: string
    english: string
}

export default function ReviewPage() {
    const [queue, setQueue] = useState<VocabItem[]>([])
    const [reviewedToday, setReviewedToday] = useState(0)
    const [dailyTarget, setDailyTarget] = useState(30)
    const [headerCounts, setHeaderCounts] = useState({ due: 0, newCount: 0, learning: 0 })
    const [definition, setDefinition] = useState<Definition | null>(null)
    const [example, setExample] = useState<string | null>(null)
    const [showAnswer, setShowAnswer] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [language, setLanguage] = useState<string>('zh-CN')

    const currentItem = queue[0]
    const isChinese = language === 'zh-CN' || language === 'zh-TW'

    const loadQueue = useCallback(async (lang: string, target: number) => {
        setIsLoading(true)
        const result = await getReviewQueue(lang, target)
        setQueue(result.items as VocabItem[])
        setHeaderCounts({ due: result.dueCount, newCount: result.newCount, learning: result.learningCount })
        setIsLoading(false)
    }, [])

    const fetchDetails = useCallback(async (word: string, lang: string) => {
        setDefinition(null)
        setExample(null)
        // Definition (cache → CC-CEDICT → LLM)
        try {
            const def = await lookupWord(word, lang)
            setDefinition({ pinyin: def.pinyin, english: def.english })
        } catch (e) {
            console.error(e)
        }
        // Example sentence from a recent story
        try {
            const ex = await findExampleSentence(word, lang)
            setExample(ex)
        } catch {
            // ignore
        }
    }, [])

    useEffect(() => {
        async function init() {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            const { data: profile } = await supabase
                .from('chinese_profiles')
                .select('target_language, daily_review_target')
                .eq('id', user.id)
                .single()
            const lang = profile?.target_language || 'zh-CN'
            const target = profile?.daily_review_target || 30
            setLanguage(lang)
            setDailyTarget(target)
            await loadQueue(lang, target)
        }
        init()
    }, [loadQueue])

    // Pre-fetch definition + example for the next card whenever the head of queue changes.
    useEffect(() => {
        if (currentItem) {
            fetchDetails(currentItem.word, language)
        }
    }, [currentItem, language, fetchDetails])

    const handleRate = useCallback(
        async (rating: number) => {
            if (!currentItem || isSubmitting || !showAnswer) return
            setIsSubmitting(true)
            try {
                await submitReview(currentItem.id, rating)
                setShowAnswer(false)
                setQueue((q) => q.slice(1))
                setReviewedToday((n) => n + 1)
            } finally {
                setIsSubmitting(false)
            }
        },
        [currentItem, isSubmitting, showAnswer],
    )

    // Keyboard shortcuts: space (show), 1/2/3/4 (Again/Hard/Good/Easy)
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            // Ignore when typing in inputs
            if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return
            if (!currentItem || isLoading || isSubmitting) return

            if (!showAnswer) {
                if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault()
                    setShowAnswer(true)
                }
                return
            }
            if (e.key === '1') {
                e.preventDefault()
                handleRate(1)
            } else if (e.key === '2') {
                e.preventDefault()
                handleRate(2)
            } else if (e.key === '3') {
                e.preventDefault()
                handleRate(3)
            } else if (e.key === '4') {
                e.preventDefault()
                handleRate(4)
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [currentItem, isLoading, isSubmitting, showAnswer, handleRate])

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="animate-spin text-retro-primary" size={48} />
            </div>
        )
    }

    if (!currentItem) {
        return (
            <div className="container mx-auto px-4 py-12 text-center">
                <h1 className="text-3xl font-bold text-retro-primary mb-4">All Caught Up!</h1>
                <p className="text-retro-muted mb-2">
                    {reviewedToday > 0
                        ? `You reviewed ${reviewedToday} card${reviewedToday === 1 ? '' : 's'} today.`
                        : 'No cards are due right now.'}
                </p>
                <p className="text-retro-muted mb-8">
                    {headerCounts.newCount > 0 && (
                        <span>{headerCounts.newCount} new word{headerCounts.newCount === 1 ? '' : 's'} waiting in your vocabulary.</span>
                    )}
                </p>
                <Link href="/" className="bg-retro-primary text-retro-bg px-6 py-3 rounded-md font-semibold hover:bg-retro-primary/90 transition-colors">
                    Read More Stories
                </Link>
            </div>
        )
    }

    const progress = Math.min(100, Math.round((reviewedToday / dailyTarget) * 100))

    return (
        <div className="container mx-auto px-4 py-8 max-w-xl">
            {/* Header: counts + daily target progress */}
            <div className="mb-6 space-y-2">
                <div className="flex justify-between items-baseline text-sm text-retro-muted">
                    <span>
                        <strong className="text-retro-text">{headerCounts.due}</strong> due ·{' '}
                        <strong className="text-retro-text">{headerCounts.learning}</strong> learning ·{' '}
                        <strong className="text-retro-text">{headerCounts.newCount}</strong> new
                    </span>
                    <span>
                        {reviewedToday} / {dailyTarget} today
                    </span>
                </div>
                <div className="h-1.5 bg-retro-muted/20 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-retro-primary transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            <div className="bg-retro-paper rounded-xl shadow-2xl border border-retro-muted/20 min-h-[400px] flex flex-col items-center justify-center p-8 relative overflow-hidden">
                {/* Front: word */}
                <div className="text-center mb-8">
                    <h2 className="text-6xl font-serif font-bold text-retro-text mb-4">{currentItem.word}</h2>
                </div>

                {showAnswer ? (
                    <div className="text-center w-full animate-in fade-in slide-in-from-bottom-4 duration-300">
                        {definition ? (
                            <>
                                {isChinese && definition.pinyin && (
                                    <p className="text-2xl text-retro-accent font-mono mb-4">{definition.pinyin}</p>
                                )}
                                <p className="text-lg text-retro-muted mb-4">{definition.english}</p>
                            </>
                        ) : (
                            <Loader2 className="animate-spin mx-auto text-retro-muted mb-4" />
                        )}

                        {example && (
                            <div className="text-sm text-retro-muted/80 italic mb-6 px-4 py-2 bg-retro-bg/40 rounded">
                                <span className="block text-[10px] uppercase tracking-wider mb-1 not-italic">From your reading</span>
                                {example}
                            </div>
                        )}

                        {currentItem.repetition_count > 0 && (
                            <p className="text-xs text-retro-muted/70 mb-6">
                                Seen {currentItem.repetition_count} time{currentItem.repetition_count === 1 ? '' : 's'}
                                {currentItem.stability > 0 && (
                                    <> · stability ≈ {currentItem.stability.toFixed(1)}d</>
                                )}
                                {currentItem.lapses > 0 && <> · {currentItem.lapses} lapse{currentItem.lapses === 1 ? '' : 's'}</>}
                            </p>
                        )}

                        <div className="grid grid-cols-4 gap-2 w-full">
                            <RateButton onClick={() => handleRate(1)} disabled={isSubmitting} color="red" label="Again" hint="1" />
                            <RateButton onClick={() => handleRate(2)} disabled={isSubmitting} color="orange" label="Hard" hint="2" />
                            <RateButton onClick={() => handleRate(3)} disabled={isSubmitting} color="green" label="Good" hint="3" />
                            <RateButton onClick={() => handleRate(4)} disabled={isSubmitting} color="blue" label="Easy" hint="4" />
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={() => setShowAnswer(true)}
                        className="bg-retro-primary text-retro-bg px-8 py-3 rounded-full font-semibold hover:bg-retro-primary/90 transition-transform hover:scale-105"
                    >
                        Show Answer <span className="text-xs opacity-70 ml-2">(space)</span>
                    </button>
                )}
            </div>

            <div className="text-center mt-6 text-retro-muted text-sm">
                {queue.length} card{queue.length === 1 ? '' : 's'} remaining in this session
            </div>
        </div>
    )
}

function RateButton({
    onClick,
    disabled,
    color,
    label,
    hint,
}: {
    onClick: () => void
    disabled: boolean
    color: 'red' | 'orange' | 'green' | 'blue'
    label: string
    hint: string
}) {
    const palette = {
        red: 'bg-red-500/20 text-red-400 border-red-500/50 hover:bg-red-500/30',
        orange: 'bg-orange-500/20 text-orange-400 border-orange-500/50 hover:bg-orange-500/30',
        green: 'bg-green-500/20 text-green-400 border-green-500/50 hover:bg-green-500/30',
        blue: 'bg-blue-500/20 text-blue-400 border-blue-500/50 hover:bg-blue-500/30',
    }[color]
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`${palette} border py-3 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center gap-0.5`}
        >
            <span className="font-semibold">{label}</span>
            <span className="text-[10px] opacity-60">{hint}</span>
        </button>
    )
}
