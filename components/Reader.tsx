'use client'

import { useState } from 'react'
import { lookupWord } from '@/app/actions/lookup'
import { Loader2, Volume2 } from 'lucide-react'

interface ReaderProps {
    segments: string[]
    storyId: string
}

import { pinyin } from 'pinyin-pro'

export default function Reader({ segments, storyId }: ReaderProps) {
    const [selectedWord, setSelectedWord] = useState<string | null>(null)
    const [definition, setDefinition] = useState<any | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [showPinyin, setShowPinyin] = useState(false)

    async function handleWordClick(word: string) {
        // Ignore punctuation/spaces if possible, but for now just allow clicking everything
        if (!word.trim()) return

        setSelectedWord(word)
        setIsLoading(true)
        setDefinition(null)

        try {
            const result = await lookupWord(word)
            setDefinition(result)
        } catch (error) {
            console.error('Lookup failed', error)
        } finally {
            setIsLoading(false)
        }
    }

    // ...

    return (
        <div className="relative">
            {/* Controls */}
            <div className="fixed bottom-8 right-8 flex gap-4 z-10">
                <button
                    onClick={() => setShowPinyin(!showPinyin)}
                    className="bg-retro-paper border border-retro-primary text-retro-primary px-4 py-2 rounded-full shadow-lg hover:bg-retro-bg transition-colors"
                >
                    {showPinyin ? 'Hide Pinyin' : 'Show Pinyin'}
                </button>
            </div>

            {/* Text Area */}
            <div className="prose prose-invert prose-lg max-w-none text-xl leading-loose tracking-wide font-serif">
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
                            {/* Pinyin Display */}
                            {(showPinyin || (selectedWord === word && definition?.pinyin)) && (
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

            {/* Definition Popover/Modal */}
            {selectedWord && (
                <div className="fixed inset-x-0 bottom-0 p-4 bg-retro-paper border-t border-retro-primary/20 shadow-2xl transform transition-transform duration-300 z-50">
                    <div className="container mx-auto max-w-2xl flex justify-between items-start">
                        <div className="flex-1">
                            <div className="flex items-baseline gap-4 mb-2">
                                <h3 className="text-3xl font-bold text-retro-primary">{selectedWord}</h3>
                                {isLoading ? (
                                    <Loader2 className="animate-spin text-retro-muted" size={20} />
                                ) : (
                                    <span className="text-xl text-retro-accent font-mono">{definition?.pinyin}</span>
                                )}
                            </div>

                            {!isLoading && definition && (
                                <div className="space-y-2">
                                    <p className="text-retro-text text-lg">{definition.english}</p>
                                    {definition.isNew && (
                                        <span className="inline-block bg-retro-secondary/20 text-retro-secondary text-xs px-2 py-1 rounded">
                                            New Word Added
                                        </span>
                                    )}
                                </div>
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
            )}
        </div>
    )
}
