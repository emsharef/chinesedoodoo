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
        </div>
    )
}
