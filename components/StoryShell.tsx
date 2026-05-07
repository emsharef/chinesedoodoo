import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

// Shared visual frame for /story/[id] (reading saved story) and /story/new
// during streaming. Keeps the compact header in the same place across the
// transition so swapping streaming text for the paginated Reader doesn't
// produce a visible jump.
interface StoryShellProps {
    title: string
    level?: string | null
    date?: string | null
    newWordCount?: number | null
    statusLabel?: string | null
    backHref?: string
    children: React.ReactNode
}

export default function StoryShell({
    title,
    level,
    date,
    newWordCount,
    statusLabel,
    backHref = '/',
    children,
}: StoryShellProps) {
    const metaParts: React.ReactNode[] = []
    if (statusLabel) metaParts.push(<span key="status" className="text-retro-accent">{statusLabel}</span>)
    if (level) metaParts.push(<span key="level">{level}</span>)
    if (date) metaParts.push(<span key="date">{date}</span>)
    if (newWordCount !== null && newWordCount !== undefined) {
        metaParts.push(
            <span key="new" className="text-retro-accent">
                {newWordCount} new
            </span>,
        )
    }

    return (
        <div className="flex flex-col min-h-screen">
            <header className="sticky top-0 z-30 bg-retro-bg/95 backdrop-blur-sm border-b border-retro-muted/10 px-4 py-2.5 flex items-center gap-3">
                <Link
                    href={backHref}
                    aria-label="Back"
                    className="text-retro-muted hover:text-retro-primary transition-colors shrink-0"
                >
                    <ArrowLeft size={20} />
                </Link>
                <div className="flex-1 min-w-0">
                    <h1 className="text-base sm:text-lg font-semibold text-retro-primary truncate">
                        {title || ' '}
                    </h1>
                    {metaParts.length > 0 && (
                        <div className="flex gap-2 text-[11px] sm:text-xs text-retro-muted leading-tight">
                            {metaParts.map((part, i) => (
                                <span key={i} className="inline-flex items-center gap-2">
                                    {i > 0 && <span aria-hidden>·</span>}
                                    {part}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </header>
            {children}
        </div>
    )
}
