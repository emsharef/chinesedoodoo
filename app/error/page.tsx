'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function ErrorContent() {
    const searchParams = useSearchParams()
    const message = searchParams.get('message') || 'Something went wrong'

    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
            <h1 className="text-3xl font-bold text-red-500 mb-4">Error</h1>
            <p className="text-retro-text mb-8">{message}</p>
            <Link href="/login" className="text-retro-primary hover:underline">
                Back to Login
            </Link>
        </div>
    )
}

export default function ErrorPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <ErrorContent />
        </Suspense>
    )
}
