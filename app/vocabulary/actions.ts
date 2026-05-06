'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function getVocabulary(language: string = 'zh-CN') {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Not authenticated')

    const { data } = await supabase
        .from('chinese_vocab_items')
        .select('*')
        .eq('user_id', user.id)
        .eq('language', language)
        .order('created_at', { ascending: false })

    return data || []
}

export async function deleteVocabularyItem(id: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Unauthorized')

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

export async function bulkDeleteVocab(ids: string[]) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')
    if (ids.length === 0) return { deleted: 0 }

    const { error, count } = await supabase
        .from('chinese_vocab_items')
        .delete({ count: 'exact' })
        .in('id', ids)
        .eq('user_id', user.id)
    if (error) throw new Error(error.message)

    revalidatePath('/vocabulary')
    revalidatePath('/review')
    return { deleted: count ?? 0 }
}

export async function bulkMarkKnown(ids: string[]) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')
    if (ids.length === 0) return { updated: 0 }

    const { error, count } = await supabase
        .from('chinese_vocab_items')
        .update({
            status: 'known',
            stability: 1.0,
            next_review: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }, { count: 'exact' })
        .in('id', ids)
        .eq('user_id', user.id)
    if (error) throw new Error(error.message)

    revalidatePath('/vocabulary')
    revalidatePath('/review')
    return { updated: count ?? 0 }
}

export async function bulkResetSchedule(ids: string[]) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')
    if (ids.length === 0) return { updated: 0 }

    const { error, count } = await supabase
        .from('chinese_vocab_items')
        .update({
            status: 'new',
            stability: 0,
            difficulty: 0,
            repetition_count: 0,
            lapses: 0,
            last_review: null,
            next_review: null,
        }, { count: 'exact' })
        .in('id', ids)
        .eq('user_id', user.id)
    if (error) throw new Error(error.message)

    revalidatePath('/vocabulary')
    revalidatePath('/review')
    return { updated: count ?? 0 }
}
