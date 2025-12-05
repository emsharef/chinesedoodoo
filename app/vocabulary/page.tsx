
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import VocabularyList from './VocabularyList'

export default async function VocabularyPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')



    const { data: profile } = await supabase
        .from('chinese_profiles')
        .select('target_language')
        .eq('id', user.id)
        .single()

    const targetLang = profile?.target_language || 'zh-CN'

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold text-retro-primary mb-8">Vocabulary</h1>
            <VocabularyList language={targetLang} />
        </div>
    )
}
