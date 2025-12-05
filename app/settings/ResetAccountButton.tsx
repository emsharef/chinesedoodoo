'use client'

import { useState } from 'react'
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react'
import { resetAccount } from './actions'

export default function ResetAccountButton() {
    const [isLoading, setIsLoading] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)

    async function handleReset() {
        setIsLoading(true)
        try {
            await resetAccount()
            // Redirect is handled in server action
        } catch (error) {
            console.error(error)
            alert('Failed to reset account')
            setIsLoading(false)
        }
    }

    if (showConfirm) {
        return (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 animate-in fade-in zoom-in duration-200">
                <div className="flex items-start gap-3 mb-4">
                    <AlertTriangle className="text-red-500 shrink-0" size={24} />
                    <div>
                        <h3 className="font-bold text-red-600">Are you absolutely sure?</h3>
                        <p className="text-sm text-red-600/80 mt-1">
                            This action cannot be undone. This will permanently delete all your stories, vocabulary, and progress.
                        </p>
                    </div>
                </div>
                <div className="flex gap-3 justify-end">
                    <button
                        onClick={() => setShowConfirm(false)}
                        disabled={isLoading}
                        className="px-4 py-2 rounded text-sm font-medium text-retro-muted hover:text-retro-text transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleReset}
                        disabled={isLoading}
                        className="bg-red-500 text-white px-4 py-2 rounded text-sm font-medium hover:bg-red-600 transition-colors flex items-center gap-2"
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                        Yes, delete everything
                    </button>
                </div>
            </div>
        )
    }

    return (
        <button
            onClick={() => setShowConfirm(true)}
            className="flex items-center gap-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 px-4 py-2 rounded-lg transition-colors w-full justify-center font-medium border border-red-500/20"
        >
            <Trash2 size={18} />
            Reset Account
        </button>
    )
}
