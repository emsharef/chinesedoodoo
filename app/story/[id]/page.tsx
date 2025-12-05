
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Reader from '@/components/Reader'
import Link from 'next/link'
import { Segment, useDefault } from 'segmentit'

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

    // Segment text based on language
    let segments: string[] = []
    const isChinese = !story.language || story.language === 'zh-CN' || story.language === 'zh-TW'

    if (isChinese) {
        const { Segment, useDefault } = await import('segmentit')
        const segmentit = useDefault(new Segment())
        segments = segmentit.doSegment(story.content).map(s => s.w)
    } else {
        // Simple space-based segmentation for other languages, keeping punctuation attached or separate?
        // Better to split by regex to keep punctuation separate for cleaner clicking
        segments = story.content.match(/[\w\u00C0-\u00FF]+|[^\w\s\u00C0-\u00FF]+|\s+/g) || [story.content]
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-3xl">
            <div className="mb-8">
                <Link href="/" className="text-retro-muted hover:text-retro-primary transition-colors mb-4 inline-block">
                    ← Back to Library
                </Link>
                <h1 className="text-3xl font-bold text-retro-primary mb-2">{story.title}</h1>
                <div className="flex gap-4 text-sm text-retro-muted">
                    <span>HSK {story.difficulty_level || '?'}</span>
                    <span>{new Date(story.created_at).toLocaleDateString()}</span>
                </div>
            </div>

            <div className="bg-retro-paper p-8 rounded-xl shadow-lg border border-retro-muted/10 min-h-[60vh]">
                <Reader
                    segments={segments}
                    storyId={story.id}
                    fontSize={profile?.font_size || 'medium'}
                    language={story.language || 'zh-CN'}
                />
            </div>

            {story.debug_prompt && (
                <div className="mt-8">
                    <details className="bg-retro-bg/50 rounded-lg border border-retro-muted/20 overflow-hidden">
                        <summary className="p-4 cursor-pointer font-mono text-xs text-retro-muted hover:text-retro-text hover:bg-retro-primary/5 transition-colors select-none">
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
