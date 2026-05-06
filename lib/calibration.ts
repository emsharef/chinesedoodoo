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

function inferLevel(stories: RecentStory[]): number | null {
    if (stories.length === 0) return null
    const adjusted = stories
        .map((s) => {
            const lvl = s.difficulty_level ?? 2
            const offset = RATING_OFFSET[s.difficulty_rating ?? 'good'] ?? 0
            return lvl + offset
        })
        .sort((a, b) => a - b)
    const mid = Math.floor(adjusted.length / 2)
    return adjusted.length % 2 === 0
        ? (adjusted[mid - 1] + adjusted[mid]) / 2
        : adjusted[mid]
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
            return `  ${i + 1}. "${s.title}" — ${rating} (level ${s.difficulty_level ?? '?'})`
        })
        .join('\n')

    const learningSample = learningWords.slice(0, 30).join(', ')
    const unknownSample = unknownWordsInRecent.slice(0, 30).join(', ')

    return `
USER PROFILE
- Target language: ${targetLanguageName} (${targetLanguage})
- Inferred level: ${inferredLevel !== null ? inferredLevel.toFixed(1) : 'unknown'} (weighted median of recent ratings)
- Vocabulary known: ${knownVocabCount} words
- Vocabulary actively learning: ${learningWords.length} words${learningSample ? `: ${learningSample}` : ''}
- Recent reading (last ${recentStories.length}):
${recentSummary || '  (none)'}
- Words user did NOT know in recent stories: ${unknownSample || '(none)'}

CALIBRATION RULES
- If the last 3 ratings are mostly EASY, push slightly above the inferred level.
- If the last 3 ratings are mostly HARD, drop to the inferred level.
- If mixed, maintain the inferred level but introduce new topics.
- Naturally re-use words from the "actively learning" list and unknown-word list above when they fit the topic — do not force them.
- If the unknown-word backlog is large (>10), prioritize reviewing those over introducing new words.
`
}
