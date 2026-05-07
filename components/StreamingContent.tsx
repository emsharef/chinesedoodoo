'use client'

import { useEffect, useRef } from 'react'

// Renders streaming text in the same typography as the paginated Reader, so
// the visual transition from /story/new (streaming) → /story/[id] (Reader) is
// minimal. No pagination, no word-tap — those activate once the story is saved
// and the user lands on /story/[id].
interface Props {
    text: string
    isStreaming: boolean
    fontSize?: string
}

const FONT_SIZES: Record<string, string> = {
    small: 'text-lg',
    medium: 'text-xl',
    large: 'text-2xl',
    xl: 'text-3xl',
}

export default function StreamingContent({ text, isStreaming, fontSize = 'medium' }: Props) {
    const ref = useRef<HTMLDivElement>(null)

    // Auto-scroll to keep the latest line visible
    useEffect(() => {
        const el = ref.current
        if (!el) return
        el.scrollTop = el.scrollHeight
    }, [text])

    return (
        <div
            ref={ref}
            className={`prose prose-invert prose-lg max-w-none ${FONT_SIZES[fontSize]} leading-loose tracking-wide font-serif whitespace-pre-wrap overflow-y-auto`}
        >
            {text}
            {isStreaming && (
                <span
                    aria-hidden
                    className="inline-block w-2.5 h-6 bg-retro-primary/70 animate-pulse ml-1 align-middle"
                />
            )}
        </div>
    )
}
