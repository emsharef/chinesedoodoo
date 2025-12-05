import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { signout } from '@/app/login/actions'
import { LogOut, User, Lock, AlertTriangle, Code } from 'lucide-react'
import ResetAccountButton from './ResetAccountButton'
import DebugModeToggle from './DebugModeToggle'

export default async function SettingsPage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const { data: profile } = await supabase
        .from('chinese_profiles')
        .select('debug_mode')
        .eq('id', user.id)
        .single()

    return (
        <div className="container mx-auto px-4 py-8 max-w-2xl">
            <h1 className="text-3xl font-bold text-retro-primary mb-8">Settings</h1>

            <div className="bg-retro-paper rounded-xl border border-retro-muted/20 shadow-sm overflow-hidden">
                {/* User Info Section */}
                <div className="p-6 border-b border-retro-muted/10">
                    <h2 className="text-xl font-semibold text-retro-text mb-4 flex items-center gap-2">
                        <User size={20} />
                        Account Information
                    </h2>
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-retro-muted mb-1">Email Address</label>
                            <div className="text-retro-text font-mono bg-retro-bg px-3 py-2 rounded border border-retro-muted/20">
                                {user.email}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-retro-muted mb-1">User ID</label>
                            <div className="text-retro-text font-mono text-sm bg-retro-bg px-3 py-2 rounded border border-retro-muted/20 truncate">
                                {user.id}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Password Section */}
                <div className="p-6 border-b border-retro-muted/10 bg-retro-bg/30">
                    <h2 className="text-xl font-semibold text-retro-text mb-4 flex items-center gap-2">
                        <Lock size={20} />
                        Security
                    </h2>
                    <form action={async (formData) => {
                        'use server'
                        const { updatePassword } = await import('@/app/login/actions')
                        await updatePassword(formData)
                    }} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-retro-muted mb-1">New Password</label>
                            <input
                                type="password"
                                name="password"
                                placeholder="Enter new password"
                                className="w-full bg-retro-bg border border-retro-muted/20 rounded px-3 py-2 text-retro-text focus:outline-none focus:border-retro-primary transition-colors"
                                required
                                minLength={6}
                            />
                        </div>
                        <button
                            type="submit"
                            className="bg-retro-primary text-retro-bg px-4 py-2 rounded font-medium hover:bg-retro-primary/90 transition-colors text-sm"
                        >
                            Update Password
                        </button>
                    </form>
                </div>

                {/* Developer Settings */}
                <div className="p-6 border-b border-retro-muted/10 bg-retro-bg/30">
                    <h2 className="text-xl font-semibold text-retro-text mb-4 flex items-center gap-2">
                        <Code size={20} />
                        Developer Settings
                    </h2>
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="block text-sm font-medium text-retro-text">Debug Mode</label>
                            <p className="text-xs text-retro-muted">Show generation prompts and technical details</p>
                        </div>
                        <DebugModeToggle initialValue={profile?.debug_mode || false} />
                    </div>
                </div>

                {/* Actions Section */}
                <div className="p-6 bg-retro-bg/50 border-b border-retro-muted/10">
                    <h2 className="text-xl font-semibold text-retro-text mb-4">Actions</h2>
                    <form action={signout}>
                        <button
                            className="flex items-center gap-2 bg-retro-primary/10 text-retro-primary hover:bg-retro-primary/20 px-4 py-2 rounded-lg transition-colors w-full justify-center font-medium border border-retro-primary/20"
                        >
                            <LogOut size={18} />
                            Sign Out
                        </button>
                    </form>
                </div>

                {/* Danger Zone */}
                <div className="p-6 bg-red-500/5">
                    <h2 className="text-xl font-semibold text-red-600/80 mb-4 flex items-center gap-2">
                        <AlertTriangle size={20} />
                        Danger Zone
                    </h2>
                    <ResetAccountButton />
                </div>
            </div>
        </div>
    )
}
