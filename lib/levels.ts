// Per-language level label. Chinese stories report HSK 1-6; European
// languages use the closest CEFR equivalent (1=A1, 2=A2, 3=B1, 4=B2, 5=C1, 6=C2).

const CEFR_BY_LEVEL = ['A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']

export function levelLabel(language: string, level: number | null | undefined): string {
    if (level == null) return '?'
    const isChinese = language === 'zh-CN' || language === 'zh-TW'
    if (isChinese) return `HSK ${level}`
    const cefr = CEFR_BY_LEVEL[Math.max(0, Math.min(6, level))] ?? 'A1'
    return cefr
}
