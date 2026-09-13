<div align="center">

# ✦ Actify

**Tell it what's on your plate. It tells you what to do with what's left.**

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-Installable-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)

### [→ Try it live](https://actify-iota.vercel.app/)

</div>

---

## What it does

Most to-do apps just show you a list. Actify does one more thing: it reads your schedule, finds the actual gaps in your day, asks how you're feeling, and pulls a real suggestion — a movie that fits in the time you have, a book, a game, an article, or something simple like "go for a walk" — based on what you're into and what you've said yes or no to before.

Add a meeting, add a task, tell it your mood, get an idea. That's the whole loop.

<div align="center">

<!-- Add a screenshot or two here once you've got them -->
<!-- <img src="assets/screenshot-home.png" width="360" alt="Actify home screen" /> -->

</div>

## Features

- Google sign-in, no passwords to manage
- Fully custom pixel-art character — skin, hair, eyes, glasses, the works, all drawn in code with SVG (no image files)
- One unified "Your Day" view: busy times, an optional read-only Google Calendar sync, and a to-do list, all in one place
- Recurring schedule items (gym every Mon/Wed/Fri, etc.)
- Free-time detection that actually accounts for what's already on your day
- Mood-based recommendations pulling from TMDB, Open Library, RAWG, dev.to, and Hacker News — mixed in with a hand-written set of offline activities
- A feedback loop (loved / good / meh / no) that adjusts what gets suggested to you next
- Nearby cafés, restaurants, and parks via OpenStreetMap when you pick something to go out and do
- Installable as a PWA — add it to your home screen and it behaves like a real app

## Tech stack

Plain HTML, CSS, and JavaScript. No framework, no build step, no bundler.

- **Auth + database:** Supabase (Postgres, Auth, Row Level Security)
- **APIs:** TMDB, Open Library, RAWG, dev.to, Hacker News (Algolia), Google Calendar, OpenStreetMap Overpass
- **Hosting:** Vercel

Every API used here has a genuinely free tier — no card required, nothing that can quietly start charging you.

## How it works

1. You log in and set up a character and a handful of interests, rated 1–10.
2. You add busy times and tasks from one modal on the home screen.
3. Actify looks at what's left in your day and shows you the biggest open chunk.
4. Pick a mood, and it scores a pool of activities against your interests, your mood, and what you've done recently, then shows you the top three — mixing real content with simple offline ideas.
5. Say what you thought of each one. That feedback nudges your interest ratings up or down, so the suggestions actually get better over time instead of repeating themselves.

## Running it locally

No install step — it's static files.

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/login.html`. You'll need your own Supabase project (schema lives in `supabase/schema.sql`), a Google OAuth client for login plus a separate one for Calendar read access, and your own free API keys for TMDB and RAWG, dropped into `js/adapters/tmdb.js` and `js/adapters/rawg.js`.

Deployed on Vercel — `vercel.json` sets basic security headers, and `sw.js` handles the PWA install/offline shell.

## What I learned

This one kept growing past what I'd originally scoped, and I let it, because the core idea only really works once every piece is in place — free time detection alone isn't useful without recommendations, and recommendations aren't useful without knowing what you like. Splitting the busy-time engine, the recommendation engine, and each content source into its own file made all of that manageable instead of one giant mess.

The character customizer went through a couple of redesigns after the first pass looked more like a Halloween mask than a face. Good reminder that "it renders" and "it looks right" are two different checkpoints.

---

<div align="center">

Built by [Zeyad-101](https://github.com/Zeyad-101)

</div>
