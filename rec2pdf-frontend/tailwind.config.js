import typography from "@tailwindcss/typography";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  // --- AGGIUNTA SAFELIST ---
  // Forza la generazione di queste classi anche se Tailwind non le "vede" staticamente
  safelist: [
    // Gradienti base
    'bg-gradient-to-b',
    'bg-gradient-to-br',
    'bg-gradient-to-r',
    // Colori specifici per i temi Executive e Boardroom
    'from-[#030712]', 'via-[#0b1220]', 'to-[#0f172a]',
    'from-[#020b1a]', 'via-[#081d36]', 'to-[#103054]',
    
    // Pattern per i colori dei temi (Zinc, Slate, Gray, Neutral)
    // Copre le gradazioni scure (800, 900, 950) usate nei temi
    {
      pattern: /from-(zinc|slate|gray|neutral)-(800|900|950)/,
    },
    {
      pattern: /via-(zinc|slate|gray|neutral)-(800|900|950)/,
    },
    {
      pattern: /to-(zinc|slate|gray|neutral)-(800|900|950)/,
    },
    
    // Classi specifiche per il tema "Boardroom" o "Executive" se usano colori custom
    // (Se usi colori esadecimali arbitrari tipo from-[#020b1a] nel codice, 
    // Tailwind JIT dovrebbe vederli, ma se sono variabili, aggiungili qui)
  ],
  // -------------------------
  theme: {
    extend: {
      spacing: {
        3.25: "0.8125rem",
        4.5: "1.125rem",
        5.5: "1.375rem",
        7.5: "1.875rem",
        13: "3.25rem",
        15: "3.75rem",
        17: "4.25rem",
        18: "4.5rem",
        22: "5.5rem",
        25: "6.25rem",
        26: "6.5rem",
        30: "7.5rem",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      fontFamily: {
        sans: [
          '"Inter var"',
          'Inter',
          'system-ui',
          'ui-sans-serif',
          'sans-serif',
        ],
        display: [
          '"Space Grotesk"',
          '"Inter var"',
          'Inter',
          'system-ui',
          'sans-serif',
        ],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'ui-monospace', 'SFMono-Regular'],
      },
      boxShadow: {
        subtle: "0 1px 2px 0 rgba(15, 23, 42, 0.12)",
        raised: "0 18px 60px -20px rgba(8, 11, 24, 0.45)",
        focus: "0 0 0 3px rgba(99, 102, 241, 0.35)",
        inset: "inset 0 1px 0 0 rgba(255, 255, 255, 0.06)",
      },
      colors: {
        surface: {
          25: "#f6f8fb",
          50: "#ecf1f8",
          100: "#d8e2f4",
          200: "#b7c9ea",
          300: "#92a9da",
          400: "#728bc6",
          500: "#566fab",
          600: "#435891",
          700: "#2f3f6c",
          800: "#1d2a4a",
          900: "#131c35",
          950: "#0a1326",
        },
        brand: {
          25: "#f2f9ff",
          50: "#e4f3ff",
          100: "#bfe4ff",
          200: "#95d1ff",
          300: "#67bbff",
          400: "#3fa3ff",
          500: "#1f8bff",
          600: "#116fdd",
          700: "#0b56ad",
          800: "#093f80",
          900: "#072b59",
        },
        boardroom: {
          ocean: "#04142c",
          abyss: "#071c3a",
          midnight: "#0b254c",
          cobalt: "#123669",
          teal: "#1f9bbd",
          mint: "#5ce1d9",
          violet: "#6b6bff",
        },
        accent: {
          sky: "#0ea5e9",
          mint: "#14b8a6",
          amber: "#f59e0b",
          violet: "#8b5cf6",
        },
        feedback: {
          info: "#0ea5e9",
          success: "#22c55e",
          warning: "#f59e0b",
          danger: "#ef4444",
        },
        graphite: {
          50: "#f7f7f9",
          100: "#eaeaef",
          200: "#d3d5de",
          300: "#b7bac7",
          400: "#8f94a6",
          500: "#6a7087",
          600: "#4f556a",
          700: "#393f52",
          800: "#262a38",
          900: "#191c27",
        },
      },
    },
  },
  plugins: [typography],
};