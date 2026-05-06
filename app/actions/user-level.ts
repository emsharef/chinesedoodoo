'use server'

import { createClient } from '@/utils/supabase/server'
import { summarizeUserLevel, type UserLevelSummary } from '@/lib/calibration'

export async function getUserLevel(): Promise<{
    summary: UserLevelSummary
    targetLanguage: string
} | null> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile } = await supabase
        .from('chinese_profiles')
        .select('target_language')
        .eq('id', user.id)
        .single()

    const targetLang = profile?.target_language || 'zh-CN'

    const { data: recent } = await supabase
        .from('chinese_stories')
        .select('title, content, difficulty_rating, difficulty_level, new_word_count, tapped_word_count')
        .eq('user_id', user.id)
        .eq('is_read', true)
        .eq('language', targetLang)
        .order('read_at', { ascending: false })
        .limit(5)

    const summary = summarizeUserLevel((recent ?? []) as any)
    return { summary, targetLanguage: targetLang }
}
