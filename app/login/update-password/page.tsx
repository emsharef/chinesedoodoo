import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { resetPassword } from '../actions'

export default async function UpdatePasswordPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/error?message=' + encodeURIComponent('Reset link expired. Please request a new one.'))
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-6">
            <div className="w-full max-w-md space-y-8 bg-retro-paper p-8 rounded-xl shadow-lg border border-retro-muted/20">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-retro-primary mb-2">Set new password</h1>
                    <p className="text-retro-muted">Enter a new password for {user.email}.</p>
                </div>

                <form action={resetPassword} className="mt-8 space-y-6">
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-retro-text">
                            New password
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            required
                            minLength={6}
                            className="mt-1 block w-full rounded-md bg-retro-bg border border-retro-muted/50 px-3 py-2 text-retro-text focus:border-retro-primary focus:outline-none focus:ring-1 focus:ring-retro-primary"
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full rounded-md bg-retro-primary px-4 py-2 text-sm font-semibold text-retro-bg hover:bg-retro-primary/90 focus:outline-none focus:ring-2 focus:ring-retro-primary focus:ring-offset-2 focus:ring-offset-retro-bg"
                    >
                        Update password
                    </button>
                </form>
            </div>
        </div>
    )
}
