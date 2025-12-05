'use client'

import { usePathname } from 'next/navigation'
import { Ma_Shan_Zheng } from 'next/font/google'

const logoFont = Ma_Shan_Zheng({
    weight: '400',
    subsets: ['latin'],
    preload: true,
})

export default function MobileHeader() {
    const pathname = usePathname()

    // Hide on login page
    if (pathname === '/login' || pathname === '/login/check-email') return null

    return (
        <header className="fixed top-0 left-0 right-0 h-16 bg-retro-paper border-b border-retro-muted/20 flex items-center justify-center md:hidden z-40">
            <h1 className={`${logoFont.className} text-3xl text-retro-primary tracking-wider`}>
                中文读读
            </h1>
        </header>
    )
}
