import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus, BookOpen, LogOut } from 'lucide-react'
import { signout } from '@/app/login/actions'

export default async function Dashboard() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: stories } = await supabase
    .from('chinese_stories')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="container mx-auto px-4 py-8">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-retro-primary">Library</h1>
          <div className="flex items-center gap-4 text-retro-muted">
            <p>Welcome back, {user.email}</p>
            <form action={signout}>
              <button className="flex items-center gap-1 text-xs hover:text-retro-accent transition-colors">
                <LogOut size={14} />
                Sign Out
              </button>
            </form>
          </div>
        </div>
        <div className="flex gap-4">
          <Link
            href="/review"
            className="flex items-center gap-2 bg-retro-secondary text-retro-bg px-4 py-2 rounded-md font-semibold hover:bg-retro-secondary/90 transition-colors"
          >
            <BookOpen size={20} />
            Review
          </Link>
          <Link
            href="/story/new"
            className="flex items-center gap-2 bg-retro-primary text-retro-bg px-4 py-2 rounded-md font-semibold hover:bg-retro-primary/90 transition-colors"
          >
            <Plus size={20} />
            New Story
          </Link>
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {stories?.map((story) => (
          <Link
            key={story.id}
            href={`/story/${story.id}`}
            className="group block p-6 bg-retro-paper rounded-xl border border-retro-muted/20 hover:border-retro-primary/50 transition-all hover:shadow-lg hover:shadow-retro-primary/5"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 bg-retro-bg rounded-lg text-retro-primary group-hover:text-retro-accent transition-colors">
                <BookOpen size={24} />
              </div>
              <span className="text-xs font-mono text-retro-muted border border-retro-muted/30 px-2 py-1 rounded">
                HSK {story.difficulty_level || '?'}
              </span>
            </div>
            <h2 className="text-xl font-bold text-retro-text group-hover:text-retro-primary transition-colors mb-2">
              {story.title}
            </h2>
            <p className="text-retro-muted line-clamp-3 text-sm">
              {story.content.substring(0, 100)}...
            </p>
            <div className="mt-4 text-xs text-retro-muted flex justify-between items-center">
              <span>{new Date(story.created_at).toLocaleDateString()}</span>
            </div>
          </Link>
        ))}

        {stories?.length === 0 && (
          <div className="col-span-full text-center py-12 border-2 border-dashed border-retro-muted/20 rounded-xl">
            <p className="text-retro-muted mb-4">No stories yet. Generate your first one!</p>
            <Link
              href="/story/new"
              className="text-retro-primary hover:underline"
            >
              Create a Story
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
