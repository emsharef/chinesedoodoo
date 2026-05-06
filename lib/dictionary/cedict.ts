// Server-side CC-CEDICT lookup. Loads ~25MB JSON into memory on first call;
// roughly 200k entries indexed by both simplified and traditional. Public domain
// dictionary licensed CC BY-SA 4.0 — see the project README for attribution.
//
// Refresh via `node scripts/sync-cedict.mjs` (writes lib/dictionary/data/cedict.json).

import fs from 'node:fs'
import path from 'node:path'

interface CedictEntry {
    pinyin: string
    definitions: string[]
    traditional?: string
}

let cache: Record<string, CedictEntry> | null = null

function loadDict(): Record<string, CedictEntry> {
    if (cache) return cache
    const filePath = path.join(process.cwd(), 'lib/dictionary/data/cedict.json')
    const raw = fs.readFileSync(filePath, 'utf8')
    cache = JSON.parse(raw)
    return cache!
}

export interface CedictLookup {
    pinyin: string
    english: string
}

/**
 * Look up a Chinese word (simplified or traditional). Returns {pinyin, english}
 * with up to the first three definitions joined by "; ", or null if absent.
 *
 * Surname-only and "variant of …" / "old variant of …" entries are skipped if
 * a more substantive definition is also present in the entry.
 */
export function lookupCedict(word: string): CedictLookup | null {
    const dict = loadDict()
    const entry = dict[word]
    if (!entry) return null

    // Filter out boilerplate definitions when there's a real one available.
    const boilerplateRe = /^(surname\s|variant of |old variant of |used in |see )/i
    const real = entry.definitions.filter((d) => !boilerplateRe.test(d))
    const picked = (real.length > 0 ? real : entry.definitions).slice(0, 3)
    const english = picked.join('; ')

    return { pinyin: entry.pinyin, english }
}
