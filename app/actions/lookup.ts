'use server'

import { createClient } from '@/utils/supabase/server'
import OpenAI from 'openai'

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

export async function lookupWord(word: string) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    // 1. Check if word exists in vocab_items (to see if we already have data, though we store definition in a separate dictionary table ideally, but for now we just return dynamic data)
    // Actually, we should check if we have a cached definition. 
    // For this MVP, we'll just ask OpenAI every time or cache it in a simple way? 
    // Let's ask OpenAI for now.

    const prompt = `
    Provide the Pinyin and English definition for the Chinese word: "${word}".
    Output JSON format:
    {
      "pinyin": "pinyin with tone marks",
      "english": "concise english definition"
    }
  `

    const completion = await openai.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'gpt-4o-mini', // Use mini for speed/cost
        response_format: { type: 'json_object' },
    })

    const result = JSON.parse(completion.choices[0].message.content || '{}')

    // 2. Add to vocab_items as "learning" if not exists
    // We use upsert to update last_review or status if needed, but primarily to ensure it's tracked.
    // If it's the first time clicking, it's "new" or "learning".

    const { data: existing } = await supabase
        .from('chinese_vocab_items')
        .select('status')
        .eq('user_id', user.id)
        .eq('word', word)
        .single()

    let isNew = false
    if (!existing) {
        await supabase.from('chinese_vocab_items').insert({
            user_id: user.id,
            word: word,
            definition: result.english,
            pinyin: result.pinyin,
            status: 'learning',
            // Initialize FSRS parameters
            difficulty: 0,
            stability: 0,
            retrievability: 0,
        })
        isNew = true
    }

    return {
        ...result,
        isNew,
    }
}
