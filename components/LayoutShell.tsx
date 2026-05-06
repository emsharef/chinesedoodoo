'use client'

import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import MobileHeader from './MobileHeader'

// Renders the global chrome — except on story-reader routes where we want
// maximum reading area. /story/new still gets the chrome (it's the form
// surface, not the reader).
export default function LayoutShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const isReaderMode = /^\/story\/[^/]+/.test(pathname) && pathname !== '/story/new'

    if (isReaderMode) {
        return (
            <>
                <Sidebar />
                <main className="flex-1 md:ml-64 min-h-screen">{children}</main>
            </>
        )
    }

    return (
        <>
            <MobileHeader />
            <Sidebar />
            <main className="flex-1 md:ml-64 min-h-screen pb-24 md:pb-0 pt-16 md:pt-0">
                {children}
            </main>
            <BottomNav />
        </>
    )
}
