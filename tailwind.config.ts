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
                    bg: "#1a1b26", // Deep blue-grey
                    paper: "#24283b", // Slightly lighter
                    primary: "#7aa2f7", // Soft blue
                    secondary: "#bb9af7", // Soft purple
                    accent: "#ff9e64", // Orange
                    text: "#c0caf5", // Light blue-grey
                    muted: "#565f89",
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
