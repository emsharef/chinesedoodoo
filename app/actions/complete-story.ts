'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function markStoryAsRead(
    storyId: string,
    rating: 'easy' | 'good' | 'hard',
    words: string[],
    language: string = 'zh-CN',
    tappedWords: string[] = [],
) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Not authenticated')

    // Tapped count is the count of unique words the user clicked while reading.
    // Used as a continuous difficulty signal in calibration.
    const tappedCount = new Set(tappedWords).size

    // 1. Update Story
    await supabase
        .from('chinese_stories')
        .update({
            is_read: true,
            difficulty_rating: rating,
            read_at: new Date().toISOString(),
            tapped_word_count: tappedCount,
        })
        .eq('id', storyId)

    // 2. Add Words to Vocab (Known)
    if (words.length > 0) {
        // Filter unique words
        const uniqueWords = Array.from(new Set(words))

        const updates = uniqueWords.map(word => ({
            user_id: user.id,
            word,
            status: 'known',
            language: language,
            stability: 1.0, // Initial stability for known words
            last_review: new Date().toISOString(),
            next_review: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // Review in 30 days
        }))

        // Only INSERT new rows. Words already in vocab (status='learning' from a prior
        // tap, or already 'known' from a previous complete) are NOT touched — completing
        // a story must not reset the FSRS schedule of a word the user is actively studying.
        await supabase.from('chinese_vocab_items').upsert(updates, {
            onConflict: 'user_id, word, language',
            ignoreDuplicates: true,
        })
    }

    revalidatePath('/')
    revalidatePath('/vocabulary')
    return { success: true }
}
