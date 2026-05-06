import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'
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
    <div className="container mx-auto px-4 py-8">
      <header className="flex justify-between items-center mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-retro-primary">Library</h1>
          <p className="text-retro-muted mt-1">Welcome back, {user.email}</p>
          <div className="mt-3">
            <UserLevelChip summary={levelSummary} targetLanguage={targetLang} />
          </div>
        </div>
        <div className="flex gap-4">
          <Link
            href="/story/new"
            className="flex items-center gap-2 bg-retro-primary text-retro-bg px-4 py-2 rounded-md font-semibold hover:bg-retro-primary/90 transition-colors"
          >
            <Plus size={20} />
            New Story
          </Link>
        </div>
      </header>

      <LibraryGrid
        stories={stories ?? []}
        fontSize={profile?.font_size || 'medium'}
        targetLang={targetLang}
      />
    </div>
  )
}
