import type { Config } from "tailwindcss";

export default {
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "var(--background)",
                foreground: "var(--foreground)",
                retro: {
                    bg: "var(--retro-bg)",
                    paper: "var(--retro-paper)",
                    primary: "var(--retro-primary)",
                    secondary: "var(--retro-secondary)",
                    accent: "var(--retro-accent)",
                    text: "var(--retro-text)",
                    muted: "var(--retro-muted)",
                }
            },
            fontFamily: {
                serif: ['"Noto Serif SC"', 'serif'],
                sans: ['"Inter"', 'sans-serif'],
            },
        },
    },
    plugins: [],
} satisfies Config;
