'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import OpenAI from 'openai'

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

export async function generateStory(formData: FormData) {
    const topic = formData.get('topic') as string
    const level = parseInt(formData.get('level') as string)

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        throw new Error('Not authenticated')
    }

    // TODO: Fetch user's known words to customize the prompt
    // For now, just use generic HSK level

    const prompt = `
    Write a short story in Chinese (Simplified) about "${topic}".
    Target level: HSK ${level}.
    Constraint: 95% of words should be within HSK ${level} or below.
    Include 3-5 slightly more advanced words to challenge the reader.
    
    Output JSON format:
    {
      "title": "Story Title in Chinese",
      "content": "The full story text in Chinese"
    }
  `

    const completion = await openai.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
    })

    const result = JSON.parse(completion.choices[0].message.content || '{}')

    if (!result.title || !result.content) {
        throw new Error('Failed to generate story')
    }

    const { data: story, error } = await supabase
        .from('chinese_stories')
        .insert({
            user_id: user.id,
            title: result.title,
            content: result.content,
            difficulty_level: level,
        })
        .select()
        .single()

    if (error) {
        console.error('Error saving story:', error)
        throw new Error(`Failed to save story: ${error.message} (${error.code})`)
    }

    redirect(`/story/${story.id}`)
}
