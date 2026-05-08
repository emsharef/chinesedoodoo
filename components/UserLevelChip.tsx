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
            <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-retro-paper border border-retro-muted/30 text-xs text-retro-muted whitespace-nowrap">
                No level yet
            </div>
        )
    }

    const rounded = Math.round(summary.level)
    const bucket = levelLabel(targetLanguage, Math.max(1, Math.min(6, rounded)))
    const decimal = summary.level.toFixed(1)
    const storyText = `${summary.storyCount} stor${summary.storyCount === 1 ? 'y' : 'ies'}`

    return (
        <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-retro-primary/10 border border-retro-primary/40 text-xs sm:text-sm whitespace-nowrap"
            title={`Estimated level ${decimal}, based on ${storyText} (recency-weighted with tap-density). ${CONFIDENCE_LABEL[summary.confidence]}.`}
        >
            <span className="font-bold text-retro-primary">{bucket}</span>
            <span className="text-retro-muted hidden sm:inline">· {CONFIDENCE_LABEL[summary.confidence]}</span>
        </div>
    )
}
