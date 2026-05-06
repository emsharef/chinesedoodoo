
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Reader from '@/components/Reader'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { levelLabel } from '@/lib/levels'

export default async function StoryPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: profile } = await supabase
        .from('chinese_profiles')
        .select('font_size, debug_mode')
        .eq('id', user.id)
        .single()

    const { data: story } = await supabase
        .from('chinese_stories')
        .select('*')
        .eq('id', id)
        .single()

    if (!story) redirect('/')

    let segments: string[] = []
    const isChinese = !story.language || story.language === 'zh-CN' || story.language === 'zh-TW'

    if (isChinese) {
        const { Segment, useDefault } = await import('segmentit')
        const segmentit = useDefault(new Segment())
        segments = segmentit.doSegment(story.content).map(s => s.w)
    } else {
        segments = story.content.match(/[\wÀ-ÿ]+|[^\w\sÀ-ÿ]+|\s+/g) || [story.content]
    }

    const levelStr = levelLabel(story.language, story.difficulty_level)
    const dateStr = new Date(story.created_at).toLocaleDateString()

    return (
        <div className="flex flex-col min-h-screen">
            {/* Compact reader header — single horizontal bar, mobile-tight */}
            <header className="sticky top-0 z-30 bg-retro-bg/95 backdrop-blur-sm border-b border-retro-muted/10 px-4 py-2.5 flex items-center gap-3">
                <Link
                    href="/"
                    aria-label="Back to library"
                    className="text-retro-muted hover:text-retro-primary transition-colors shrink-0"
                >
                    <ArrowLeft size={20} />
                </Link>
                <div className="flex-1 min-w-0">
                    <h1 className="text-base sm:text-lg font-semibold text-retro-primary truncate">
                        {story.title}
                    </h1>
                    <div className="flex gap-2 text-[11px] sm:text-xs text-retro-muted leading-tight">
                        <span>{levelStr}</span>
                        <span>·</span>
                        <span>{dateStr}</span>
                        {(story.new_word_count !== null && story.new_word_count !== undefined) && (
                            <>
                                <span>·</span>
                                <span className="text-retro-accent">{story.new_word_count} new</span>
                            </>
                        )}
                    </div>
                </div>
            </header>

            {/* Reading area — fills available viewport */}
            <div className="flex-1 container mx-auto px-4 py-4 max-w-3xl w-full">
                <Reader
                    segments={segments}
                    storyId={story.id}
                    fontSize={profile?.font_size || 'medium'}
                    language={story.language || 'zh-CN'}
                    initialPosition={story.current_position ?? 0}
                    isRead={!!story.is_read}
                    readAt={story.read_at}
                />
            </div>

            {story.debug_prompt && (
                <div className="px-4 pb-8 max-w-3xl mx-auto w-full">
                    <details className="bg-retro-bg/50 rounded-lg border border-retro-muted/20 overflow-hidden">
                        <summary className="p-3 cursor-pointer font-mono text-xs text-retro-muted hover:text-retro-text hover:bg-retro-primary/5 transition-colors select-none">
                            Debug Prompt
                        </summary>
                        <div className="p-4 border-t border-retro-muted/20 bg-black/5">
                            <pre className="whitespace-pre-wrap font-mono text-xs text-retro-text/70 overflow-x-auto">
                                {story.debug_prompt}
                            </pre>
                        </div>
                    </details>
                </div>
            )}
        </div>
    )
}
