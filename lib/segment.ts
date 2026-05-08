// Shared segmentation. Each language gets segmentation appropriate to its
// script:
//   Chinese: segmentit (statistical word segmenter)
//   Japanese: script-grouping heuristic — kanji vs hiragana vs katakana runs
//             form natural word-ish segments without an external tokenizer
//   Korean + European: unicode-aware whitespace + punctuation split
//
// Punctuation and whitespace are kept as separate segments so taps land on
// real words rather than dragging trailing punctuation along.
//
// Safe to import from both server and client.

import { Segment, useDefault } from 'segmentit'

let cachedSegmentit: ReturnType<typeof useDefault> | null = null

function getSegmentit() {
    if (!cachedSegmentit) {
        cachedSegmentit = useDefault(new Segment())
    }
    return cachedSegmentit
}

// Japanese script-grouping segmenter. Walks the string character by character
// and starts a new segment whenever the script changes. This isn't a real
// morphological tokenizer (kuromoji would be better), but it produces
// reasonable-looking word units without the bundle weight: e.g.
//   "私は学生です。" → ["私", "は", "学生", "です", "。"]
function jpScriptOf(ch: string): string {
    const code = ch.codePointAt(0)
    if (code === undefined) return 'other'
    if (code >= 0x4e00 && code <= 0x9fff) return 'kanji'
    if (code >= 0x3040 && code <= 0x309f) return 'hira'
    if (code >= 0x30a0 && code <= 0x30ff) return 'kata'
    if (code >= 0xff66 && code <= 0xff9f) return 'kata' // half-width katakana
    if (/\s/.test(ch)) return 'space'
    if (/[\p{L}\p{N}]/u.test(ch)) return 'latin'
    return 'punct'
}

function segmentJapanese(text: string): string[] {
    const out: string[] = []
    let cur = ''
    let curScript: string | null = null
    for (const ch of Array.from(text)) {
        const s = jpScriptOf(ch)
        // Punctuation is always its own segment so taps don't pull it into a
        // word. Otherwise we extend the current run while the script matches.
        if (s !== curScript || s === 'punct' || curScript === 'punct') {
            if (cur) out.push(cur)
            cur = ch
            curScript = s
        } else {
            cur += ch
        }
    }
    if (cur) out.push(cur)
    return out
}

export function segmentText(content: string, language: string): string[] {
    if (!content) return []
    if (language === 'zh-CN' || language === 'zh-TW') {
        return getSegmentit().doSegment(content).map((s) => s.w)
    }
    if (language === 'ja') {
        return segmentJapanese(content)
    }
    // Korean + European: unicode-aware split. \p{L} covers Hangul too.
    return content.match(/[\p{L}\p{M}\p{N}]+|[^\p{L}\p{M}\p{N}\s]+|\s+/gu) || [content]
}
