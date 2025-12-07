'use server'

import { createClient } from '@/utils/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

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

    // If not, ask OpenAI
    const isChinese = language === 'zh-CN' || language === 'zh-TW'
    const pronunciationInstruction = isChinese
        ? "pinyin with tone marks"
        : "phonetic pronunciation (IPA or standard transcription)"

    const prompt = `Define the word "${word}" (Language: ${language}).
    Output JSON: { "pinyin": "${pronunciationInstruction}", "english": "concise english definition" }`

    const completion = await openai.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'gpt-5-mini',
        response_format: { type: 'json_object' },
    })

    const result = JSON.parse(completion.choices[0].message.content || '{}')

    // Save to vocab (status: learning)
    await supabase.from('chinese_vocab_items').upsert({
        user_id: user.id,
        word,
        pinyin: result.pinyin,
        definition: result.english,
        language: language,
        status: 'learning',
        next_review: new Date().toISOString()
    }, { onConflict: 'user_id, word' }) // Note: Using existing constraint for now

    return {
        ...result,
        isNew: true
    }
}
