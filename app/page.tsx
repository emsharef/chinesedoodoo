import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus, BookOpen, CheckCircle, Smile, ThumbsUp, Dumbbell } from 'lucide-react'

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
          <p className="text-retro-muted mt-1">Welcome back, {user.email}</p>
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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {stories?.map((story) => (
          <Link
            key={story.id}
            href={`/story/${story.id}`}
            className="group block p-6 bg-retro-paper rounded-xl border border-retro-muted/20 hover:border-retro-primary/50 transition-all hover:shadow-lg hover:shadow-retro-primary/5"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-retro-bg rounded-lg text-retro-primary group-hover:text-retro-accent transition-colors">
                  <BookOpen size={24} />
                </div>
                {story.is_read && (
                  <div className="flex items-center gap-2" title={`Read on ${new Date(story.read_at).toLocaleDateString()}`}>
                    {story.difficulty_rating === 'easy' && <Smile size={20} className="text-green-500" />}
                    {story.difficulty_rating === 'good' && <ThumbsUp size={20} className="text-blue-500" />}
                    {story.difficulty_rating === 'hard' && <Dumbbell size={20} className="text-red-500" />}
                    {!story.difficulty_rating && <CheckCircle size={20} className="text-retro-muted" />}
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs font-mono text-retro-muted border border-retro-muted/30 px-2 py-1 rounded">
                  HSK {story.difficulty_level || '?'}
                </span>
                {story.is_read && story.read_at && (
                  <span className="text-[10px] text-retro-muted mt-1">
                    {new Date(story.read_at).toLocaleDateString()}
                  </span>
                )}
              </div>
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
