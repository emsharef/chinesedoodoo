'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Ma_Shan_Zheng, Yuji_Syuku, Gaegu, Caveat } from 'next/font/google'
import { createClient } from '@/utils/supabase/client'
import { brandingFor, type FontKey } from '@/lib/branding'

const chineseFont = Ma_Shan_Zheng({ weight: '400', subsets: ['latin'], preload: true })
const japaneseFont = Yuji_Syuku({ weight: '400', subsets: ['latin'], preload: false })
const koreanFont = Gaegu({ weight: '700', subsets: ['latin'], preload: false })
const latinFont = Caveat({ subsets: ['latin'], preload: false })

function fontClassFor(key: FontKey): string {
    if (key === 'chinese') return chineseFont.className
    if (key === 'japanese') return japaneseFont.className
    if (key === 'korean') return koreanFont.className
    return latinFont.className
}

export default function MobileHeader() {
    const pathname = usePathname()
    const [targetLang, setTargetLang] = useState<string | null>(null)

    const isPublic =
        pathname === '/login' ||
        pathname === '/login/check-email' ||
        pathname.startsWith('/login/') ||
        pathname === '/error' ||
        pathname.startsWith('/auth/')

    useEffect(() => {
        if (isPublic) return
        let cancelled = false
        ;(async () => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            const { data: profile } = await supabase
                .from('chinese_profiles')
                .select('target_language')
                .eq('id', user.id)
                .single()
            if (!cancelled) setTargetLang(profile?.target_language || 'zh-CN')
        })()
        return () => {
            cancelled = true
        }
    }, [pathname, isPublic])

    if (isPublic) return null

    const branding = brandingFor(targetLang)

    return (
        <header className="fixed top-0 left-0 right-0 h-16 bg-retro-paper border-b border-retro-muted/20 flex items-center justify-center md:hidden z-40">
            <h1 className={`${fontClassFor(branding.font)} text-3xl text-retro-primary tracking-wider`}>
                {branding.title}
            </h1>
        </header>
    )
}
