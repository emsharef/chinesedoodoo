'use server'

import { createClient } from '@/utils/supabase/server'
import { FSRS, Card, Rating } from 'fsrs.js'
import { lookupWord } from '@/app/actions/lookup'

const fsrs = new FSRS()

export async function getDueCards(language: string = 'zh-CN') {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const now = new Date().toISOString()

    // Fetch items where next_review < now OR next_review is null (new items)
    // Actually, 'new' items might have null next_review.
    // Let's fetch all 'learning' or 'review' items due, plus some 'new' items.

    const { data: items } = await supabase
        .from('chinese_vocab_items')
        .select('*')
        .eq('user_id', user.id)
        .eq('language', language)
        .in('status', ['new', 'learning', 'review', 'relearning'])
        .or(`next_review.lte.${now},next_review.is.null`)
        .limit(20) // Limit session size

    // We need definitions for these words to show on the back of the card.
    // Since we don't store definitions permanently yet (we just looked them up dynamically),
    // we might need to re-fetch them or store them.
    // Optimization: Store definition in vocab_items or a separate dictionary table.
    // For now, let's just fetch them dynamically if missing (slow but works for MVP).
    // Actually, let's just return the items and let the client fetch definition on "Show Answer".

    return items || []
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
        scheduled_days: 0, // Not stored in DB directly, but needed for type? FSRS might calculate it.
        reps: item.repetition_count,
        lapses: 0, // We didn't store lapses, assume 0 or add column
        state: (item.status === 'new' || !item.last_review) ? 0 : item.status === 'learning' ? 1 : item.status === 'review' ? 2 : 3, // 0=New, 1=Learning, 2=Review, 3=Relearning
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
