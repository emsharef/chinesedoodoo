'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface ChromeContextValue {
    chromeHidden: boolean
    setChromeHidden: (v: boolean) => void
}

const ChromeContext = createContext<ChromeContextValue>({
    chromeHidden: false,
    setChromeHidden: () => {},
})

export function ChromeProvider({ children }: { children: ReactNode }) {
    const [chromeHidden, setChromeHidden] = useState(false)
    return (
        <ChromeContext.Provider value={{ chromeHidden, setChromeHidden }}>
            {children}
        </ChromeContext.Provider>
    )
}

export function useChrome() {
    return useContext(ChromeContext)
}

// Convenience: hide chrome for the lifetime of the calling component, restore
// it on unmount. Used by routes (like the streaming reader) that want a
// reader-like full-screen treatment regardless of pathname.
export function useHideChromeWhile(active: boolean) {
    const { setChromeHidden } = useChrome()
    useEffect(() => {
        if (active) setChromeHidden(true)
        return () => {
            if (active) setChromeHidden(false)
        }
    }, [active, setChromeHidden])
}
