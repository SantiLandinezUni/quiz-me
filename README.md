# QuizMe

QuizMe helps university students turn their professors' lecture slides into practice quizzes so they can test themselves before exams.

Built with Next.js (App Router, TypeScript, Tailwind), Supabase (Auth + Postgres with Row Level Security) and Google Gemini.

## Run locally

1. Install Node.js 20 or newer.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a file called `.env.local` in the project root with the variables listed below.
4. In Supabase, run `supabase/schema.sql` (SQL Editor → New query → Run) and turn off email confirmation (Authentication → Sign In / Providers → Email → "Confirm email" off).
5. Start the dev server:
   ```bash
   npm run dev
   ```
6. Open http://localhost:3000

## Environment variables

| Name | Where it is used |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server (public) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser + server (public, publishable/anon key) |
| `GEMINI_API_KEY` | Server only (quiz generation route). Never prefix with `NEXT_PUBLIC_`. |

Never commit `.env.local` or the Supabase service_role/secret key.

## Pages

- `/` landing page
- `/signup`, `/login` email + password auth
- `/app` your study sets (logged-in only)
- `/app/sets/[id]` material, quiz generation and practice
