'use client'

import { useState } from 'react'
import { updateLanguage } from './actions'
import { Globe } from 'lucide-react'

const LANGUAGES = [
    { value: 'zh-CN', label: 'Simplified Chinese', flag: '🇨🇳' },
    { value: 'zh-TW', label: 'Traditional Chinese', flag: '🇹🇼' },
    { value: 'de', label: 'German', flag: '🇩🇪' },
    { value: 'it', label: 'Italian', flag: '🇮🇹' },
    { value: 'es', label: 'Spanish', flag: '🇪🇸' },
]

export default function LanguageSelector({ initialValue }: { initialValue: string }) {
    const [currentLang, setCurrentLang] = useState(initialValue || 'zh-CN')
    const [isLoading, setIsLoading] = useState(false)

    async function handleSelect(lang: string) {
        setIsLoading(true)
        try {
            await updateLanguage(lang)
            setCurrentLang(lang)
        } catch (error) {
            console.error(error)
            alert('Failed to update language')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {LANGUAGES.map((lang) => (
                <button
                    key={lang.value}
                    onClick={() => handleSelect(lang.value)}
                    disabled={isLoading}
                    className={`
                        px-4 py-3 rounded-lg border transition-all flex items-center gap-3 text-left
                        ${currentLang === lang.value
                            ? 'bg-retro-primary text-retro-bg border-retro-primary font-bold shadow-md'
                            : 'bg-retro-paper text-retro-text border-retro-muted/20 hover:border-retro-primary/50'
                        }
                    `}
                >
                    <span className="text-2xl">{lang.flag}</span>
                    <span className="flex-1">{lang.label}</span>
                    {currentLang === lang.value && <Globe size={16} />}
                </button>
            ))}
        </div>
    )
}
