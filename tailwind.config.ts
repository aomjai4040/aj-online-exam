import type { Config } from "tailwindcss";

/**
 * ⚠️  Rule: DO NOT use custom colours inside CSS `@apply` directives.
 *     Tailwind JIT processes CSS before it scans JSX content files, so custom
 *     colour utilities don't exist yet at that stage → build error.
 *
 *  ✅  Custom colours here ARE safe to use directly in JSX classNames, e.g.:
 *       className="bg-mint-500 text-mint-700"
 *      because JIT scans JSX files and generates those utilities at that point.
 *
 *  ✅  For CSS @apply, use standard Tailwind colours (teal, emerald, …) or
 *      arbitrary values like `focus:ring-[#00BFA5]`.
 */
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-prompt)", "Prompt", "system-ui", "sans-serif"],
      },
      colors: {
        // AJ Brand – mint palette (usable in JSX classNames)
        mint: {
          50:  "#E0F7F4",
          100: "#B2EBE0",
          200: "#80DECC",
          400: "#26C6A5",
          500: "#00BFA5",   // primary brand mint
          600: "#00A896",
          700: "#00897B",
        },
        // Keep original primary shades for admin / exam pages
        primary: {
          50:  "#eff6ff",
          100: "#dbeafe",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
        },
      },
      backgroundImage: {
        "aj-gradient":
          "linear-gradient(135deg, #00BFA5 0%, #0069B4 60%, #0D47A1 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
