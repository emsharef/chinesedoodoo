import Link from 'next/link'

export default function CheckEmailPage() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
            <div className="w-full max-w-md space-y-8 bg-retro-paper p-8 rounded-xl shadow-lg border border-retro-muted/20">
                <h1 className="text-3xl font-bold text-retro-primary mb-4">Check your email</h1>
                <p className="text-retro-text mb-8">
                    We've sent a confirmation link to your email address. Click the link to sign in.
                </p>
                <Link href="/login" className="text-retro-muted hover:text-retro-primary text-sm">
                    Back to Login
                </Link>
            </div>
        </div>
    )
}
