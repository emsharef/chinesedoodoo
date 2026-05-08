import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import LibraryGrid from './LibraryGrid'
import UserLevelChip from '@/components/UserLevelChip'
import { summarizeUserLevel } from '@/lib/calibration'

export default async function Dashboard() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }
  const { data: profile } = await supabase
    .from('chinese_profiles')
    .select('font_size, target_language')
    .eq('id', user.id)
    .single()

  const targetLang = profile?.target_language || 'zh-CN'

  const { data: stories } = await supabase
    .from('chinese_stories')
    .select('*')
    .eq('user_id', user.id)
    .eq('language', targetLang)
    .order('created_at', { ascending: false })

  const recentRead = (stories ?? [])
    .filter((s) => s.is_read)
    .sort((a, b) => new Date(b.read_at ?? 0).getTime() - new Date(a.read_at ?? 0).getTime())
    .slice(0, 5)
  const levelSummary = summarizeUserLevel(recentRead as any)

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <header className="flex items-center justify-between gap-3 mb-5 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-retro-primary">Library</h1>
        <UserLevelChip summary={levelSummary} targetLanguage={targetLang} />
      </header>

      <LibraryGrid
        stories={stories ?? []}
        fontSize={profile?.font_size || 'medium'}
        targetLang={targetLang}
      />
    </div>
  )
}
