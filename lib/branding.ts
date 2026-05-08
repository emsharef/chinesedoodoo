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
// Reduplicating those gives a sound-and-sense match.
// European titles keep DuDu as a brand suffix — no native "du-for-read" to
// translate, but DuDu travels well as a name. German bonus: "du" = "you".
const BRANDING: Record<string, Branding> = {
    'zh-CN': { title: '中文读读', font: 'chinese' },
    'zh-TW': { title: '中文讀讀', font: 'chinese' },
    ja: { title: '日本語ドクドク', font: 'japanese' },
    ko: { title: '한국어 독독', font: 'korean' },
    de: { title: 'Deutsch DuDu', font: 'latin' },
    it: { title: 'Italiano DuDu', font: 'latin' },
    es: { title: 'Español DuDu', font: 'latin' },
}

export function brandingFor(language: string | null | undefined): Branding {
    if (language && BRANDING[language]) return BRANDING[language]
    return BRANDING['zh-CN']
}
