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
    // Already ordered by recency (most recent first). Full list when knownVocabCount
    // is small; a 30-word recency sample when large. Rendering decides the label.
    knownWords: string[]
    learningWords: string[]
    recentStories: RecentStory[]
    // When set, override the inferred level — user pinned a target.
    manualLevel?: number
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

const HSK_RUBRIC = `LEVEL SCALE (Chinese, HSK 1-6):
- 1 = HSK 1: ~150 most common chars; basic SVO present-tense; 5-10 chars per sentence
- 2 = HSK 2: ~300 chars; particles 了/过, simple time expressions, basic questions
- 3 = HSK 3: ~600 chars; complex sentences, opinions, more connectives
- 4 = HSK 4: ~1200 chars; abstract topics, opinion + argumentation
- 5 = HSK 5: ~2500 chars; news/literary register, idioms, sophisticated grammar
- 6 = HSK 6: ~5000 chars; advanced literary/news, native-level reading`

const CEFR_RUBRIC = `LEVEL SCALE (CEFR A1-C2 mapped to 1-6):
- 1 = A1: ~500 most common words; present tense; simple SVO; basic personal info
- 2 = A2: ~1000 words; past tense, daily routines, basic descriptions
- 3 = B1: ~2000 words; future + conditional; opinions on familiar topics
- 4 = B2: ~4000 words; complex grammar, abstract topics, argumentation
- 5 = C1: ~8000 words; idiomatic, nuanced expression, varied registers
- 6 = C2: full range; literary/professional native-level reading`

function rubricFor(language: string): string {
    const isChinese = language === 'zh-CN' || language === 'zh-TW'
    return isChinese ? HSK_RUBRIC : CEFR_RUBRIC
}

function storyLength(content: string, language: string): number {
    const isChinese = language === 'zh-CN' || language === 'zh-TW'
    if (isChinese) {
        // Count Chinese characters only — punctuation/whitespace don't count
        return Array.from(content).filter((c) => /[一-鿿]/.test(c)).length
    }
    return content.split(/\s+/).filter(Boolean).length
}

function lengthUnitFor(language: string): string {
    const isChinese = language === 'zh-CN' || language === 'zh-TW'
    return isChinese ? 'chars' : 'words'
}

function excerptOf(content: string, language: string, maxLen = 200): string {
    const isChinese = language === 'zh-CN' || language === 'zh-TW'
    if (content.length <= maxLen) return content.trim()
    if (isChinese) return content.slice(0, maxLen).trim() + '…'
    // Avoid cutting mid-word in European languages
    const truncated = content.slice(0, maxLen)
    const lastSpace = truncated.lastIndexOf(' ')
    return (lastSpace > maxLen * 0.6 ? truncated.slice(0, lastSpace) : truncated).trim() + '…'
}

function levelLabel(language: string, level: number): string {
    const isChinese = language === 'zh-CN' || language === 'zh-TW'
    if (isChinese) return `HSK ${level}`
    const cefr = ['A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'][Math.max(0, Math.min(6, level))]
    return cefr ?? 'A1'
}

export function buildCalibrationContext(input: CalibrationInput): string {
    const { knownVocabCount, knownWords, learningWords, recentStories, targetLanguage, targetLanguageName, manualLevel } = input

    if (knownVocabCount < 20 && recentStories.length === 0 && manualLevel === undefined) {
        const isChinese = targetLanguage === 'zh-CN' || targetLanguage === 'zh-TW'
        const level = isChinese ? 'HSK 1 (Beginner)' : 'CEFR A1 (Beginner)'
        return `
USER PROFILE
- This is a brand new ${targetLanguageName} learner. Treat as ${level}.
- Use very simple sentences and basic vocabulary. Introduce a few simple words.

${rubricFor(targetLanguage)}
`
    }

    const inferredLevel = inferLevel(recentStories)
    const lengthUnit = lengthUnitFor(targetLanguage)

    const recentBlocks = recentStories
        .map((s, i) => {
            const rating = (s.difficulty_rating ?? 'unknown').toUpperCase()
            const tapped = s.tapped_word_count
            const newCount = s.new_word_count
            const tapNote =
                tapped !== null && tapped !== undefined && newCount !== null && newCount !== undefined
                    ? ` · tapped ${tapped} of ~${tapped + newCount} unknown`
                    : ''
            const len = storyLength(s.content, targetLanguage)
            const exc = excerptOf(s.content, targetLanguage, 200)
            return `  ${i + 1}. "${s.title}" — ${rating} (level ${s.difficulty_level ?? '?'}, ${len} ${lengthUnit})${tapNote}
     ${exc}`
        })
        .join('\n\n')

    const isFullKnownList = knownWords.length > 0 && knownWords.length >= knownVocabCount
    const knownLine =
        knownWords.length === 0
            ? `- Vocabulary known: ${knownVocabCount} words`
            : isFullKnownList
                ? `- Vocabulary known (${knownVocabCount} words, all listed): ${knownWords.join(', ')}`
                : `- Vocabulary known: ${knownVocabCount} words. Most recently encountered (sample of ${knownWords.length}): ${knownWords.join(', ')}`

    const learningLine =
        learningWords.length === 0
            ? '- Vocabulary actively learning: 0 words'
            : `- Vocabulary actively learning: ${learningWords.length} words: ${learningWords.slice(0, 30).join(', ')}`

    const levelSection =
        manualLevel !== undefined
            ? `- TARGET LEVEL: ${levelLabel(targetLanguage, manualLevel)} (level ${manualLevel}) — user has pinned this level. Write at exactly this level regardless of recent ratings.
- Inferred level (for reference only): ${inferredLevel !== null ? inferredLevel.toFixed(1) : 'unknown'}`
            : `- Inferred level: ${inferredLevel !== null ? inferredLevel.toFixed(1) : 'unknown'} (recency-weighted, accounts for tap-density)`

    const calibrationRules =
        manualLevel !== undefined
            ? `CALIBRATION RULES
- The user has pinned the target level above — write at exactly that level. Do not push above or drop below based on recent ratings.
- Recent stories are shown for vocabulary anchoring, not difficulty calibration.
- Naturally re-use words from the "actively learning" list when they fit the topic — do not force them.`
            : `CALIBRATION RULES
- The recent-reading list is ordered newest-first; the most recent story carries the most weight. Use the excerpts as concrete anchors for what the user can read at this level.
- "Tapped" means the user clicked the word for a definition while reading, i.e. they didn't know it.
- If recent ratings are EASY and tap rates are low (<10%), push slightly above the inferred level.
- If recent ratings are HARD or tap rates are high (>20%), drop to or below the inferred level.
- Rating and tap-rate can disagree — trust the tap rate more for objective difficulty.
- Naturally re-use words from the "actively learning" list when they fit the topic — do not force them.`

    return `
USER PROFILE
- Target language: ${targetLanguageName} (${targetLanguage})
${levelSection}

${rubricFor(targetLanguage)}

${knownLine}
${learningLine}

- Recent reading (last ${recentStories.length}, newest first):
${recentBlocks || '  (none)'}

${calibrationRules}
`
}
