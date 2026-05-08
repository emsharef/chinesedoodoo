'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { BookOpen, CheckCircle, Smile, ThumbsUp, Dumbbell, Search, Trash2 } from 'lucide-react'
import { levelLabel } from '@/lib/levels'
import { deleteStory } from '@/app/actions/delete-story'

interface Story {
    id: string
    title: string
    content: string
    difficulty_level: number | null
    difficulty_rating: string | null
    language: string | null
    is_read: boolean
    read_at: string | null
    created_at: string
    new_word_count: number | null
    review_word_coverage: number | null
}

const FONT_SIZES: Record<string, { title: string; content: string }> = {
    small: { title: 'text-lg', content: 'text-xs' },
    medium: { title: 'text-xl', content: 'text-sm' },
    large: { title: 'text-2xl', content: 'text-base' },
    xl: { title: 'text-3xl', content: 'text-lg' },
}

type Filter = 'all' | 'unread' | 'read'

export default function LibraryGrid({
    stories,
    fontSize,
    targetLang,
}: {
    stories: Story[]
    fontSize: string
    targetLang: string
}) {
    const unreadCount = useMemo(() => stories.filter((s) => !s.is_read).length, [stories])
    const initialFilter: Filter = unreadCount > 0 ? 'unread' : 'all'

    const [filter, setFilter] = useState<Filter>(initialFilter)
    const [search, setSearch] = useState('')
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
    const [, startTransition] = useTransition()
    const router = useRouter()

    function handleDelete(e: React.MouseEvent, story: Story) {
        e.preventDefault()
        e.stopPropagation()
        if (!confirm(`Delete "${story.title}"? This cannot be undone.`)) return
        setPendingDeleteId(story.id)
        startTransition(async () => {
            const result = await deleteStory(story.id)
            if (!result.success) {
                alert(`Failed to delete: ${result.error ?? 'unknown error'}`)
                setPendingDeleteId(null)
                return
            }
            router.refresh()
            setPendingDeleteId(null)
        })
    }

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        return stories.filter((s) => {
            if (filter === 'unread' && s.is_read) return false
            if (filter === 'read' && !s.is_read) return false
            if (q && !s.title.toLowerCase().includes(q)) return false
            return true
        })
    }, [stories, filter, search])

    const currentSize = FONT_SIZES[fontSize] || FONT_SIZES.medium

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-retro-muted pointer-events-none" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by title…"
                        className="w-full bg-retro-paper border border-retro-muted/20 rounded-md pl-9 pr-3 py-2 text-retro-text placeholder:text-retro-muted/50 focus:outline-none focus:border-retro-primary text-sm"
                    />
                </div>
                <div className="flex gap-2">
                    {(['all', 'unread', 'read'] as Filter[]).map((f) => {
                        const count = f === 'all' ? stories.length : f === 'unread' ? unreadCount : stories.length - unreadCount
                        return (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-3 py-1.5 rounded-md text-sm border transition-colors capitalize ${
                                    filter === f
                                        ? 'bg-retro-primary text-retro-bg border-retro-primary font-semibold'
                                        : 'bg-retro-paper text-retro-muted border-retro-muted/20 hover:text-retro-text'
                                }`}
                            >
                                {f} <span className="opacity-60">{count}</span>
                            </button>
                        )
                    })}
                </div>
            </div>

            {filtered.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-retro-muted/20 rounded-xl">
                    {stories.length === 0 ? (
                        <>
                            <p className="text-retro-muted mb-4">No stories yet. Generate your first one!</p>
                            <Link href="/story/new" className="text-retro-primary hover:underline">
                                Create a Story
                            </Link>
                        </>
                    ) : (
                        <>
                            <p className="text-retro-muted mb-3">No stories match.</p>
                            <button
                                onClick={() => {
                                    setSearch('')
                                    setFilter('all')
                                }}
                                className="text-retro-primary hover:underline text-sm"
                            >
                                Clear filters
                            </button>
                        </>
                    )}
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {filtered.map((story) => (
                        <Link
                            key={story.id}
                            href={`/story/${story.id}`}
                            className="group relative block p-6 bg-retro-paper rounded-xl border border-retro-muted/20 hover:border-retro-primary/50 transition-all hover:shadow-lg hover:shadow-retro-primary/5"
                        >
                            <button
                                type="button"
                                onClick={(e) => handleDelete(e, story)}
                                disabled={pendingDeleteId === story.id}
                                aria-label="Delete story"
                                title="Delete story"
                                className="absolute top-3 right-3 p-1.5 rounded-md text-retro-muted/60 hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed z-10"
                            >
                                <Trash2 size={16} />
                            </button>
                            <div className="flex items-start justify-between mb-4 pr-8">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-retro-bg rounded-lg text-retro-primary group-hover:text-retro-accent transition-colors">
                                        <BookOpen size={24} />
                                    </div>
                                    {story.is_read && (
                                        <div className="flex items-center gap-2" title={story.read_at ? `Read on ${new Date(story.read_at).toLocaleDateString()}` : 'Read'}>
                                            {story.difficulty_rating === 'easy' && <Smile size={20} className="text-green-500" />}
                                            {story.difficulty_rating === 'good' && <ThumbsUp size={20} className="text-blue-500" />}
                                            {story.difficulty_rating === 'hard' && <Dumbbell size={20} className="text-red-500" />}
                                            {!story.difficulty_rating && <CheckCircle size={20} className="text-retro-muted" />}
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-xs font-mono text-retro-muted border border-retro-muted/30 px-2 py-1 rounded">
                                        {levelLabel(story.language ?? targetLang, story.difficulty_level)}
                                    </span>
                                    {story.is_read && story.read_at && (
                                        <span className="text-[10px] text-retro-muted mt-1">
                                            {new Date(story.read_at).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <h2 className={`${currentSize.title} font-bold text-retro-text group-hover:text-retro-primary transition-colors mb-2`}>
                                {story.title}
                            </h2>
                            <p className={`text-retro-muted line-clamp-3 ${currentSize.content}`}>
                                {story.content.substring(0, 100)}...
                            </p>
                            <div className="mt-4 text-xs text-retro-muted flex justify-between items-center">
                                <span>{new Date(story.created_at).toLocaleDateString()}</span>
                                {story.new_word_count !== null && story.new_word_count !== undefined && (
                                    <span className="text-retro-accent">
                                        {story.new_word_count} new
                                        {story.review_word_coverage !== null && story.review_word_coverage !== undefined && story.review_word_coverage > 0 && (
                                            <> · {Math.round(story.review_word_coverage * 100)}% review</>
                                        )}
                                    </span>
                                )}
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    )
}
