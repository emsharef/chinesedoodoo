'use server'

import { createClient } from '@/utils/supabase/server'
import { lookupWord as llmLookupWord, type LLMProvider } from '@/lib/llm'

export async function lookupWord(word: string, language: string = 'zh-CN') {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Not authenticated')

    // Check if word exists in vocab
    const { data: existing } = await supabase
        .from('chinese_vocab_items')
        .select('*')
        .eq('user_id', user.id)
        .eq('word', word)
        .eq('language', language)
        .single()

    if (existing?.definition) {
        return {
            pinyin: existing.pinyin,
            english: existing.definition,
            isNew: false
        }
    }

    // Read provider preference
    const { data: profile } = await supabase
        .from('chinese_profiles')
        .select('llm_provider')
        .eq('id', user.id)
        .single()
    const provider: LLMProvider = (profile?.llm_provider as LLMProvider) || 'anthropic'

    const result = await llmLookupWord({ provider, word, language })

    // Save to vocab (status: learning)
    await supabase.from('chinese_vocab_items').upsert({
        user_id: user.id,
        word,
        pinyin: result.pinyin,
        definition: result.english,
        language: language,
        status: 'learning',
        next_review: new Date().toISOString()
    }, { onConflict: 'user_id, word, language' })

    return {
        ...result,
        isNew: true
    }
}
