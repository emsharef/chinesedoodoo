'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Library, PlusCircle, BookOpen, Settings, List } from 'lucide-react'

export default function BottomNav() {
    const pathname = usePathname()

    // Hide on login page
    if (pathname === '/login' || pathname === '/login/check-email') return null

    const links = [
        { href: '/', label: 'Library', icon: Library },
        { href: '/story/new', label: 'New', icon: PlusCircle },
        { href: '/review', label: 'Review', icon: BookOpen },
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
                            flex flex-col items-center gap-1 transition-colors duration-200
                            ${isActive
                                ? 'text-retro-primary'
                                : 'text-retro-muted hover:text-retro-text'
                            }
                        `}
                    >
                        <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                        <span className="text-[10px] font-medium">{link.label}</span>
                    </Link>
                )
            })}
        </nav>
    )
}
