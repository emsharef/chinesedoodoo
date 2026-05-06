'use server'

import { createClient } from '@/utils/supabase/server'

// Save the user's furthest-read page on a story. Never downgrades — if the
// user navigates back to an earlier page, we leave the stored value alone so
// "resume" always lands them at their max-read position, not their last cursor.
export async function saveReadingProgress(storyId: string, page: number) {
    if (page < 0 || !Number.isFinite(page)) return { success: false }
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false }

    const { data: existing } = await supabase
        .from('chinese_stories')
        .select('current_page')
        .eq('id', storyId)
        .eq('user_id', user.id)
        .single()

    if (!existing) return { success: false }

    const next = Math.max(existing.current_page ?? 0, Math.floor(page))
    if (next === existing.current_page) return { success: true, page: next }

    await supabase
        .from('chinese_stories')
        .update({ current_page: next })
        .eq('id', storyId)
        .eq('user_id', user.id)

    return { success: true, page: next }
}
