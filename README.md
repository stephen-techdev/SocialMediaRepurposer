# Social Media Repurposer

Turn one story into platform-native posts in the language your audience actually reads — including Tamil, Hindi, Telugu, Kannada and Malayalam.

---

## Quick start

```bash
npm install
cp .env.example .env     # then fill in AI_API_KEY
npm run dev
```

Open http://localhost:5173

The app boots with **no configuration at all**. Without keys it runs in local-only mode using the built-in offline generator and `localStorage`.

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server + the secret-holding AI proxy |
| `npm run build` | Production bundle into `dist/` |
| `npm run preview` | Serve the build (AI proxy stays active) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run doctor` | Check configuration and connectivity |
| `npm run verify-ai` | Prove the AI path against a mock provider — no real API call, never touches `.env` |

---

## Environment variables

Two distinct classes, and the difference is the whole security model.

### 1. Server-only secrets (never reach the browser)

Read by `server/aiProxy.ts` at request time. These have **no `VITE_` prefix**, so Vite never copies them into the client bundle.

```dotenv
APP_SECRET=...          # signs an HttpOnly session cookie (see Security)
AI_PROVIDER=openai      # openai | gemini | openrouter | groq | together | ollama | custom
AI_API_KEY=...          # your provider key
AI_BASE_URL=            # optional, defaults per provider
AI_MODEL=               # optional, defaults per provider
AI_TEMPERATURE=0.8
AI_MAX_TOKENS=4000
AI_TIMEOUT_MS=60000
AI_RATE_LIMIT=30        # requests per IP per minute
```

Supported providers and their defaults:

| Provider | Base URL | Default model | Key needed |
| --- | --- | --- | --- |
| `openai` | `https://api.openai.com/v1` | `gpt-4o-mini` | yes |
| `gemini` | `https://generativelanguage.googleapis.com/v1beta` | `gemini-2.0-flash` | yes |
| `openrouter` | `https://openrouter.ai/api/v1` | `openai/gpt-4o-mini` | yes |
| `groq` | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` | yes |
| `together` | `https://api.together.xyz/v1` | `Llama-3.3-70B-Instruct-Turbo` | yes |
| `ollama` | `http://127.0.0.1:11434` | `llama3.1` | no — fully local |

Any other OpenAI-compatible endpoint: `AI_PROVIDER=custom` plus `AI_BASE_URL` and `AI_MODEL`.

### 2. Client-visible config

There are no client-visible secrets any more. Sign-in and cloud sync have been removed, so the app has no `VITE_*` variables to set. History, favourites, analytics and preferences all live in this browser's localStorage.

---

## Security model

The AI key never touches the client. The browser calls `POST /api/generate`; the Node process reads the key from `.env` and relays to the provider.

Two extra protections on that route:

- **`APP_SECRET` session guard.** `/api/health` sets an `HttpOnly`, `SameSite=Strict` cookie signed with HMAC-SHA256. `/api/generate` refuses to spend the API key without a valid one. Without this, any website you visit could POST to `http://localhost:5173/api/generate` and drain your quota.
- **Rate limit + body cap.** `AI_RATE_LIMIT` per IP per minute, 200 KB request cap, `timingSafeEqual` on signature checks.

This is a **local-dev guard, not production auth.** Locally it stops other websites from POSTing to `http://localhost:5173` and burning your quota. It is not authentication: in production, anyone who can load the app is handed a valid cookie and can then spend your quota. The rate limit is also per-process, so a serverless fleet multiplies the effective ceiling.

**Before exposing a deployment publicly, put real authentication in front of `/api/generate`** (or delete the function and let the app run its offline generator). The deployed instance described below is fine for personal use on a protected URL, not for an open site.

`.env` is git-ignored; `.env.example` is committed.

---

## Deploying to Vercel

The AI proxy is not a static asset — it needs a Node runtime. `api/health.ts` and `api/generate.ts` are serverless functions that reuse the same core as the local dev server, so the key stays server-side on Vercel too. Vercel will not read your `.env`; set the variables in the dashboard (or with `vercel env add`).

```bash
npx vercel link --project <name>
npx vercel env add AI_API_KEY production --sensitive   # pipes from stdin; the value is never in a command line
npx vercel env add APP_SECRET production --sensitive
npx vercel --prod
```

Without `AI_API_KEY` the deployment still builds and runs — the app detects that no provider is configured and uses the offline generator. `GET /api/health` reports `aiEnabled: false` so you can confirm which mode you are in.

Two Vercel-specific notes:

- **Set every AI variable as a Secret.** They are read inside the function, never in the browser, so `--sensitive` is correct. Vercel rejects `--sensitive` on a `VITE_`-prefixed name, because those are compiled into the public bundle.
- **Imports in `server/` and `api/` use explicit `.js` extensions.** Vercel compiles the functions to native ESM, and Node's ESM resolver does not do extensionless lookups. Vite hides this, so the app passes `typecheck` and works locally while every function fails in production with `ERR_MODULE_NOT_FOUND` if you drop them.

---

## Architecture

```
server/aiCore.ts        Host-agnostic AI core. Provider dispatch, rate limit,
                       JSON extraction. No Vite or Vercel imports.
server/aiHandler.ts     The /api/generate request logic, written against a small
                       transport interface so both hosts run identical checks.
server/aiSession.ts     HMAC session-cookie signing and verification.
server/aiProxy.ts       Vite dev/preview adapter for the above.
api/health.ts           Vercel serverless function  -> GET  /api/health
api/generate.ts         Vercel serverless function  -> POST /api/generate
src/lib/prompts.ts      Per-platform playbooks + the system prompt. The playbook
                        is the main quality lever: raw "write a post" prompts
                        produce generic output.
src/lib/viral.ts        Virality scoring (6 weighted dimensions) + the tactics
                        injected into the prompt.
src/lib/images.ts       Optional image attachments. Browser-only, never uploaded.
src/lib/utils.ts        Unicode-safe text engine: sentence splitting, keyword
                        extraction, Tamil romanisation, hashtag building.
src/lib/contentGenerator.ts
                        Orchestration + output validation. Two engines.
src/lib/store.ts        Persistence. localStorage only - there are no accounts.
src/lib/supabase.ts     Row types (Post, Analytics, Profile). No client is created.
```

### Two engines

**AI engine** — server-side LLM. Produces genuine variations, one request per platform, all platforms in parallel.

**Offline engine** — deterministic, no network. It only restructures your own words; it never invents facts. Variations differ in sentence budget, ordering, emoji and CTA wording.

If the AI call fails for one platform, only that platform falls back — a single bad request never wipes out the batch.

### What was wrong before, and what changed

| Before | Now |
| --- | --- |
| Casual tone lowercased everything and turned every `.` into `!` | `adjustTone` adjusts punctuation intensity only; casing and content untouched |
| Sentence split on any `.` — broke `Dr.`, `12.5 crore`, URLs | Abbreviation- and decimal-aware splitting |
| `[^\w\s]` regex deleted every Tamil/Devanagari character, so Indic input produced **zero** keywords | `\p{L}\p{M}\p{N}` throughout; proper-noun boosting |
| Hashtags chopped mid-tag into dead `#tharapu…` | Only whole tags are ever appended; overflow tags are dropped with a note |
| Same text returned 3× with different emoji | Deterministic per-variation sentence budget, rotation, CTA and emoji |
| Generated "Introducing a revolutionary solution…" regardless of input | Output derived from your content |
| Contact form faked a success toast | Opens a pre-filled `mailto:` |
| Missing backend threw at startup | Everything works from localStorage; there is no backend |

---

## Features

### Variations
1–5 per platform, each taking a different angle. Selectable platforms run in parallel.

### Virality
Twelve levers (curiosity gap, numbers, identity, contrast, stakes, share trigger, debate, local pride…) at four intensity levels, plus three presets. Every post is scored 0–100 on hook strength, specificity, scannability, share/comment triggers, length fit and emotional pull, with a breakdown and concrete fixes.

The scoring measures the **caption body** — hashtags and CTA are excluded, since charging them to the caption budget made correct posts look wrong.

### Images (optional)
Up to 6 images, drag-and-drop or browse, with thumbnails, dimensions and size.

**Images never leave your device.** They are read in the browser, downscaled, and only the filename and dimensions reach the prompt — the AI never receives pixel data, so any alt text it produces is a guess and is labelled as such. You get platform-correct format guidance (aspect ratio, carousel count, per-platform notes) instead.

### Options
Platforms · variations · audience (11 segments) · content type (12) · tone (9) · language (24) · hook style (8) · length (4) · emoji density (4) · hashtag count, placement and script · CTA goal or custom text · must-include tags · free-text extra instructions.

Hashtag script matters more than it looks: native-script tags reach almost nobody on most platforms, so romanised Tamil (`#tharapuram`) travels considerably further than `#தாராபுரம்`. Both options are available.

Settings persist to `localStorage`, so a half-built setup survives navigation.

---

## Known limitations

- **The offline generator cannot rewrite.** Without an LLM it restructures your words; it does not produce new phrasing. Configure an AI key for real rewriting.
- **Alt text is model-guessed.** The AI cannot see your images, so treat generated alt text as a starting draft and check it.
- **Image pixels are not analysed.** No automatic cropping to platform aspect ratio or visual summarisation.
- **Virality score is a heuristic**, not a prediction of reach. It encodes known platform patterns, not outcomes.
- **PDF and DOCX upload is not implemented.** Paste the text, or use `.txt`/`.md`/`.csv`/`.json`.
- **Two localStorage stores must not collide** with another app using the same host and port — the key namespace is `smr:*`.

---

## Privacy

Prompts are sent to whichever AI provider you configure — read their policy before pasting sensitive material. Images never leave the browser. History, favourites and analytics are stored only in this browser's localStorage - there is no account and no server-side copy.
