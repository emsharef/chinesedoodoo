'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function resetAccount() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        throw new Error('Not authenticated')
    }

    // Delete all stories
    const { error: storiesError } = await supabase
        .from('chinese_stories')
        .delete()
        .eq('user_id', user.id)

    if (storiesError) {
        console.error('Error deleting stories:', storiesError)
        throw new Error('Failed to delete stories')
    }

    // Delete all reviews first (foreign key constraint)
    const { error: reviewsError } = await supabase
        .from('chinese_reviews')
        .delete()
        .eq('user_id', user.id)

    if (reviewsError) {
        console.error('Error deleting reviews:', reviewsError)
        throw new Error('Failed to delete reviews')
    }

    // Delete all vocabulary items
    const { error: vocabError } = await supabase
        .from('chinese_vocab_items')
        .delete()
        .eq('user_id', user.id)

    if (vocabError) {
        console.error('Error deleting vocabulary:', vocabError)
        throw new Error('Failed to delete vocabulary')
    }

    revalidatePath('/')
    revalidatePath('/vocabulary')
    revalidatePath('/settings')

    return { success: true }
}

export async function toggleDebugMode(enabled: boolean) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('chinese_profiles')
        .upsert({
            id: user.id,
            debug_mode: enabled
        }, { onConflict: 'id' })

    if (error) {
        console.error('Error toggling debug mode:', error)
        throw new Error('Failed to update settings')
    }

    revalidatePath('/settings')
    return { success: true }
}

export async function updateFontSize(size: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('chinese_profiles')
        .upsert({
            id: user.id,
            font_size: size
        }, { onConflict: 'id' })

    if (error) {
        console.error('Error updating font size:', error)
        throw new Error('Failed to update settings')
    }

    revalidatePath('/')
    revalidatePath('/settings')
    revalidatePath('/story/[id]')
    return { success: true }
}

export async function updateLanguage(lang: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Unauthorized')

    const { error } = await supabase
        .from('chinese_profiles')
        .upsert({
            id: user.id,
            target_language: lang
        }, { onConflict: 'id' })

    if (error) {
        console.error('Error updating language:', error)
        throw new Error('Failed to update settings')
    }

    revalidatePath('/')
    revalidatePath('/settings')
    revalidatePath('/story/new')
    revalidatePath('/vocabulary')
    return { success: true }
}
