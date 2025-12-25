import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // Emergency Custom Colors
        panic: {
          DEFAULT: "hsl(var(--panic))",
          glow: "hsl(var(--panic-glow))",
        },
        safe: {
          DEFAULT: "hsl(var(--safe))",
          glow: "hsl(var(--safe-glow))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          glow: "hsl(var(--warning-glow))",
        },
        help14: {
          DEFAULT: "hsl(var(--help-14))",
          glow: "hsl(var(--help-14-glow))",
        },
        mats: {
          green: "hsl(var(--mats-green))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'Fira Code', 'monospace'],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "pulse-panic": {
          "0%, 100%": { 
            boxShadow: "0 0 0 0 hsl(var(--panic) / 0.7)",
            transform: "scale(1)"
          },
          "50%": { 
            boxShadow: "0 0 0 20px hsl(var(--panic) / 0)",
            transform: "scale(1.02)"
          },
        },
        "pulse-help": {
          "0%, 100%": { 
            boxShadow: "0 0 0 0 hsl(var(--help-14) / 0.8)",
            transform: "scale(1)"
          },
          "50%": { 
            boxShadow: "0 0 0 15px hsl(var(--help-14) / 0)",
            transform: "scale(1.05)"
          },
        },
        "slide-up": {
          from: { transform: "translateY(100%)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "slide-down": {
          from: { transform: "translateY(-100%)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "scale-in": {
          from: { transform: "scale(0.95)", opacity: "0" },
          to: { transform: "scale(1)", opacity: "1" },
        },
        "shake": {
          "0%, 100%": { transform: "translateX(0)" },
          "10%, 30%, 50%, 70%, 90%": { transform: "translateX(-4px)" },
          "20%, 40%, 60%, 80%": { transform: "translateX(4px)" },
        },
        "ripple": {
          "0%": { transform: "scale(0)", opacity: "0.5" },
          "100%": { transform: "scale(4)", opacity: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-panic": "pulse-panic 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "pulse-help": "pulse-help 1s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "slide-up": "slide-up 0.3s ease-out",
        "slide-down": "slide-down 0.3s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
        "shake": "shake 0.5s ease-in-out",
        "ripple": "ripple 0.6s ease-out",
      },
      spacing: {
        "safe-top": "env(safe-area-inset-top, 0)",
        "safe-bottom": "env(safe-area-inset-bottom, 0)",
        "safe-left": "env(safe-area-inset-left, 0)",
        "safe-right": "env(safe-area-inset-right, 0)",
      },
      boxShadow: {
        "panic": "0 0 30px hsl(var(--panic) / 0.4)",
        "safe": "0 0 20px hsl(var(--safe) / 0.3)",
        "card": "0 4px 20px hsl(0 0% 0% / 0.5)",
        "glow": "0 0 40px hsl(var(--panic) / 0.5)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
