# Zilka-Kotab PC

A modern, SEO-optimized marketing website for Zilka-Kotab PC — a Silicon Valley intellectual property law firm specializing in patent strategy and prosecution.

## Run & Operate

- `pnpm --filter @workspace/zilka-kotab run dev` — run the website (managed via workflow `artifacts/zilka-kotab: web`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/zilka-kotab run build` — build static output to `artifacts/zilka-kotab/dist/public/`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite (react-vite artifact at `/`)
- Routing: Wouter (SPA)
- Styling: Tailwind CSS v4
- Animation: Framer Motion (scroll-reveal, animated counters)
- SEO: react-helmet-async (per-page meta, OG tags, Twitter cards, JSON-LD)
- Forms: react-hook-form + zod validation

## Where things live

- `artifacts/zilka-kotab/src/pages/` — Home, About, Services, Team, Contact
- `artifacts/zilka-kotab/src/components/` — Navbar, Footer, SEO, FadeIn, AnimatedCounter
- `artifacts/zilka-kotab/src/index.css` — theme tokens and global styles
- `artifacts/zilka-kotab/public/images/` — AI-generated site images (hero, services, team portraits)
- `artifacts/zilka-kotab/index.html` — base HTML with default SEO meta

## Architecture decisions

- **No backend**: purely static SPA; contact form simulates submission client-side
- **SEO via react-helmet-async**: per-page Helmet with unique title/description/OG/Twitter tags; Schema.org LegalService JSON-LD on home page
- **AI-generated images**: hero, patent concept, and team portraits generated at build time and served from `public/images/`
- **Wouter** for routing (lightweight, no React Router dependency)

## Product

Five pages: Home (hero + stats + services overview + CTA), About (firm story + location), Services (detailed practice areas), Our Team (attorney profiles), Contact (validated form + contact info).

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Brand primary color: `#1B268C` (navy/indigo) — preserve in theme updates
- Images referenced as `${import.meta.env.BASE_URL}images/filename` (not via `@assets`) since they are in `public/`
- Logo imported via `@assets/zilka-logo.png` (alias points to `attached_assets/`)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
