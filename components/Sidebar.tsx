'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Library, PlusCircle, BookOpen, Settings, List } from 'lucide-react'
import { Ma_Shan_Zheng } from 'next/font/google'

const logoFont = Ma_Shan_Zheng({
    weight: '400',
    subsets: ['latin'],
    preload: true,
})

export default function Sidebar() {
    const pathname = usePathname()

    // Hide sidebar on login page
    if (pathname === '/login' || pathname === '/login/check-email') return null

    const links = [
        { href: '/', label: 'Library', icon: Library },
        { href: '/story/new', label: 'New Story', icon: PlusCircle },
        { href: '/review', label: 'Flashcards', icon: BookOpen },
        { href: '/vocabulary', label: 'Vocabulary', icon: List },
        { href: '/settings', label: 'Settings', icon: Settings },
    ]

    return (
        <aside className="w-64 bg-retro-paper border-r border-retro-muted/20 h-screen fixed left-0 top-0 flex flex-col p-6 z-40">
            <div className="mb-10">
                <h1 className={`${logoFont.className} text-4xl text-retro-primary tracking-wider`}>
                    中文读读
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
                            <span>{link.label}</span>
                        </Link>
                    )
                })}
            </nav>

            <div className="text-xs text-retro-muted text-center mt-auto">
                <p>© 2025 ChineseDuDu</p>
            </div>
        </aside>
    )
}
