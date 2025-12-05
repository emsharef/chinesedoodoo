'use client'

import { useState } from 'react'
import { updateAppearance } from './actions'
import { Moon, Sun, Type } from 'lucide-react'

interface AppearanceSettingsProps {
    initialFontSize: string
    initialTheme: string
}

export default function AppearanceSettings({ initialFontSize, initialTheme }: AppearanceSettingsProps) {
    const [fontSize, setFontSize] = useState(initialFontSize)
    const [theme, setTheme] = useState(initialTheme)
    const [isLoading, setIsLoading] = useState(false)

    async function handleUpdate(type: 'font_size' | 'theme', value: string) {
        setIsLoading(true)
        try {
            await updateAppearance({ [type]: value })
            if (type === 'font_size') setFontSize(value)
            if (type === 'theme') {
                setTheme(value)
                // Immediate client-side update for better UX
                if (value === 'light') {
                    document.body.classList.add('light-theme')
                } else {
                    document.body.classList.remove('light-theme')
                }
            }
        } catch (error) {
            console.error(error)
            alert('Failed to update setting')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="p-6 border-b border-retro-muted/10 bg-retro-bg/30">
            <h2 className="text-xl font-semibold text-retro-text mb-6 flex items-center gap-2">
                <Type size={20} />
                Appearance
            </h2>

            <div className="space-y-6">
                {/* Theme Toggle */}
                <div className="flex items-center justify-between">
                    <div>
                        <label className="block text-sm font-medium text-retro-text">Theme</label>
                        <p className="text-xs text-retro-muted">Switch between light and dark mode</p>
                    </div>
                    <div className="flex bg-retro-bg/50 rounded-lg p-1 border border-retro-muted/20">
                        <button
                            onClick={() => handleUpdate('theme', 'dark')}
                            disabled={isLoading}
                            className={`p-2 rounded-md transition-all ${theme === 'dark'
                                    ? 'bg-retro-primary text-retro-bg shadow-sm'
                                    : 'text-retro-muted hover:text-retro-text'
                                }`}
                        >
                            <Moon size={18} />
                        </button>
                        <button
                            onClick={() => handleUpdate('theme', 'light')}
                            disabled={isLoading}
                            className={`p-2 rounded-md transition-all ${theme === 'light'
                                    ? 'bg-retro-primary text-retro-bg shadow-sm'
                                    : 'text-retro-muted hover:text-retro-text'
                                }`}
                        >
                            <Sun size={18} />
                        </button>
                    </div>
                </div>

                {/* Font Size Selector */}
                <div className="flex items-center justify-between">
                    <div>
                        <label className="block text-sm font-medium text-retro-text">Font Size</label>
                        <p className="text-xs text-retro-muted">Adjust the reading text size</p>
                    </div>
                    <div className="flex bg-retro-bg/50 rounded-lg p-1 border border-retro-muted/20">
                        <button
                            onClick={() => handleUpdate('font_size', 'small')}
                            disabled={isLoading}
                            className={`px-3 py-1 rounded-md text-sm transition-all ${fontSize === 'small'
                                    ? 'bg-retro-primary text-retro-bg shadow-sm font-bold'
                                    : 'text-retro-muted hover:text-retro-text'
                                }`}
                        >
                            A
                        </button>
                        <button
                            onClick={() => handleUpdate('font_size', 'medium')}
                            disabled={isLoading}
                            className={`px-3 py-1 rounded-md text-base transition-all ${fontSize === 'medium'
                                    ? 'bg-retro-primary text-retro-bg shadow-sm font-bold'
                                    : 'text-retro-muted hover:text-retro-text'
                                }`}
                        >
                            A
                        </button>
                        <button
                            onClick={() => handleUpdate('font_size', 'large')}
                            disabled={isLoading}
                            className={`px-3 py-1 rounded-md text-lg transition-all ${fontSize === 'large'
                                    ? 'bg-retro-primary text-retro-bg shadow-sm font-bold'
                                    : 'text-retro-muted hover:text-retro-text'
                                }`}
                        >
                            A
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
