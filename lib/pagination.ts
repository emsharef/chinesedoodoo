// Paginate a segment list into "pages" for the Kindle-style reader.
//
// Strategy: greedy fill up to `targetChars`, then close the page on the next
// sentence terminator. We honor the terminator boundary so a page never ends
// mid-sentence (the natural reading-rhythm payoff outweighs the slight variance
// in page length).
//
// Pure function — no DOM. Caller picks the target based on viewport.

const SENTENCE_TERMINATORS = /[。.!?！？…]+["'”’)\]）】」』]?\s*$/

export interface PaginationOptions {
    targetChars: number // soft target — pages may overflow to reach a sentence end
    hardCap?: number // safety: force a break even mid-sentence past this many chars
}

function lengthOf(seg: string, language: string): number {
    // Chinese: every char counts. European: words count, so an entire word
    // segment counts as 1 (a single segment is already one word).
    const isChinese = language === 'zh-CN' || language === 'zh-TW'
    return isChinese ? seg.length : 1
}

function endsSentence(seg: string): boolean {
    return SENTENCE_TERMINATORS.test(seg)
}

export function paginate(
    segments: string[],
    language: string,
    options: PaginationOptions,
): string[][] {
    const { targetChars, hardCap = targetChars * 2 } = options
    if (segments.length === 0) return []

    const pages: string[][] = []
    let current: string[] = []
    let currentSize = 0

    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i]
        current.push(seg)
        currentSize += lengthOf(seg, language)

        const overTarget = currentSize >= targetChars
        const overHardCap = currentSize >= hardCap
        const closeNow = overTarget && endsSentence(seg)

        if (closeNow || overHardCap) {
            pages.push(current)
            current = []
            currentSize = 0
        }
    }

    if (current.length > 0) pages.push(current)
    return pages
}

// Reasonable defaults given a viewport width. The reader passes the actual
// width so we tune to mobile vs desktop without measuring DOM.
export function defaultTargetChars(viewportWidth: number, language: string): number {
    const isChinese = language === 'zh-CN' || language === 'zh-TW'
    if (viewportWidth < 640) {
        // Mobile — short pages keep a "swipe rhythm"
        return isChinese ? 150 : 90
    }
    // Desktop / tablet
    return isChinese ? 280 : 160
}
