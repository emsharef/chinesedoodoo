import { getVocabulary } from './actions'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import VocabularyList from './VocabularyList'

export default async function VocabularyPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    const items = await getVocabulary()

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold text-retro-primary mb-8">Vocabulary</h1>
            <VocabularyList items={items} />
        </div>
    )
}
