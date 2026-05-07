'use client'

import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import MobileHeader from './MobileHeader'
import { useChrome } from './ChromeContext'

// Renders the global chrome — except on story-reader routes where we want
// maximum reading area. /story/new still gets the chrome (it's the form
// surface, not the reader). Pages can also hide chrome dynamically via
// useChrome().setChromeHidden — the streaming reader uses this.
//
// IMPORTANT: keep the JSX shape stable across isReaderMode toggles. If we
// returned two different trees here, switching from form-with-chrome to
// streaming-without-chrome would cause React to remount children — which
// would wipe the page's local state (phase, streaming buffers, etc.) and
// snap straight back to the initial state. Conditional opacity-collapse
// keeps positions stable so children don't remount.
export default function LayoutShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const { chromeHidden } = useChrome()
    const isReaderMode = chromeHidden || (/^\/story\/[^/]+/.test(pathname) && pathname !== '/story/new')

    return (
        <>
            {!isReaderMode && <MobileHeader />}
            <Sidebar />
            <main
                className={`flex-1 md:ml-64 min-h-screen ${
                    isReaderMode ? '' : 'pb-24 md:pb-0 pt-16 md:pt-0'
                }`}
            >
                {children}
            </main>
            {!isReaderMode && <BottomNav />}
        </>
    )
}
