'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

export async function deleteStory(storyId: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Unauthorized' }

    const { error } = await supabase
        .from('chinese_stories')
        .delete()
        .eq('id', storyId)
        .eq('user_id', user.id)

    if (error) return { success: false, error: error.message }
    revalidatePath('/')
    return { success: true }
}
