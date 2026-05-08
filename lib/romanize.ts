// Per-language phonetic helpers used by the Reader's pinyin/romanization
// overlay. Chinese has pinyin-pro (live conversion). Korean has a rule-based
// Revised Romanization table. Japanese has no live conversion — readings
// come from the per-user vocab cache (LLM-provided on lookup).

// Hangul syllable block: 0xAC00–0xD7A3.
// Each syllable = 0xAC00 + (initial × 21 + medial) × 28 + final
//   19 initials × 21 medials × 28 finals (incl. null) = 11,172 syllables.

const KO_INITIALS = [
    'g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss',
    '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h',
]

const KO_MEDIALS = [
    'a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae',
    'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i',
]

// Final consonant romanizations differ from the same letters in initial
// position (e.g. ㄱ is "g" initially but "k" finally).
const KO_FINALS = [
    '', 'k', 'kk', 'k', 'n', 'n', 'n', 't', 'l', 'k', 'm',
    'l', 'l', 'l', 'p', 'l', 'm', 'p', 'p', 't', 't', 'ng',
    't', 't', 'k', 't', 'p', 't',
]

// Character-by-character transliteration. Doesn't model the inter-syllable
// assimilation rules of full Revised Romanization (좋다 → "jota" rather than
// "johda" etc). Close enough for a reading aid; learners can layer on the
// real pronunciation as they go.
export function romanizeKorean(text: string): string {
    let out = ''
    for (const ch of text) {
        const code = ch.codePointAt(0)
        if (code === undefined) continue
        if (code < 0xac00 || code > 0xd7a3) {
            out += ch
            continue
        }
        const offset = code - 0xac00
        const initial = Math.floor(offset / (21 * 28))
        const medial = Math.floor((offset % (21 * 28)) / 28)
        const final = offset % 28
        out += KO_INITIALS[initial] + KO_MEDIALS[medial] + KO_FINALS[final]
    }
    return out
}

export function hasHangul(text: string): boolean {
    for (const ch of text) {
        const code = ch.codePointAt(0)
        if (code !== undefined && code >= 0xac00 && code <= 0xd7a3) return true
    }
    return false
}

export function hasKanji(text: string): boolean {
    for (const ch of text) {
        const code = ch.codePointAt(0)
        if (code !== undefined && code >= 0x4e00 && code <= 0x9fff) return true
    }
    return false
}

// Returns true if the language has any phonetic overlay we can render. Used
// to decide whether to show the toggle button at all.
export function hasPhonetic(language: string): boolean {
    return (
        language === 'zh-CN' ||
        language === 'zh-TW' ||
        language === 'ko' ||
        language === 'ja'
    )
}
