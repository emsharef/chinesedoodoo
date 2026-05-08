// Per-language level label. Levels are an internal 1-6 scale that we map onto
// each language's standard scheme:
//   Chinese (zh-CN, zh-TW): HSK 1-6
//   Korean (ko):             TOPIK 1-6
//   Japanese (ja):           JLPT N5..N1 (5 levels) + N1+ for our level 6
//   European (de, it, es):   CEFR A1, A2, B1, B2, C1, C2

const CEFR_BY_LEVEL = ['A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const JLPT_BY_LEVEL = ['N5', 'N5', 'N4', 'N3', 'N2', 'N1', 'N1+']

export function isCharCountedLang(language: string): boolean {
    // Langs where length is naturally counted in characters (no spaces between
    // words). Korean uses spaces, so it's word-counted.
    return language === 'zh-CN' || language === 'zh-TW' || language === 'ja'
}

export function levelLabel(language: string, level: number | null | undefined): string {
    if (level == null) return '?'
    const n = Math.max(1, Math.min(6, level))
    if (language === 'zh-CN' || language === 'zh-TW') return `HSK ${n}`
    if (language === 'ko') return `TOPIK ${n}`
    if (language === 'ja') return `JLPT ${JLPT_BY_LEVEL[n] ?? 'N5'}`
    return CEFR_BY_LEVEL[n] ?? 'A1'
}
