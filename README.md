# Notflix

A Netflix-style app for browsing movies and TV shows, built with Next.js 15 and the [TMDB API](https://developer.themoviedb.org/docs). It covers trending and top-rated titles, genre filtering, search, movie and show detail pages, and inline season/episode browsing.

## Features

- **Home**: hero carousel and rows of popular movies and shows
- **Browse**: movies and series, filterable by genre and sortable, plus top-rated lists
- **Search**: multi-search across movies and TV (`/search`, backed by `/api/search`)
- **Details**: overview, rating, content rating, genres, cast
- **Episodes**:
  - Season pills (a dropdown for shows with more than 8 seasons) and an episode grid right on the show page
  - Episode page with breadcrumb, Prev/Next that crosses season boundaries, and a sidebar episode list
  - "Continue S2 E5" button that remembers the last episode opened (saved in `localStorage`)
- Light and dark theme, responsive layout, Vercel Analytics

## Tech stack

- [Next.js 15](https://nextjs.org) (App Router, server components) and React 19
- TypeScript
- Tailwind CSS, [shadcn/ui](https://ui.shadcn.com) components (Radix UI)
- Framer Motion, lucide-react icons, next-themes

## Getting started

Requires Node.js 20+ and a free [TMDB API key](https://www.themoviedb.org/settings/api).

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file in the project root:

   ```bash
   TMDB_API_KEY=your_tmdb_api_key
   # Only needed if TMDB is called from client components
   NEXT_PUBLIC_TMDB_API_KEY=your_tmdb_api_key
   ```

3. Start the dev server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command         | Description                      |
| --------------- | -------------------------------- |
| `npm run dev`   | Start the dev server             |
| `npm run build` | Create a production build        |
| `npm start`     | Serve the production build       |
| `npm run lint`  | Run ESLint                       |

## Project structure

```
app/
  page.tsx                      Home
  movies/, series/              Browse pages
  search/, api/search/          Search page and API route
  movie/[id]/                   Movie details
  tv/[id]/                      Show details, season picker, and episode grid (?season=N)
  tv/[id]/season/[s]/           Redirects to the show page's season view
  tv/[id]/season/[s]/episode/[e]/  Episode page
components/
  ui/                           shadcn/ui primitives
  season-picker.tsx             Season pills/dropdown
  episode-list.tsx              Episode grid and compact sidebar list
  watch-progress.tsx            Continue-watching button and progress tracking
  movie-player.tsx              Player component
utils/
  tmdb.ts                       TMDB API helpers
  episodes.ts                   Season ordering and prev/next episode logic
  helpers.ts, sort-options.ts   Misc helpers
lib/utils.ts                    `cn` class-name helper
```

## Deployment

The app deploys to [Vercel](https://vercel.com) as-is. Set `TMDB_API_KEY` (and `NEXT_PUBLIC_TMDB_API_KEY` if used) in the project's environment variables.

## Attribution

This product uses the TMDB API but is not endorsed or certified by TMDB.


## Useful links
(https://fmhy.net/)
(https://github.com/smy778/EncDecEndpoints/blob/main/README.md)

