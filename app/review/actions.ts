'use server'

import { createClient } from '@/utils/supabase/server'
import { FSRS, Card, Rating } from 'fsrs.js'

const fsrs = new FSRS()

export async function getReviewQueue(language: string = 'zh-CN', limit: number = 30) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { items: [], dueCount: 0, newCount: 0, learningCount: 0 }

    const now = new Date().toISOString()

    // Counts (head-only queries, no row data)
    const [{ count: dueCount }, { count: newCount }, { count: learningCount }] = await Promise.all([
        supabase
            .from('chinese_vocab_items')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('language', language)
            .in('status', ['learning', 'review', 'relearning'])
            .lte('next_review', now),
        supabase
            .from('chinese_vocab_items')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('language', language)
            .eq('status', 'new'),
        supabase
            .from('chinese_vocab_items')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .eq('language', language)
            .eq('status', 'learning'),
    ])

    const { data: items } = await supabase
        .from('chinese_vocab_items')
        .select('*')
        .eq('user_id', user.id)
        .eq('language', language)
        .in('status', ['new', 'learning', 'review', 'relearning'])
        .or(`next_review.lte.${now},next_review.is.null`)
        .order('next_review', { ascending: true, nullsFirst: false })
        .limit(limit)

    return {
        items: items ?? [],
        dueCount: dueCount ?? 0,
        newCount: newCount ?? 0,
        learningCount: learningCount ?? 0,
    }
}

// Find an example sentence by scanning the user's recent stories for one that contains the word.
export async function findExampleSentence(word: string, language: string = 'zh-CN'): Promise<string | null> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data: stories } = await supabase
        .from('chinese_stories')
        .select('content')
        .eq('user_id', user.id)
        .eq('language', language)
        .order('created_at', { ascending: false })
        .limit(10)

    if (!stories) return null
    const isChinese = language === 'zh-CN' || language === 'zh-TW'
    const sentenceSplit = isChinese ? /(?<=[。！？])/u : /(?<=[.!?])\s+/u

    for (const story of stories) {
        const sentences = story.content.split(sentenceSplit) as string[]
        const match = sentences.find((s) => s.includes(word))
        if (match && match.length > 0 && match.length < 200) {
            return match.trim()
        }
    }
    return null
}

export async function submitReview(itemId: string, rating: number) {
    // rating: 1=Again, 2=Hard, 3=Good, 4=Easy
    const supabase = await createClient()
    const { data: item } = await supabase
        .from('chinese_vocab_items')
        .select('*')
        .eq('id', itemId)
        .single()

    if (!item) throw new Error('Item not found')

    // Construct FSRS Card object
    const card: Card = {
        due: item.next_review ? new Date(item.next_review) : new Date(),
        stability: item.stability,
        difficulty: item.difficulty,
        elapsed_days: item.last_review ? (Date.now() - new Date(item.last_review).getTime()) / (1000 * 60 * 60 * 24) : 0,
        scheduled_days: 0,
        reps: item.repetition_count,
        lapses: item.lapses ?? 0,
        state: (item.status === 'new' || !item.last_review) ? 0 : item.status === 'learning' ? 1 : item.status === 'review' ? 2 : 3,
        last_review: item.last_review ? new Date(item.last_review) : undefined as any,
    }

    // Calculate new state
    // Map our 1-4 rating to FSRS Rating enum (Again=1, Hard=2, Good=3, Easy=4)
    const fRating = rating as Rating
    const schedulingCards = fsrs.repeat(card, new Date())
    const newCard = schedulingCards[fRating].card

    // Update DB
    await supabase
        .from('chinese_vocab_items')
        .update({
            stability: newCard.stability,
            difficulty: newCard.difficulty,
            repetition_count: newCard.reps,
            lapses: newCard.lapses,
            last_review: new Date().toISOString(),
            next_review: newCard.due.toISOString(),
            status: newCard.state === 0 ? 'new' : newCard.state === 1 ? 'learning' : newCard.state === 2 ? 'review' : 'relearning',
        })
        .eq('id', itemId)

    // Log review
    await supabase.from('chinese_reviews').insert({
        user_id: item.user_id,
        vocab_item_id: itemId,
        rating,
    })

    return { success: true }
}

export async function getDueCount(language: string = 'zh-CN') {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 0

    const { count } = await supabase
        .from('chinese_vocab_items')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('language', language)
        .in('status', ['learning', 'review', 'relearning'])
        .lte('next_review', new Date().toISOString())

    return count ?? 0
}
