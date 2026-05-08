// Localized app title shown in the sidebar and mobile header. The default
// "中文读读" was the original Chinese-only brand; for other languages we
// surface a native equivalent so the chrome reflects what the user is
// actually learning.

export type FontKey = 'chinese' | 'japanese' | 'korean' | 'latin'

export interface Branding {
    title: string
    font: FontKey
}

// All localizations preserve the "du" beat from 读读 (dúdú).
// CJK family carries the meaning across via the shared Sino root for "read":
//   读 (Chinese dú) = 読 (Japanese doku) = 독 (Korean dok)
// Asian titles use the suffix form ([Lang]读读) because that's the natural
// reading. European titles use a prefixed alliterative chant — DuDuDeutsch
// rolls off the tongue better than Deutsch DuDu, and "du" doubles as the
// German word for "you" so the joke lands twice.
const BRANDING: Record<string, Branding> = {
    'zh-CN': { title: '中文读读', font: 'chinese' },
    'zh-TW': { title: '中文讀讀', font: 'chinese' },
    ja: { title: '日本語ドクドク', font: 'japanese' },
    ko: { title: '한국어 독독', font: 'korean' },
    de: { title: 'DuDuDeutsch', font: 'latin' },
    it: { title: 'DuDuItaliano', font: 'latin' },
    es: { title: 'DuDuEspañol', font: 'latin' },
}

export function brandingFor(language: string | null | undefined): Branding {
    if (language && BRANDING[language]) return BRANDING[language]
    return BRANDING['zh-CN']
}
