import type { Metadata } from "next";
import "./globals.css";
import "@fontsource/noto-serif-sc";
import "@fontsource/inter";

export const metadata: Metadata = {
  title: "ChineseDuDu (中文读读)",
  description: "Learn Chinese through reading AI-generated stories.",
};

import Sidebar from "@/components/Sidebar";
import BottomNav from "@/components/BottomNav";
import MobileHeader from "@/components/MobileHeader";

import { createClient } from '@/utils/supabase/server'

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let theme = 'dark'
  if (user) {
    const { data: profile } = await supabase
      .from('chinese_profiles')
      .select('theme')
      .eq('id', user.id)
      .single()
    if (profile?.theme) theme = profile.theme
  }

  return (
    <html lang="en">
      <body
        className={`antialiased bg-retro-bg text-retro-text font-sans min-h-screen flex flex-col md:flex-row ${theme === 'light' ? 'light-theme' : ''}`}
      >
        <MobileHeader />
        <Sidebar />
        <main className="flex-1 md:ml-64 min-h-screen pb-24 md:pb-0 pt-16 md:pt-0">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}

