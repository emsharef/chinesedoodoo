'use client'

import { useState } from 'react'
import { updateFontSize } from './actions'
import { Type } from 'lucide-react'

const SIZES = [
    { value: 'small', label: 'Small', class: 'text-sm' },
    { value: 'medium', label: 'Medium', class: 'text-base' },
    { value: 'large', label: 'Large', class: 'text-lg' },
    { value: 'xl', label: 'Extra Large', class: 'text-xl' },
]

export default function FontSizeSelector({ initialValue }: { initialValue: string }) {
    const [currentSize, setCurrentSize] = useState(initialValue || 'medium')
    const [isLoading, setIsLoading] = useState(false)

    async function handleSelect(size: string) {
        setIsLoading(true)
        try {
            await updateFontSize(size)
            setCurrentSize(size)
        } catch (error) {
            console.error(error)
            alert('Failed to update setting')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="flex gap-2">
            {SIZES.map((size) => (
                <button
                    key={size.value}
                    onClick={() => handleSelect(size.value)}
                    disabled={isLoading}
                    className={`
                        px-4 py-2 rounded-lg border transition-all flex items-center gap-2
                        ${currentSize === size.value
                            ? 'bg-retro-primary text-retro-bg border-retro-primary font-bold shadow-md'
                            : 'bg-retro-paper text-retro-text border-retro-muted/20 hover:border-retro-primary/50'
                        }
                    `}
                >
                    <Type size={16} />
                    <span className={size.class}>{size.label}</span>
                </button>
            ))}
        </div>
    )
}
