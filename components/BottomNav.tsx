'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Library, PlusCircle, BookOpen, Settings, List } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { getDueCount } from '@/app/review/actions'

export default function BottomNav() {
    const pathname = usePathname()
    const [dueCount, setDueCount] = useState<number | null>(null)

    const isPublic =
        pathname === '/login' ||
        pathname.startsWith('/login/') ||
        pathname === '/error' ||
        pathname.startsWith('/auth/')

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
            if (!cancelled) setDueCount(count)
        }
        load()
        return () => {
            cancelled = true
        }
    }, [pathname, isPublic])

    if (isPublic) return null

    const links = [
        { href: '/', label: 'Library', icon: Library },
        { href: '/story/new', label: 'New', icon: PlusCircle },
        { href: '/review', label: 'Review', icon: BookOpen, badge: dueCount },
        { href: '/vocabulary', label: 'Vocab', icon: List },
        { href: '/settings', label: 'Settings', icon: Settings },
    ]

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-retro-paper border-t border-retro-muted/20 px-6 py-3 flex justify-between items-center md:hidden z-50 safe-area-pb">
            {links.map((link) => {
                const Icon = link.icon
                const isActive = pathname === link.href
                return (
                    <Link
                        key={link.href}
                        href={link.href}
                        className={`
                            relative flex flex-col items-center gap-1 transition-colors duration-200
                            ${isActive
                                ? 'text-retro-primary'
                                : 'text-retro-muted hover:text-retro-text'
                            }
                        `}
                    >
                        <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                        {link.badge !== null && link.badge !== undefined && link.badge > 0 && (
                            <span className="absolute -top-1 right-2 text-[9px] font-mono bg-retro-accent text-retro-bg px-1 rounded-full min-w-[14px] text-center">
                                {link.badge}
                            </span>
                        )}
                        <span className="text-[10px] font-medium">{link.label}</span>
                    </Link>
                )
            })}
        </nav>
    )
}
