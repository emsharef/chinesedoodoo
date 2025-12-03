'use client'

import { useState, useEffect } from 'react'
import { getDueCards, submitReview } from './actions'
import { lookupWord } from '@/app/actions/lookup'
import { Loader2 } from 'lucide-react'

export default function ReviewPage() {
    const [queue, setQueue] = useState<any[]>([])
    const [currentItem, setCurrentItem] = useState<any | null>(null)
    const [showAnswer, setShowAnswer] = useState(false)
    const [definition, setDefinition] = useState<any | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        loadQueue()
    }, [])

    async function loadQueue() {
        setIsLoading(true)
        const items = await getDueCards()
        setQueue(items)
        if (items.length > 0) {
            setCurrentItem(items[0])
            // Prefetch definition
            fetchDefinition(items[0].word)
        }
        setIsLoading(false)
    }

    async function fetchDefinition(word: string) {
        const def = await lookupWord(word)
        setDefinition(def)
    }

    async function handleRate(rating: number) {
        if (!currentItem || isSubmitting) return
        setIsSubmitting(true)

        try {
            await submitReview(currentItem.id, rating)

            // Move to next card
            const nextQueue = queue.slice(1)
            setQueue(nextQueue)
            setShowAnswer(false)
            setDefinition(null)

            if (nextQueue.length > 0) {
                setCurrentItem(nextQueue[0])
                fetchDefinition(nextQueue[0].word)
            } else {
                setCurrentItem(null)
            }
        } finally {
            setIsSubmitting(false)
        }
    }

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
                <p className="text-retro-muted mb-8">You have no more words to review right now.</p>
                <a href="/" className="bg-retro-primary text-retro-bg px-6 py-3 rounded-md font-semibold hover:bg-retro-primary/90">
                    Read More Stories
                </a>
            </div>
        )
    }

    return (
        <div className="container mx-auto px-4 py-12 max-w-xl">
            <div className="bg-retro-paper rounded-xl shadow-2xl border border-retro-muted/20 min-h-[400px] flex flex-col items-center justify-center p-8 relative overflow-hidden">
                {/* Front */}
                <div className="text-center mb-8">
                    <h2 className="text-6xl font-serif font-bold text-retro-text mb-4">{currentItem.word}</h2>
                </div>

                {/* Back */}
                {showAnswer ? (
                    <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
                        {definition ? (
                            <>
                                <p className="text-2xl text-retro-accent font-mono mb-4">{definition.pinyin}</p>
                                <p className="text-lg text-retro-muted">{definition.english}</p>
                            </>
                        ) : (
                            <Loader2 className="animate-spin mx-auto text-retro-muted" />
                        )}

                        <div className="grid grid-cols-4 gap-4 mt-12 w-full">
                            <button onClick={() => handleRate(1)} className="bg-red-500/20 text-red-400 border border-red-500/50 py-3 rounded hover:bg-red-500/30">Again</button>
                            <button onClick={() => handleRate(2)} className="bg-orange-500/20 text-orange-400 border border-orange-500/50 py-3 rounded hover:bg-orange-500/30">Hard</button>
                            <button onClick={() => handleRate(3)} className="bg-green-500/20 text-green-400 border border-green-500/50 py-3 rounded hover:bg-green-500/30">Good</button>
                            <button onClick={() => handleRate(4)} className="bg-blue-500/20 text-blue-400 border border-blue-500/50 py-3 rounded hover:bg-blue-500/30">Easy</button>
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={() => setShowAnswer(true)}
                        className="bg-retro-primary text-retro-bg px-8 py-3 rounded-full font-semibold hover:bg-retro-primary/90 transition-transform hover:scale-105"
                    >
                        Show Answer
                    </button>
                )}
            </div>

            <div className="text-center mt-8 text-retro-muted text-sm">
                {queue.length} cards remaining
            </div>
        </div>
    )
}
