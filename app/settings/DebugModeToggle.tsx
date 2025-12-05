'use client'

import { useState } from 'react'
import { toggleDebugMode } from './actions'

export default function DebugModeToggle({ initialValue }: { initialValue: boolean }) {
    const [isEnabled, setIsEnabled] = useState(initialValue)
    const [isLoading, setIsLoading] = useState(false)

    async function handleToggle() {
        setIsLoading(true)
        const newValue = !isEnabled
        try {
            await toggleDebugMode(newValue)
            setIsEnabled(newValue)
        } catch (error) {
            console.error(error)
            alert('Failed to update setting')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <button
            onClick={handleToggle}
            disabled={isLoading}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-retro-primary focus:ring-offset-2 ${isEnabled ? 'bg-retro-primary' : 'bg-retro-muted/30'
                }`}
        >
            <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
            />
        </button>
    )
}
