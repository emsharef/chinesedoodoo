'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function markStoryAsRead(storyId: string, rating: 'easy' | 'good' | 'hard', words: string[] = []) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Unauthorized')

    // 1. Mark story as read with rating
    const { error: storyError } = await supabase
        .from('chinese_stories')
        .update({
            is_read: true,
            difficulty_rating: rating,
            read_at: new Date().toISOString()
        })
        .eq('id', storyId)
        .eq('user_id', user.id)

    if (storyError) {
        console.error('Error marking story as read:', storyError)
        throw new Error('Failed to save progress')
    }

    // 2. Add words to vocabulary as 'known'
    const uniqueWords = Array.from(new Set(words))
    if (uniqueWords.length > 0) {
        const rows = uniqueWords.map(word => ({
            user_id: user.id,
            word: word,
            status: 'known',
            difficulty: 0,
            stability: 0,
            retrievability: 0,
            repetition_count: 0,
            next_review: null
        }))

        const { error: vocabError } = await supabase
            .from('chinese_vocab_items')
            .upsert(rows, {
                onConflict: 'user_id, word',
                ignoreDuplicates: true
            })

        if (vocabError) {
            console.error('Error adding known words:', vocabError)
            // Don't fail the whole request if this fails, just log it
        }
    }

    revalidatePath('/')
    revalidatePath('/vocabulary')
    return { success: true }
}
