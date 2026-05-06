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
