// Shared segmentation. Chinese uses segmentit; other languages use a regex
// that keeps punctuation as separate segments so users can tap real words
// without dragging punctuation along.
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

export function segmentText(content: string, language: string): string[] {
    if (!content) return []
    const isChinese = language === 'zh-CN' || language === 'zh-TW'
    if (isChinese) {
        return getSegmentit().doSegment(content).map((s) => s.w)
    }
    return content.match(/[\wÀ-ÿ]+|[^\w\sÀ-ÿ]+|\s+/g) || [content]
}
