'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getVocabulary() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return []

    const { data: items } = await supabase
        .from('chinese_vocab_items')
        .select('*')
        .eq('user_id', user.id)
        .order('next_review', { ascending: true })

    return items || []
}

export async function deleteVocabularyItem(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Unauthorized')

    // Also delete related reviews? Or keep them for stats?
    // Foreign key constraint might require deleting reviews first if cascade isn't set.
    // Let's assume cascade or delete reviews manually.

    await supabase
        .from('chinese_reviews')
        .delete()
        .eq('vocab_item_id', id)
        .eq('user_id', user.id)

    const { error } = await supabase
        .from('chinese_vocab_items')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

    if (error) {
        throw new Error(error.message)
    }

    revalidatePath('/vocabulary')
    revalidatePath('/review')
}
