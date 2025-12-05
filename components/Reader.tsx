'use client'

import { useState, useEffect } from 'react'
import { Volume2, Smile, ThumbsUp, Dumbbell } from 'lucide-react'
import { lookupWord } from '@/app/actions/lookup'

interface ReaderProps {
    segments: string[]
    storyId: string
    fontSize?: string
    language?: string
}

import { pinyin } from 'pinyin-pro'

const FONT_SIZES: Record<string, string> = {
    small: 'text-lg',
    medium: 'text-xl',
    large: 'text-2xl',
    xl: 'text-3xl'
}

export default function Reader({ segments, storyId, fontSize = 'medium', language = 'zh-CN' }: ReaderProps) {
    const [selectedWord, setSelectedWord] = useState<string | null>(null)
    const [definition, setDefinition] = useState<any | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [showPinyin, setShowPinyin] = useState(false)

    const isChinese = language === 'zh-CN' || language === 'zh-TW'

    async function handleWordClick(word: string) {
        // Ignore punctuation/spaces if possible, but for now just allow clicking everything
        if (!word.trim()) return

        setSelectedWord(word)
        setIsLoading(true)
        setDefinition(null)

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

            // Extract words based on language
            let words: string[] = []
            if (isChinese) {
                words = segments.filter(s => /[\u4e00-\u9fa5]/.test(s))
            } else {
                // For other languages, filter out punctuation/spaces
                words = segments.filter(s => s.trim().length > 0 && !/^[.,!?;:"'()\[\]]+$/.test(s))
            }

            await markStoryAsRead(storyId, rating, words, language)
            window.location.href = '/'
        } catch (error) {
            console.error(error)
            alert('Failed to mark story as read')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="relative pb-20">
            {/* Controls - Only show Pinyin toggle for Chinese */}
            {isChinese && (
                <div className="fixed bottom-8 right-8 flex gap-4 z-10">
                    <button
                        onClick={() => setShowPinyin(!showPinyin)}
                        className="bg-retro-paper border border-retro-primary text-retro-primary px-4 py-2 rounded-full shadow-lg hover:bg-retro-bg transition-colors"
                    >
                        {showPinyin ? 'Hide Pinyin' : 'Show Pinyin'}
                    </button>
                </div>
            )}

            {/* Text Area */}
            <div className={`prose prose-invert prose-lg max-w-none ${FONT_SIZES[fontSize]} leading-loose tracking-wide font-serif mb-12`}>
                <p className="flex flex-wrap gap-x-1 gap-y-4 items-end">
                    {segments.map((word, index) => (
                        <span
                            key={index}
                            onClick={() => handleWordClick(word)}
                            className={`
                cursor-pointer hover:bg-retro-primary/20 hover:text-retro-primary rounded px-0.5 transition-colors relative group
                ${selectedWord === word ? 'bg-retro-primary/30 text-retro-primary' : ''}
              `}
                        >
                            {/* Pinyin Display - Only for Chinese */}
                            {isChinese && (showPinyin || (selectedWord === word && definition?.pinyin)) && (
                                <span className="block text-xs text-retro-muted text-center w-full absolute -top-5 left-0 font-sans whitespace-nowrap overflow-visible">
                                    {selectedWord === word && definition?.pinyin
                                        ? definition.pinyin
                                        : pinyin(word, { toneType: 'symbol' })}
                                </span>
                            )}
                            {word}
                        </span>
                    ))}
                </p>
            </div>

            {/* Complete Button */}
            <div className="mt-12 flex flex-col items-center gap-6 pb-12">
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
            </div>

            {/* Definition Popover */}
            {selectedWord && (
                <>
                    {/* Backdrop */}
                    <div
                        className="fixed inset-0 bg-black/20 z-[55] animate-in fade-in"
                        onClick={() => setSelectedWord(null)}
                    />

                    {/* Drawer */}
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
