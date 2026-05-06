import { levelLabel } from '@/lib/levels'
import type { UserLevelSummary } from '@/lib/calibration'

interface Props {
    summary: UserLevelSummary
    targetLanguage: string
}

const CONFIDENCE_LABEL: Record<UserLevelSummary['confidence'], string> = {
    low: 'low confidence',
    medium: 'medium confidence',
    high: 'high confidence',
}

export default function UserLevelChip({ summary, targetLanguage }: Props) {
    if (summary.level === null) {
        return (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-retro-paper border border-retro-muted/30 text-sm text-retro-muted">
                <span>No reading history yet</span>
            </div>
        )
    }

    const rounded = Math.round(summary.level)
    const bucket = levelLabel(targetLanguage, Math.max(1, Math.min(6, rounded)))
    const decimal = summary.level.toFixed(1)

    return (
        <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-retro-primary/10 border border-retro-primary/40 text-sm"
            title={`Based on ${summary.storyCount} recent stor${summary.storyCount === 1 ? 'y' : 'ies'}, recency-weighted with tap-density. ${CONFIDENCE_LABEL[summary.confidence]}.`}
        >
            <span className="font-bold text-retro-primary">Your level: {bucket}</span>
            <span className="text-retro-muted">({decimal})</span>
            <span className="text-xs text-retro-muted">· {CONFIDENCE_LABEL[summary.confidence]}</span>
        </div>
    )
}
