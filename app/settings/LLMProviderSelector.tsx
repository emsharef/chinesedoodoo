'use client'

import { useState } from 'react'
import { updateLLMProvider } from './actions'
import { Sparkles } from 'lucide-react'

const PROVIDERS = [
    {
        value: 'anthropic',
        label: 'Anthropic (Claude)',
        sub: 'Sonnet 4.6 stories · Haiku 4.5 lookups',
    },
    {
        value: 'openai',
        label: 'OpenAI',
        sub: 'GPT-5.4 stories · GPT-5.4-nano lookups',
    },
] as const

export default function LLMProviderSelector({ initialValue }: { initialValue: string }) {
    const [current, setCurrent] = useState(initialValue || 'anthropic')
    const [isLoading, setIsLoading] = useState(false)

    async function handleSelect(provider: string) {
        if (provider === current) return
        setIsLoading(true)
        try {
            await updateLLMProvider(provider)
            setCurrent(provider)
        } catch (error) {
            console.error(error)
            alert('Failed to update AI provider')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PROVIDERS.map((p) => (
                <button
                    key={p.value}
                    onClick={() => handleSelect(p.value)}
                    disabled={isLoading}
                    className={`
                        px-4 py-3 rounded-lg border transition-all flex items-center gap-3 text-left
                        ${current === p.value
                            ? 'bg-retro-primary text-retro-bg border-retro-primary font-bold shadow-md'
                            : 'bg-retro-paper text-retro-text border-retro-muted/20 hover:border-retro-primary/50'
                        }
                    `}
                >
                    <Sparkles size={20} />
                    <div className="flex-1">
                        <div>{p.label}</div>
                        <div className={`text-xs mt-0.5 ${current === p.value ? 'text-retro-bg/70' : 'text-retro-muted'}`}>
                            {p.sub}
                        </div>
                    </div>
                </button>
            ))}
        </div>
    )
}
