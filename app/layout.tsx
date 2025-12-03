import type { Metadata } from "next";
import "./globals.css";
import "@fontsource/noto-serif-sc";
import "@fontsource/inter";

export const metadata: Metadata = {
  title: "ChineseDuDu (中文读读)",
  description: "Learn Chinese through reading AI-generated stories.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className="antialiased bg-retro-bg text-retro-text font-sans min-h-screen"
      >
        {children}
      </body>
    </html>
  );
}

