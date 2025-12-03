import { login, signup } from './actions'

export default function LoginPage() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-6">
            <div className="w-full max-w-md space-y-8 bg-retro-paper p-8 rounded-xl shadow-lg border border-retro-muted/20">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-retro-primary mb-2">ChineseDuDu</h1>
                    <p className="text-retro-muted">Sign in to start reading</p>
                </div>

                <form className="mt-8 space-y-6">
                    <div className="space-y-4">
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
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-retro-text">
                                Password
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                className="mt-1 block w-full rounded-md bg-retro-bg border border-retro-muted/50 px-3 py-2 text-retro-text focus:border-retro-primary focus:outline-none focus:ring-1 focus:ring-retro-primary"
                            />
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button
                            formAction={login}
                            className="flex-1 rounded-md bg-retro-primary px-4 py-2 text-sm font-semibold text-retro-bg hover:bg-retro-primary/90 focus:outline-none focus:ring-2 focus:ring-retro-primary focus:ring-offset-2 focus:ring-offset-retro-bg"
                        >
                            Sign in
                        </button>
                        <button
                            formAction={signup}
                            className="flex-1 rounded-md bg-retro-paper border border-retro-primary px-4 py-2 text-sm font-semibold text-retro-primary hover:bg-retro-bg focus:outline-none focus:ring-2 focus:ring-retro-primary focus:ring-offset-2 focus:ring-offset-retro-bg"
                        >
                            Sign up
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
