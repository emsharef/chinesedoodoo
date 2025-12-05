'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import OpenAI from 'openai'

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
})

export async function generateStory(formData: FormData) {
    const genre = formData.get('genre') as string
    const theme = formData.get('theme') as string
    const setting = formData.get('setting') as string
    const length = formData.get('length') as string

    // Map length to approximate characters
    const lengthMap: Record<string, number> = {
        'short': 100,
        'medium': 300,
        'long': 600
    }
    const targetLength = lengthMap[length] || 300

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        throw new Error('Not authenticated')
    }

    // 1. Fetch User Stats & History
    // Check vocab size
    const { count: vocabCount } = await supabase
        .from('chinese_vocab_items')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'known')

    const isNewUser = (vocabCount || 0) < 20

    // Fetch last 3 read stories with ratings
    const { data: recentStories } = await supabase
        .from('chinese_stories')
        .select('title, content, difficulty_rating')
        .eq('user_id', user.id)
        .eq('is_read', true)
        .order('read_at', { ascending: false })
        .limit(3)

    // Fetch difficult words for review (low stability)
    const { data: difficultWords } = await supabase
        .from('chinese_vocab_items')
        .select('word')
        .eq('user_id', user.id)
        .lt('stability', 0.5)
        .limit(20)

    const reviewWords = difficultWords?.map(w => w.word) || []

    // Fetch all non-known words to check against recent stories
    let unknownWordsFromHistory: string[] = []
    if (recentStories && recentStories.length > 0) {
        const { data: learningWords } = await supabase
            .from('chinese_vocab_items')
            .select('word')
            .eq('user_id', user.id)
            .neq('status', 'known')

        if (learningWords) {
            // Check against all recent stories
            const allContent = recentStories.map(s => s.content).join(' ')
            unknownWordsFromHistory = learningWords
                .map(w => w.word)
                .filter(word => allContent.includes(word))
        }
    }

    // 2. Construct Prompt
    let systemPrompt = `You are an expert Chinese language teacher writing content for a student.`
    let userPrompt = `Write a short story or article in Chinese (Simplified).
    
    Parameters:
    - Genre: ${genre}
    - Topic: ${theme}
    - Setting: ${setting}
    - Target Length: Approximately ${targetLength} characters.
    `

    if (isNewUser) {
        userPrompt += `
        Target Level: HSK 1 (Beginner).
        Constraint: Use very simple sentences and basic vocabulary.
        New Words: Introduce a few simple words suitable for a beginner.
        `
    } else {
        const historyText = recentStories?.map((s, i) => `
        Story ${i + 1} (Rated: ${s.difficulty_rating || 'Unknown'}):
        """
        ${s.content.substring(0, 1000)}... (truncated)
        """
        `).join('\n') || 'None'

        userPrompt += `
        Context: The user has read stories before. 
        
        READING HISTORY (Last 3 Stories):
        ${historyText}

        WORDS USER DID NOT KNOW IN THESE STORIES:
        [${unknownWordsFromHistory.join(', ')}]
        
        Calibration Instruction:
        - Analyze the "READING HISTORY" and the ratings (Easy/Good/Hard).
        - If recent stories were rated 'Easy', INCREASE the difficulty: Use more precise vocabulary, less frequent words, and slightly more complex sentence structures.
        - If recent stories were rated 'Hard', DECREASE the difficulty: Use high-frequency words, simple S-V-O sentences, and high repetition.
        - If rated 'Good', maintain the current level but introduce new topics.
        - Do NOT rely on generic HSK levels. Calibrate specifically to this user's demonstrated ability and feedback.

        Vocabulary Strategy:
        1. Base Vocabulary: Use words the user likely knows based on the text above.
        2. Review Words: Select words from this list that naturally fit the context. Do not force them: ${reviewWords.join(', ')}.
        3. New Words: 
           - If the list of "WORDS USER DID NOT KNOW" is long (> 10), prioritize reviewing these words over introducing new ones.
           - If previous stories were 'Easy' but there are many unknown words, increase difficulty only MODESTLY (focus on consolidation).
           - Otherwise, introduce some NEW words that are slightly above their current calibrated level (i+1), appropriate for the story length.
        `
    }

    userPrompt += `
    Output JSON format:
    {
      "title": "Story Title in Chinese",
      "content": "The full story text in Chinese",
      "estimated_hsk_level": 1 // integer 1-6
    }
    `

    const completion = await openai.chat.completions.create({
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        model: 'gpt-5.1',
        response_format: { type: 'json_object' },
    })

    const result = JSON.parse(completion.choices[0].message.content || '{}')

    if (!result.title || !result.content) {
        throw new Error('Failed to generate story')
    }

    // Check debug mode
    const { data: profile } = await supabase
        .from('chinese_profiles')
        .select('debug_mode')
        .eq('id', user.id)
        .single()

    const { data: story, error } = await supabase
        .from('chinese_stories')
        .insert({
            user_id: user.id,
            title: result.title,
            content: result.content,
            difficulty_level: result.estimated_hsk_level || 1,
            debug_prompt: profile?.debug_mode ? `${systemPrompt}\n\n---\n\n${userPrompt}` : null
        })
        .select()
        .single()

    if (error) {
        console.error('Error saving story:', error)
        throw new Error(`Failed to save story: ${error.message} (${error.code})`)
    }

    return { success: true, storyId: story.id }
}
