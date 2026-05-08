'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Library, PlusCircle, BookOpen, Settings, List } from 'lucide-react'
import { Ma_Shan_Zheng, Yuji_Syuku, Gaegu, Caveat } from 'next/font/google'
import { createClient } from '@/utils/supabase/client'
import { getDueCount } from '@/app/review/actions'
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

export default function Sidebar() {
    const pathname = usePathname()
    const [dueCount, setDueCount] = useState<number | null>(null)
    const [targetLang, setTargetLang] = useState<string | null>(null)

    // Hide sidebar on login page
    const isPublic =
        pathname === '/login' ||
        pathname.startsWith('/login/') ||
        pathname === '/error' ||
        pathname.startsWith('/auth/')

    // Refresh due-count whenever the route changes (cheap COUNT query)
    useEffect(() => {
        if (isPublic) return
        let cancelled = false
        async function load() {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            const { data: profile } = await supabase
                .from('chinese_profiles')
                .select('target_language')
                .eq('id', user.id)
                .single()
            const lang = profile?.target_language || 'zh-CN'
            const count = await getDueCount(lang)
            if (!cancelled) {
                setDueCount(count)
                setTargetLang(lang)
            }
        }
        load()
        return () => {
            cancelled = true
        }
    }, [pathname, isPublic])

    if (isPublic) return null

    const links = [
        { href: '/', label: 'Library', icon: Library },
        { href: '/story/new', label: 'New Story', icon: PlusCircle },
        { href: '/review', label: 'Flashcards', icon: BookOpen, badge: dueCount },
        { href: '/vocabulary', label: 'Vocabulary', icon: List },
        { href: '/settings', label: 'Settings', icon: Settings },
    ]

    const branding = brandingFor(targetLang)

    return (
        <aside className="hidden md:flex w-64 bg-retro-paper border-r border-retro-muted/20 h-screen fixed left-0 top-0 flex-col p-6 z-40">
            <div className="mb-10">
                <h1 className={`${fontClassFor(branding.font)} text-4xl text-retro-primary tracking-wider`}>
                    {branding.title}
                </h1>
            </div>

            <nav className="flex-1 space-y-2">
                {links.map((link) => {
                    const Icon = link.icon
                    const isActive = pathname === link.href
                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`
                                flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200
                                ${isActive
                                    ? 'bg-retro-primary text-retro-bg font-bold shadow-md'
                                    : 'text-retro-text hover:bg-retro-primary/10 hover:text-retro-primary'
                                }
                            `}
                        >
                            <Icon size={20} />
                            <span className="flex-1">{link.label}</span>
                            {link.badge !== null && link.badge !== undefined && link.badge > 0 && (
                                <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${isActive ? 'bg-retro-bg/20' : 'bg-retro-accent/20 text-retro-accent'}`}>
                                    {link.badge}
                                </span>
                            )}
                        </Link>
                    )
                })}
            </nav>

            <div className="text-xs text-retro-muted text-center mt-auto space-y-1">
                <p>© 2025 ChineseDuDu</p>
                <p>
                    Chinese definitions from{' '}
                    <a
                        href="https://www.mdbg.net/chinese/dictionary?page=cc-cedict"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-retro-primary underline-offset-2 hover:underline"
                    >
                        CC-CEDICT
                    </a>
                    {' '}(CC BY-SA 4.0)
                </p>
            </div>
        </aside>
    )
}
