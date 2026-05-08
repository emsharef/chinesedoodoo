// Localized app title shown in the sidebar and mobile header. The default
// "中文读读" was the original Chinese-only brand; for other languages we
// surface a native equivalent so the chrome reflects what the user is
// actually learning.

export type FontKey = 'chinese' | 'japanese' | 'korean' | 'latin'

export interface Branding {
    title: string
    font: FontKey
}

const BRANDING: Record<string, Branding> = {
    'zh-CN': { title: '中文读读', font: 'chinese' },
    'zh-TW': { title: '中文讀讀', font: 'chinese' },
    ja: { title: '日本語よみよみ', font: 'japanese' },
    ko: { title: '한국어 읽기', font: 'korean' },
    de: { title: 'Deutsch lesen', font: 'latin' },
    it: { title: 'Leggi italiano', font: 'latin' },
    es: { title: 'Leer español', font: 'latin' },
}

export function brandingFor(language: string | null | undefined): Branding {
    if (language && BRANDING[language]) return BRANDING[language]
    return BRANDING['zh-CN']
}
