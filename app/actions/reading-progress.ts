'use server'

import { createClient } from '@/utils/supabase/server'

// Save the user's furthest-read segment index on a story. Stored as a segment
// index (not a page index) because pagination is device/font-size dependent —
// segment indices are stable across devices.
//
// Never downgrades: if the user navigates back to an earlier segment, we leave
// the stored value alone so "resume" always lands at their max-read position.
export async function saveReadingProgress(storyId: string, segmentIndex: number) {
    if (segmentIndex < 0 || !Number.isFinite(segmentIndex)) return { success: false }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false }

    const { data: existing } = await supabase
        .from('chinese_stories')
        .select('current_position')
        .eq('id', storyId)
        .eq('user_id', user.id)
        .single()

    if (!existing) return { success: false }

    const next = Math.max(existing.current_position ?? 0, Math.floor(segmentIndex))
    if (next === existing.current_position) return { success: true, position: next }

    await supabase
        .from('chinese_stories')
        .update({ current_position: next })
        .eq('id', storyId)
        .eq('user_id', user.id)

    return { success: true, position: next }
}
