
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Reader from '@/components/Reader'
import StoryShell from '@/components/StoryShell'
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

    const { segmentText } = await import('@/lib/segment')
    const language = story.language || 'zh-CN'
    const segments = segmentText(story.content, language)

    // For Japanese, pre-load the user's cached hiragana readings (LLM-provided
    // on lookup) so the reader's phonetic overlay can display them above
    // kanji-containing words without a fresh API call.
    let readings: Record<string, string> | undefined
    if (language === 'ja') {
        const { data: vocab } = await supabase
            .from('chinese_vocab_items')
            .select('word, pinyin')
            .eq('user_id', user.id)
            .eq('language', 'ja')
            .not('pinyin', 'is', null)
        readings = {}
        for (const r of vocab ?? []) {
            if (r.pinyin) readings[r.word as string] = r.pinyin as string
        }
    }

    const levelStr = levelLabel(language, story.difficulty_level)
    const dateStr = new Date(story.created_at).toLocaleDateString()

    return (
        <StoryShell
            title={story.title}
            level={levelStr}
            date={dateStr}
            newWordCount={story.new_word_count ?? null}
        >
            <div className="flex-1 container mx-auto px-4 py-4 max-w-3xl w-full">
                <Reader
                    segments={segments}
                    storyId={story.id}
                    fontSize={profile?.font_size || 'medium'}
                    language={language}
                    initialPosition={story.current_position ?? 0}
                    isRead={!!story.is_read}
                    readAt={story.read_at}
                    readings={readings}
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
        </StoryShell>
    )
}
