'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { pinyin } from 'pinyin-pro'
import { Trash2, Loader2, CheckCircle, RotateCcw, Search } from 'lucide-react'
import { getVocabulary, deleteVocabularyItem, bulkDeleteVocab, bulkMarkKnown, bulkResetSchedule } from './actions'

interface VocabItem {
    id: string
    word: string
    pinyin?: string | null
    definition?: string | null
    status: string
    difficulty: number
    stability: number
    next_review: string | null
    last_review: string | null
    repetition_count: number
    lapses: number
    created_at: string
}

type StatusFilter = 'all' | 'new' | 'learning' | 'review' | 'known'
type SortField = 'word' | 'status' | 'next_review' | 'created_at'
type SortOrder = 'asc' | 'desc'

const STATUS_LABEL: Record<string, string> = {
    all: 'All',
    new: 'New',
    learning: 'Learning',
    review: 'Review',
    known: 'Known',
}

const STATUS_COLORS: Record<string, string> = {
    new: 'bg-blue-500/10 text-blue-500',
    learning: 'bg-yellow-500/10 text-yellow-500',
    review: 'bg-green-500/10 text-green-500',
    relearning: 'bg-orange-500/10 text-orange-500',
    known: 'bg-purple-500/10 text-purple-500',
}

function formatRelativeReview(iso: string | null): string {
    if (!iso) return '—'
    const target = new Date(iso).getTime()
    const diffMs = target - Date.now()
    const days = Math.round(diffMs / (1000 * 60 * 60 * 24))
    if (days < 0) return `Overdue ${Math.abs(days)}d`
    if (days === 0) return 'Today'
    if (days === 1) return 'Tomorrow'
    if (days < 30) return `In ${days}d`
    if (days < 365) return `In ${Math.round(days / 30)}mo`
    return `In ${Math.round(days / 365)}y`
}

export default function VocabularyList({ language }: { language: string }) {
    const [vocab, setVocab] = useState<VocabItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
    const [sortField, setSortField] = useState<SortField>('created_at')
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [bulkBusy, setBulkBusy] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const loadVocab = useCallback(async () => {
        setIsLoading(true)
        try {
            const data = await getVocabulary(language)
            setVocab(data as VocabItem[])
        } catch (error) {
            console.error(error)
        } finally {
            setIsLoading(false)
        }
    }, [language])

    useEffect(() => {
        loadVocab()
    }, [loadVocab])

    const counts = useMemo(() => {
        const c: Record<string, number> = { all: vocab.length, new: 0, learning: 0, review: 0, known: 0 }
        for (const v of vocab) {
            if (c[v.status] !== undefined) c[v.status] += 1
        }
        return c
    }, [vocab])

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        let items = vocab
        if (statusFilter !== 'all') {
            const target = statusFilter
            items = items.filter((v) => v.status === target || (target === 'review' && v.status === 'relearning'))
        }
        if (q) {
            items = items.filter(
                (v) =>
                    v.word.toLowerCase().includes(q) ||
                    (v.pinyin || '').toLowerCase().includes(q) ||
                    (v.definition || '').toLowerCase().includes(q),
            )
        }
        const order = sortOrder === 'asc' ? 1 : -1
        return [...items].sort((a, b) => {
            switch (sortField) {
                case 'word':
                    return a.word.localeCompare(b.word) * order
                case 'status':
                    return a.status.localeCompare(b.status) * order
                case 'next_review':
                    if (!a.next_review) return 1
                    if (!b.next_review) return -1
                    return (new Date(a.next_review).getTime() - new Date(b.next_review).getTime()) * order
                case 'created_at':
                    return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * order
            }
        })
    }, [vocab, search, statusFilter, sortField, sortOrder])

    function toggleSort(field: SortField) {
        if (sortField === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
        else {
            setSortField(field)
            setSortOrder(field === 'word' || field === 'status' ? 'asc' : 'desc')
        }
    }

    function toggleSelect(id: string) {
        setSelected((s) => {
            const next = new Set(s)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    function selectAllFiltered() {
        const allIds = new Set(filtered.map((v) => v.id))
        const allSelected = filtered.every((v) => selected.has(v.id))
        setSelected(allSelected ? new Set() : allIds)
    }

    async function runBulk(action: (ids: string[]) => Promise<unknown>, confirmText?: string) {
        if (confirmText && !confirm(confirmText)) return
        const ids = Array.from(selected)
        setBulkBusy(true)
        try {
            await action(ids)
            setSelected(new Set())
            await loadVocab()
        } catch (e) {
            console.error(e)
            alert('Bulk action failed')
        } finally {
            setBulkBusy(false)
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Remove this word from your study list?')) return
        setDeletingId(id)
        try {
            await deleteVocabularyItem(id)
            setVocab((v) => v.filter((x) => x.id !== id))
        } catch (e) {
            console.error(e)
            alert('Failed to delete')
        } finally {
            setDeletingId(null)
        }
    }

    if (isLoading) {
        return (
            <div className="text-center py-12">
                <Loader2 className="animate-spin mx-auto text-retro-muted" size={32} />
            </div>
        )
    }

    if (vocab.length === 0) {
        return (
            <div className="text-center py-12 border-2 border-dashed border-retro-muted/20 rounded-xl bg-retro-paper">
                <p className="text-retro-muted">No vocabulary words yet. Read some stories to add words!</p>
            </div>
        )
    }

    const allFilteredSelected = filtered.length > 0 && filtered.every((v) => selected.has(v.id))

    return (
        <div className="space-y-4">
            {/* Search + filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-retro-muted pointer-events-none" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search word, pinyin, or definition…"
                        className="w-full bg-retro-paper border border-retro-muted/20 rounded-md pl-9 pr-3 py-2 text-retro-text placeholder:text-retro-muted/50 focus:outline-none focus:border-retro-primary text-sm"
                    />
                </div>
                <div className="flex gap-2 flex-wrap">
                    {(['all', 'new', 'learning', 'review', 'known'] as StatusFilter[]).map((s) => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                                statusFilter === s
                                    ? 'bg-retro-primary text-retro-bg border-retro-primary font-semibold'
                                    : 'bg-retro-paper text-retro-muted border-retro-muted/20 hover:text-retro-text'
                            }`}
                        >
                            {STATUS_LABEL[s]} <span className="opacity-60">{counts[s] ?? 0}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Bulk actions bar */}
            {selected.size > 0 && (
                <div className="flex items-center gap-2 bg-retro-primary/10 border border-retro-primary/30 rounded-md px-4 py-2 text-sm">
                    <span className="text-retro-text font-medium">{selected.size} selected</span>
                    <div className="flex-1" />
                    <button
                        onClick={() => runBulk(bulkMarkKnown)}
                        disabled={bulkBusy}
                        className="flex items-center gap-1 px-3 py-1 rounded text-purple-500 hover:bg-purple-500/10 transition-colors disabled:opacity-50"
                    >
                        <CheckCircle size={14} />
                        Mark known
                    </button>
                    <button
                        onClick={() => runBulk(bulkResetSchedule)}
                        disabled={bulkBusy}
                        className="flex items-center gap-1 px-3 py-1 rounded text-blue-500 hover:bg-blue-500/10 transition-colors disabled:opacity-50"
                    >
                        <RotateCcw size={14} />
                        Reset schedule
                    </button>
                    <button
                        onClick={() => runBulk(bulkDeleteVocab, `Delete ${selected.size} word${selected.size === 1 ? '' : 's'}?`)}
                        disabled={bulkBusy}
                        className="flex items-center gap-1 px-3 py-1 rounded text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    >
                        <Trash2 size={14} />
                        Delete
                    </button>
                    <button
                        onClick={() => setSelected(new Set())}
                        disabled={bulkBusy}
                        className="text-retro-muted hover:text-retro-text px-2 disabled:opacity-50"
                    >
                        Clear
                    </button>
                </div>
            )}

            {filtered.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-retro-muted/20 rounded-xl bg-retro-paper">
                    <p className="text-retro-muted mb-3">No words match.</p>
                    <button
                        onClick={() => {
                            setSearch('')
                            setStatusFilter('all')
                        }}
                        className="text-retro-primary hover:underline text-sm"
                    >
                        Clear filters
                    </button>
                </div>
            ) : (
                <div className="bg-retro-paper rounded-xl border border-retro-muted/20 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-retro-bg/50 border-b border-retro-muted/10">
                                <tr>
                                    <th className="p-3 w-10">
                                        <input
                                            type="checkbox"
                                            checked={allFilteredSelected}
                                            onChange={selectAllFiltered}
                                            className="accent-retro-primary"
                                        />
                                    </th>
                                    <SortHeader field="word" current={sortField} order={sortOrder} onClick={toggleSort}>Word</SortHeader>
                                    <th className="p-3 font-semibold text-retro-muted text-sm">Pinyin / Definition</th>
                                    <SortHeader field="status" current={sortField} order={sortOrder} onClick={toggleSort}>Status</SortHeader>
                                    <th className="p-3 font-semibold text-retro-muted text-sm">Difficulty</th>
                                    <SortHeader field="next_review" current={sortField} order={sortOrder} onClick={toggleSort}>Next review</SortHeader>
                                    <SortHeader field="created_at" current={sortField} order={sortOrder} onClick={toggleSort}>Added</SortHeader>
                                    <th className="p-3 font-semibold text-retro-muted text-sm text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-retro-muted/10">
                                {filtered.map((item) => (
                                    <tr key={item.id} className="hover:bg-retro-bg/30 transition-colors">
                                        <td className="p-3">
                                            <input
                                                type="checkbox"
                                                checked={selected.has(item.id)}
                                                onChange={() => toggleSelect(item.id)}
                                                className="accent-retro-primary"
                                            />
                                        </td>
                                        <td className="p-3 text-xl font-serif text-retro-primary">{item.word}</td>
                                        <td className="p-3">
                                            <div className="text-retro-text font-mono text-sm mb-1">
                                                {item.pinyin || pinyin(item.word, { toneType: 'symbol' })}
                                            </div>
                                            <div className="text-retro-muted text-xs italic line-clamp-2 max-w-md">
                                                {item.definition || 'No definition'}
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <span className={`inline-block px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${STATUS_COLORS[item.status] || 'bg-gray-500/10 text-gray-500'}`}>
                                                {item.status}
                                            </span>
                                        </td>
                                        <td className="p-3 text-retro-muted text-sm font-mono">
                                            {item.difficulty > 0 ? `D ${item.difficulty.toFixed(1)}` : '—'}
                                        </td>
                                        <td className="p-3 text-retro-muted text-sm" title={item.next_review ?? ''}>
                                            {formatRelativeReview(item.next_review)}
                                        </td>
                                        <td className="p-3 text-retro-muted text-sm">
                                            {new Date(item.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="p-3 text-right">
                                            <button
                                                onClick={() => handleDelete(item.id)}
                                                disabled={deletingId === item.id}
                                                className="text-retro-muted hover:text-red-500 transition-colors p-2 rounded hover:bg-red-500/10"
                                                title="Remove from study"
                                            >
                                                {deletingId === item.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}

function SortHeader({
    field,
    current,
    order,
    onClick,
    children,
}: {
    field: SortField
    current: SortField
    order: SortOrder
    onClick: (f: SortField) => void
    children: React.ReactNode
}) {
    const active = field === current
    return (
        <th
            onClick={() => onClick(field)}
            className="p-3 font-semibold text-retro-muted text-sm cursor-pointer hover:text-retro-primary transition-colors select-none"
        >
            {children}
            <span className={`ml-1 ${active ? 'text-retro-primary' : 'text-retro-muted/30'}`}>
                {active ? (order === 'asc' ? '↑' : '↓') : '↕'}
            </span>
        </th>
    )
}
