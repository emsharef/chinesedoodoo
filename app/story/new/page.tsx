'use client'

import { generateStory } from '@/app/actions'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'

export default function NewStoryPage() {
    const [isLoading, setIsLoading] = useState(false)

    async function handleSubmit(formData: FormData) {
        setIsLoading(true)
        try {
            await generateStory(formData)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-2xl">
            <h1 className="text-3xl font-bold text-retro-primary mb-8">Generate New Story</h1>

            <form action={handleSubmit} className="space-y-6 bg-retro-paper p-8 rounded-xl border border-retro-muted/20">
                <div>
                    <label htmlFor="topic" className="block text-sm font-medium text-retro-text mb-2">
                        Topic or Genre
                    </label>
                    <input
                        id="topic"
                        name="topic"
                        type="text"
                        placeholder="e.g., A cyberpunk detective in Shanghai, or a fable about a rabbit"
                        required
                        className="w-full rounded-md bg-retro-bg border border-retro-muted/50 px-4 py-3 text-retro-text focus:border-retro-primary focus:outline-none focus:ring-1 focus:ring-retro-primary"
                    />
                </div>

                <div>
                    <label htmlFor="level" className="block text-sm font-medium text-retro-text mb-2">
                        Target Level (HSK)
                    </label>
                    <select
                        id="level"
                        name="level"
                        defaultValue="3"
                        className="w-full rounded-md bg-retro-bg border border-retro-muted/50 px-4 py-3 text-retro-text focus:border-retro-primary focus:outline-none focus:ring-1 focus:ring-retro-primary"
                    >
                        <option value="1">HSK 1 (Beginner)</option>
                        <option value="2">HSK 2</option>
                        <option value="3">HSK 3 (Intermediate)</option>
                        <option value="4">HSK 4</option>
                        <option value="5">HSK 5 (Advanced)</option>
                        <option value="6">HSK 6</option>
                    </select>
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 rounded-md bg-retro-primary px-4 py-3 text-base font-semibold text-retro-bg hover:bg-retro-primary/90 focus:outline-none focus:ring-2 focus:ring-retro-primary focus:ring-offset-2 focus:ring-offset-retro-bg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="animate-spin" />
                            Generating...
                        </>
                    ) : (
                        'Generate Story'
                    )}
                </button>
            </form>
        </div>
    )
}
