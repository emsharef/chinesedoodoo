// Build the structured calibration prompt sent to the LLM.
// Replaces the old approach of dumping raw past-story text — we now compute the
// signal server-side and hand the model a clean summary.
//
// The output is a string fragment intended to be appended to the user prompt.

interface RecentStory {
    title: string
    content: string
    difficulty_rating: 'easy' | 'good' | 'hard' | null
    difficulty_level: number | null
    new_word_count?: number | null
    tapped_word_count?: number | null
}

interface CalibrationInput {
    targetLanguage: string
    targetLanguageName: string
    knownVocabCount: number
    learningWords: string[]
    recentStories: RecentStory[]
    unknownWordsInRecent: string[]
}

const RATING_OFFSET: Record<string, number> = {
    easy: 1.0,
    good: 0,
    hard: -0.5,
}

// Recency-weighted level inference. The most recent story counts fully (1.0),
// older stories decay by 0.7^i — so the 5-story trail weights are roughly
// [1.00, 0.70, 0.49, 0.34, 0.24]. A user whose recent ratings shift hard
// gets a sharper response than a flat median over the same trail would give.
//
// We also incorporate tap-density as a continuous secondary signal: a story rated
// EASY but with 30% words tapped is contradictory, and the level should drift
// down despite the rating. Concretely: every 10% of tapped words above 5%
// subtracts 0.2 levels.
export function inferLevel(stories: RecentStory[]): number | null {
    if (stories.length === 0) return null

    let weightSum = 0
    let levelSum = 0
    stories.forEach((s, i) => {
        const baseLevel = s.difficulty_level ?? 2
        const ratingOffset = RATING_OFFSET[s.difficulty_rating ?? 'good'] ?? 0

        // Tap-density correction. We need words-in-story to compute pct;
        // approximate via new + tapped (lower bound of seen words). When the
        // story didn't capture either, the correction is zero.
        const tapped = s.tapped_word_count ?? 0
        const totalWordsApprox = (s.new_word_count ?? 0) + tapped
        let tapCorrection = 0
        if (totalWordsApprox > 0 && tapped > 0) {
            const pct = tapped / totalWordsApprox
            // 5% tapped is "smooth read" baseline; every 10% above costs 0.2 levels
            tapCorrection = -Math.max(0, (pct - 0.05) / 0.1) * 0.2
        }

        const adjusted = baseLevel + ratingOffset + tapCorrection
        const weight = Math.pow(0.7, i)
        levelSum += adjusted * weight
        weightSum += weight
    })

    return levelSum / weightSum
}

export interface UserLevelSummary {
    level: number | null
    confidence: 'low' | 'medium' | 'high'
    storyCount: number
}

export function summarizeUserLevel(stories: RecentStory[]): UserLevelSummary {
    const level = inferLevel(stories)
    let confidence: 'low' | 'medium' | 'high' = 'low'
    if (stories.length >= 7) confidence = 'high'
    else if (stories.length >= 3) confidence = 'medium'
    return { level, confidence, storyCount: stories.length }
}

export function buildCalibrationContext(input: CalibrationInput): string {
    const { knownVocabCount, learningWords, recentStories, unknownWordsInRecent, targetLanguage, targetLanguageName } = input

    if (knownVocabCount < 20 && recentStories.length === 0) {
        const isChinese = targetLanguage === 'zh-CN' || targetLanguage === 'zh-TW'
        const level = isChinese ? 'HSK 1 (Beginner)' : 'CEFR A1 (Beginner)'
        return `
USER PROFILE
- This is a brand new ${targetLanguageName} learner. Treat as ${level}.
- Use very simple sentences and basic vocabulary. Introduce a few simple words.
`
    }

    const inferredLevel = inferLevel(recentStories)
    const recentSummary = recentStories
        .map((s, i) => {
            const rating = (s.difficulty_rating ?? 'unknown').toUpperCase()
            const tapped = s.tapped_word_count
            const newCount = s.new_word_count
            const tapNote =
                tapped !== null && tapped !== undefined && newCount !== null && newCount !== undefined
                    ? ` · tapped ${tapped} of ~${tapped + newCount} unknown`
                    : ''
            return `  ${i + 1}. "${s.title}" — ${rating} (level ${s.difficulty_level ?? '?'}${tapNote})`
        })
        .join('\n')

    const learningSample = learningWords.slice(0, 30).join(', ')
    const unknownSample = unknownWordsInRecent.slice(0, 30).join(', ')

    return `
USER PROFILE
- Target language: ${targetLanguageName} (${targetLanguage})
- Inferred level: ${inferredLevel !== null ? inferredLevel.toFixed(1) : 'unknown'} (recency-weighted, accounts for tap-density)
- Vocabulary known: ${knownVocabCount} words
- Vocabulary actively learning: ${learningWords.length} words${learningSample ? `: ${learningSample}` : ''}
- Recent reading (last ${recentStories.length}, newest first):
${recentSummary || '  (none)'}
- Words user did NOT know in recent stories: ${unknownSample || '(none)'}

CALIBRATION RULES
- The recent-reading list is ordered newest-first; the most recent story carries the most weight.
- "Tapped" means the user clicked the word for a definition while reading, i.e. they didn't know it.
- If recent ratings are EASY and tap rates are low (<10%), push slightly above the inferred level.
- If recent ratings are HARD or tap rates are high (>20%), drop to or below the inferred level.
- Rating and tap-rate can disagree — trust the tap rate more for objective difficulty.
- Naturally re-use words from the "actively learning" list and unknown-word list above when they fit the topic — do not force them.
- If the unknown-word backlog is large (>10), prioritize reviewing those over introducing new words.
`
}
