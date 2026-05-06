import Link from 'next/link'
import { requestPasswordReset } from '../actions'

export default function ForgotPasswordPage() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-6">
            <div className="w-full max-w-md space-y-8 bg-retro-paper p-8 rounded-xl shadow-lg border border-retro-muted/20">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-retro-primary mb-2">Reset password</h1>
                    <p className="text-retro-muted">Enter your email and we&apos;ll send you a reset link.</p>
                </div>

                <form action={requestPasswordReset} className="mt-8 space-y-6">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-retro-text">
                            Email address
                        </label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            required
                            className="mt-1 block w-full rounded-md bg-retro-bg border border-retro-muted/50 px-3 py-2 text-retro-text focus:border-retro-primary focus:outline-none focus:ring-1 focus:ring-retro-primary"
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full rounded-md bg-retro-primary px-4 py-2 text-sm font-semibold text-retro-bg hover:bg-retro-primary/90 focus:outline-none focus:ring-2 focus:ring-retro-primary focus:ring-offset-2 focus:ring-offset-retro-bg"
                    >
                        Send reset link
                    </button>

                    <div className="text-center">
                        <Link href="/login" className="text-sm text-retro-muted hover:text-retro-primary">
                            Back to sign in
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    )
}
