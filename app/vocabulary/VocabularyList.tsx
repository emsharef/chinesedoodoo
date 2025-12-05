'use client'

import { useState } from 'react'
import { pinyin } from 'pinyin-pro'
import { Trash2, Loader2 } from 'lucide-react'
import { deleteVocabularyItem } from './actions'

interface VocabItem {
    id: string
    word: string
    pinyin?: string
    definition?: string
    status: string
    difficulty: number
    next_review: string | null
    last_review: string | null
    repetition_count: number
    created_at: string
}

type SortField = 'word' | 'status' | 'difficulty' | 'next_review' | 'created_at'
type SortOrder = 'asc' | 'desc'

export default function VocabularyList({ items }: { items: VocabItem[] }) {
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [sortField, setSortField] = useState<SortField>('created_at')
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

    const sortedItems = [...items].sort((a, b) => {
        const order = sortOrder === 'asc' ? 1 : -1

        switch (sortField) {
            case 'word':
                return a.word.localeCompare(b.word) * order
            case 'status':
                return a.status.localeCompare(b.status) * order
            case 'difficulty':
                return (a.difficulty - b.difficulty) * order
            case 'next_review':
                if (!a.next_review) return 1 * order
                if (!b.next_review) return -1 * order
                return (new Date(a.next_review).getTime() - new Date(b.next_review).getTime()) * order
            case 'created_at':
                return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * order
            default:
                return 0
        }
    })

    function handleSort(field: SortField) {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortOrder('asc') // Default to asc for new sort, except maybe date?
            if (field === 'created_at' || field === 'next_review') {
                setSortOrder('desc') // Default to desc for dates usually better
            }
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Are you sure you want to remove this word from your study list?')) return

        setDeletingId(id)
        try {
            await deleteVocabularyItem(id)
        } catch (error) {
            console.error('Failed to delete', error)
            alert('Failed to delete item')
        } finally {
            setDeletingId(null)
        }
    }

    if (items.length === 0) {
        return (
            <div className="text-center py-12 border-2 border-dashed border-retro-muted/20 rounded-xl bg-retro-paper">
                <p className="text-retro-muted">No vocabulary words yet. Read some stories to add words!</p>
            </div>
        )
    }

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <span className="text-retro-muted/30 ml-1">↕</span>
        return <span className="text-retro-primary ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
    }

    return (
        <div className="bg-retro-paper rounded-xl border border-retro-muted/20 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-retro-bg/50 border-b border-retro-muted/10">
                        <tr>
                            <th
                                className="p-4 font-semibold text-retro-muted text-sm cursor-pointer hover:text-retro-primary transition-colors select-none"
                                onClick={() => handleSort('word')}
                            >
                                Word <SortIcon field="word" />
                            </th>
                            <th className="p-4 font-semibold text-retro-muted text-sm">Pinyin / Definition</th>
                            <th
                                className="p-4 font-semibold text-retro-muted text-sm cursor-pointer hover:text-retro-primary transition-colors select-none"
                                onClick={() => handleSort('status')}
                            >
                                Status <SortIcon field="status" />
                            </th>
                            <th
                                className="p-4 font-semibold text-retro-muted text-sm cursor-pointer hover:text-retro-primary transition-colors select-none"
                                onClick={() => handleSort('difficulty')}
                            >
                                Difficulty <SortIcon field="difficulty" />
                            </th>
                            <th
                                className="p-4 font-semibold text-retro-muted text-sm cursor-pointer hover:text-retro-primary transition-colors select-none"
                                onClick={() => handleSort('next_review')}
                            >
                                Next Review <SortIcon field="next_review" />
                            </th>
                            <th
                                className="p-4 font-semibold text-retro-muted text-sm cursor-pointer hover:text-retro-primary transition-colors select-none"
                                onClick={() => handleSort('created_at')}
                            >
                                Added <SortIcon field="created_at" />
                            </th>
                            <th className="p-4 font-semibold text-retro-muted text-sm text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-retro-muted/10">
                        {sortedItems.map((item) => (
                            <tr key={item.id} className="hover:bg-retro-bg/30 transition-colors">
                                <td className="p-4 text-xl font-serif text-retro-primary">{item.word}</td>
                                <td className="p-4">
                                    <div className="text-retro-text font-mono text-sm mb-1">
                                        {item.pinyin || pinyin(item.word, { toneType: 'symbol' })}
                                    </div>
                                    <div className="text-retro-muted text-xs italic">
                                        {item.definition || 'No definition'}
                                    </div>
                                </td>
                                <td className="p-4">
                                    <span className={`
                                        inline-block px-2 py-1 rounded text-xs font-bold uppercase tracking-wider
                                        ${item.status === 'new' ? 'bg-blue-500/10 text-blue-500' :
                                            item.status === 'learning' ? 'bg-yellow-500/10 text-yellow-500' :
                                                item.status === 'review' ? 'bg-green-500/10 text-green-500' :
                                                    item.status === 'known' ? 'bg-purple-500/10 text-purple-500' :
                                                        'bg-gray-500/10 text-gray-500'}
                                    `}>
                                        {item.status}
                                    </span>
                                </td>
                                <td className="p-4 text-retro-muted text-sm">
                                    {(item.difficulty * 10).toFixed(1)}%
                                </td>
                                <td className="p-4 text-retro-muted text-sm">
                                    {item.next_review
                                        ? new Date(item.next_review).toLocaleDateString()
                                        : 'Not scheduled'}
                                </td>
                                <td className="p-4 text-retro-muted text-sm">
                                    {new Date(item.created_at).toLocaleDateString()}
                                </td>
                                <td className="p-4 text-right">
                                    <button
                                        onClick={() => handleDelete(item.id)}
                                        disabled={deletingId === item.id}
                                        className="text-retro-muted hover:text-red-500 transition-colors p-2 rounded hover:bg-red-500/10"
                                        title="Remove from study"
                                    >
                                        {deletingId === item.id ? (
                                            <Loader2 size={18} className="animate-spin" />
                                        ) : (
                                            <Trash2 size={18} />
                                        )}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
