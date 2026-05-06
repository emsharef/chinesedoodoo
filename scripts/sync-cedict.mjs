// Download CC-CEDICT, convert pinyin tone numbers to tone marks,
// and write a flat lookup map to lib/dictionary/data/cedict.json.
//
// Usage:  node scripts/sync-cedict.mjs
//
// Run manually whenever you want to refresh the dictionary.

import { writeFileSync, mkdirSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCE_URL = 'https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = resolve(__dirname, '../lib/dictionary/data/cedict.json')

const TONE_MARKS = {
    a: ['a', 'ā', 'á', 'ǎ', 'à', 'a'],
    e: ['e', 'ē', 'é', 'ě', 'è', 'e'],
    i: ['i', 'ī', 'í', 'ǐ', 'ì', 'i'],
    o: ['o', 'ō', 'ó', 'ǒ', 'ò', 'o'],
    u: ['u', 'ū', 'ú', 'ǔ', 'ù', 'u'],
    ü: ['ü', 'ǖ', 'ǘ', 'ǚ', 'ǜ', 'ü'],
    A: ['A', 'Ā', 'Á', 'Ǎ', 'À', 'A'],
    E: ['E', 'Ē', 'É', 'Ě', 'È', 'E'],
    I: ['I', 'Ī', 'Í', 'Ǐ', 'Ì', 'I'],
    O: ['O', 'Ō', 'Ó', 'Ǒ', 'Ò', 'O'],
    U: ['U', 'Ū', 'Ú', 'Ǔ', 'Ù', 'U'],
}

function convertSyllable(raw) {
    const m = raw.match(/^(.+?)([0-5])?$/)
    if (!m) return raw
    let body = m[1].replace(/u:/g, 'ü').replace(/U:/g, 'Ü')
    const tone = m[2] ? parseInt(m[2], 10) : 0
    if (tone === 0 || tone === 5) return body

    // Tone-mark placement: a > e > the last vowel; the syllable "ou" gets the mark on the o.
    const vowels = 'aeiouüAEIOUÜ'
    let idx = -1
    for (const v of ['a', 'A', 'e', 'E']) {
        const i = body.indexOf(v)
        if (i >= 0) {
            idx = i
            break
        }
    }
    if (idx < 0) {
        const oIdx = body.search(/[oO]/)
        if (oIdx >= 0) idx = oIdx
    }
    if (idx < 0) {
        for (let i = body.length - 1; i >= 0; i--) {
            if (vowels.includes(body[i])) {
                idx = i
                break
            }
        }
    }
    if (idx < 0) return body

    const ch = body[idx]
    const marked = TONE_MARKS[ch]
    if (!marked) return body
    return body.slice(0, idx) + marked[tone] + body.slice(idx + 1)
}

function convertPinyin(s) {
    return s.split(/\s+/).map(convertSyllable).join(' ').toLowerCase()
}

async function main() {
    console.log(`Fetching ${SOURCE_URL}…`)
    const response = await fetch(SOURCE_URL)
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`)
    }
    const compressed = Buffer.from(await response.arrayBuffer())
    console.log(`Downloaded ${compressed.length} bytes; decompressing…`)
    const text = gunzipSync(compressed).toString('utf8')
    const lines = text.split('\n')

    // Format: 中國 中国 [Zhong1 guo2] /China/Middle Kingdom/
    const lineRe = /^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\/(.+)\/\s*$/

    /** @type {Record<string, {pinyin: string, definitions: string[], traditional?: string}>} */
    const map = {}
    let parsed = 0
    let skipped = 0

    for (const line of lines) {
        if (!line || line.startsWith('#')) continue
        const m = line.match(lineRe)
        if (!m) {
            skipped++
            continue
        }
        const [, traditional, simplified, rawPinyin, defsStr] = m
        const pinyin = convertPinyin(rawPinyin)
        const definitions = defsStr.split('/').filter(Boolean)
        // Skip "surname X" / "variant of …" only definitions; keep them but de-prioritize
        const entry = { pinyin, definitions, traditional }
        // Index by simplified (primary) and traditional (alias)
        if (!map[simplified]) map[simplified] = entry
        if (traditional !== simplified && !map[traditional]) map[traditional] = entry
        parsed++
    }

    console.log(`Parsed ${parsed} entries; skipped ${skipped} unparseable lines.`)
    console.log(`Total unique keys (incl. trad+simp): ${Object.keys(map).length}`)

    mkdirSync(dirname(OUT_PATH), { recursive: true })
    writeFileSync(OUT_PATH, JSON.stringify(map))
    const sizeKb = (Buffer.byteLength(JSON.stringify(map)) / 1024).toFixed(0)
    console.log(`Wrote ${OUT_PATH} (${sizeKb} KB).`)
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
