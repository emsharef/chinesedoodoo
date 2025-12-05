import { createClient } from '@/utils/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Reader from '@/components/Reader'
import { Segment, useDefault } from 'segmentit'

export default async function StoryPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: story } = await supabase
        .from('chinese_stories')
        .select('*')
        .eq('id', id)
        .single()

    if (!story) notFound()

    // Server-side segmentation
    const segmentit = useDefault(new Segment())
    const result = segmentit.doSegment(story.content)
    const segments = result.map((r: any) => r.w)

    return (
        <div className="container mx-auto px-4 py-8 max-w-3xl">
            <div className="mb-8">
                <h1 className="text-4xl font-bold text-retro-primary mb-2">{story.title}</h1>
                <div className="flex gap-4 text-retro-muted text-sm">
                    <span>HSK {story.difficulty_level}</span>
                    <span>{new Date(story.created_at).toLocaleDateString()}</span>
                </div>
            </div>

            <div className="bg-retro-paper p-8 rounded-xl shadow-lg border border-retro-muted/10 min-h-[60vh]">
                <Reader segments={segments} storyId={story.id} />
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
