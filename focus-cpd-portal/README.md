# Focus Vision CPD Portal

An online Continuing Professional Development portal for Focus Vision Clinic (Brisbane). Optometrists complete CPD courses — pre-reading, video lecture, MCQ quiz — and receive a branded PDF certificate by email, permanently re-downloadable from their CPD record. (The certificate supports each optometrist's self-directed CPD under the Optometry Board of Australia registration standard; the Board does not accredit third-party CPD providers.)

## Architecture

- **Frontend:** Vite + React + Tailwind single-page app. Talks to Supabase directly with `supabase-js` — no backend server, no ORM. Row Level Security protects all data.
- **Supabase:** Auth (email verification), Postgres database, and Storage (videos, pre-reading PDFs, certificate PDFs).
- **Netlify Functions:** one function only — `issue-certificate` — which generates the PDF, stores it, and emails it via Resend (these need server-side secrets).
- **Hosting:** Netlify (SPA + function), same as the main focusvision.com.au site.

```
focus-cpd-portal/
├── src/                      React app (portal + admin)
├── netlify/functions/        issue-certificate.mjs (PDF + email)
├── supabase/
│   ├── migration.sql         Schema, RLS policies, grading fn, storage buckets
│   ├── upgrade.sql           Upgrade 1: server-side grading + integrity fixes
│   ├── upgrade2.sql          Upgrade 2: therapeutic CPD flag + reflections
│   ├── upgrade3.sql          Upgrade 3: certificate revocation + set_admin
│   └── seed.sql              3 example courses with MCQs
├── public/                   Focus Vision logos
├── netlify.toml              Build + function config
└── .env.example              All environment variables
```

## Quick preview (no Supabase needed)

Demo mode is a full in-browser mock (sample data, simulated emails and PDF downloads, admin area included). Sign-in accepts anything. Run it with:

```bash
npm install
VITE_DEMO=1 npm run dev          # dev server at http://localhost:5173
# or a production-style preview:
VITE_DEMO=1 npm run build && npm run preview
```

Demo mode is gated on `VITE_DEMO=1` exactly (see `src/lib/supabase.js`), so a normal build is never accidentally a demo.

## Setup

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste the contents of `supabase/migration.sql`, and run it. This creates every table, all RLS policies, the storage buckets, the quiz-grading function, and the public certificate-verification function. *(Existing database? Run the `upgrade*.sql` files you haven't applied yet, in order, instead of the migration.)*
3. Run `supabase/seed.sql` the same way for the 3 example courses.
4. In **Authentication → Providers → Email**, leave **Confirm email** enabled (registration requires email verification).
5. In **Authentication → URL Configuration**, set the **Site URL** to your deployed URL, and add these to **Redirect URLs**: `https://YOUR-SITE/reset-password`, plus `http://localhost:5173` and `http://localhost:5173/reset-password` for local dev (password-reset emails link to `/reset-password`).

### 2. Make yourself an admin

Register through the app first (so your profile row exists), verify your email, then run in the SQL Editor:

```sql
update public.profiles set is_admin = true where email = 'you@focusvision.com.au';
```

Sign out and back in — the Admin menu appears. This SQL step is only needed for the **first** admin: after that, promote others from **Admin → Users** in the app.

### 3. Resend

1. Create an account at [resend.com](https://resend.com) and verify your sending domain (e.g. `focusvision.com.au`).
2. Create an API key.
3. Use a from address on the verified domain, e.g. `Focus Vision CPD <cpd@focusvision.com.au>`.

### 4. Environment variables

Copy `.env.example` to `.env` and fill in the values. The `VITE_*` keys are the public anon credentials (safe in the browser). The rest are **secrets used only by the Netlify Function** — set them in Netlify under **Site settings → Environment variables**, and never prefix them with `VITE_`.

| Variable | Where | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Frontend | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Supabase anon/public key |
| `SUPABASE_URL` | Function | Same project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Function | Service role key (bypasses RLS — secret) |
| `RESEND_API_KEY` | Function | Resend API key |
| `RESEND_FROM` | Function | Verified from address |
| `SITE_URL` | Function | Used for links in the email (falls back to the Netlify deploy URL) |

### 5. Run locally

```bash
npm install
npm run dev            # frontend only at http://localhost:5173

# OR, to also run the certificate function locally:
npm install -g netlify-cli
netlify dev            # http://localhost:8888 — reads .env automatically
```

Note: certificate generation calls `/.netlify/functions/issue-certificate`, so use `netlify dev` when testing the full completion flow locally.

### 6. Deploy to Netlify

1. Push this folder to a Git repository and connect it to a new Netlify site (build settings are read from `netlify.toml` automatically: build `npm run build`, publish `dist`).
2. Add all environment variables from the table above.
3. Deploy. Update the Supabase **Site URL** (step 1.5) to the live URL.

## How it works

**Optometrist flow:** register (full name, practice, optional AHPRA number) → verify email (with a resend option) → browse catalogue → course: pre-reading tick-box (if any) → embedded video → MCQ quiz → submit. The quiz is **graded server-side** (`submit_quiz` Postgres function) and the certificate is awarded on completion **regardless of score** — the score is recorded and shown with correct answers and explanations after submission. The certificate appears on screen immediately (screenshot-friendly, identical to the PDF), is emailed via Resend, and is always re-downloadable from **My CPD Record**.

**Account self-service:** forgot-password reset by email (`/forgot-password`), and a **Profile** page to correct full name (used on future certificates), practice, and AHPRA number.

**Therapeutic CPD:** courses can be flagged as therapeutic (scheduled-medicines content) in the admin. The flag appears on the catalogue, the course page, the certificate (on-screen, PDF, and email), the public verification page, and the admin CSV. **My CPD Record** shows separate totals for overall and therapeutic hours — matching how therapeutically endorsed optometrists must report (30 h total incl. 10 h therapeutic per registration period).

**Learning reflections:** after completing a course, optometrists can write an optional reflection ("what I learned / how I'll apply it") — supporting the OBA CPD portfolio requirement. Reflections are editable any time from the result page or My CPD Record; users can only ever edit the reflection on their own completions (column-level grant), and scores/dates stay immutable.

**Retakes:** allowed any time; every attempt is logged, but the original completion and certificate stand.

**Admin:** create/edit/**duplicate** courses (details, CPD hours, therapeutic flag, learning objectives, categories, video upload **or** embed link, pre-reading PDFs, unlimited MCQs with explanations), publish/unpublish drafts. Courses with recorded completions **cannot be deleted** (CPD records must stand) — unpublish them instead. The admin area has four sections:

- **Completions** — searchable/filterable dashboard (name, course, date range) with pagination, CSV export (respects filters), and per-row actions: download the PDF, re-send the certificate email, and **revoke/reinstate** certificates. Revoked certificates show as revoked on `/verify`, can't be downloaded, and don't count toward the optometrist's hour totals.
- **Courses** — manage and duplicate courses.
- **Users** — every registered optometrist (including those yet to complete a course), searchable, with completion counts and admin promotion/demotion. Promotion runs through a guarded `set_admin` database function — no more SQL editor, and you can't remove your own access.
- **Analytics** — per-course completions, attempts, average scores, and per-question miss rates to spot badly worded questions.

**Verification:** anyone — no login — can confirm a certificate at `/verify` using its ID (e.g. `FV-2026-A1B2C3`).

## Security model

- Every table has RLS enabled. Users see only their own attempts, completions, and certificates; admins (flagged in `profiles.is_admin`) see everything.
- Course content is only readable by signed-in users; drafts only by admins.
- A column-level grant prevents users from setting `is_admin` on their own profile.
- **Quizzes are graded server-side.** Learners fetch questions from the `quiz_questions` view, which never exposes `correct_index` or `explanation`; answers go to the `submit_quiz` Postgres function, which grades, logs the attempt, and records the completion in one transaction. The client has **no insert access** to `attempts`, `attempt_answers`, or `completions`, so scores and completions can't be forged.
- The `certificates` table has **no insert policy** — rows can only be created by the Netlify Function using the service role key (which also verifies a real quiz attempt exists), so certificates can't be forged from the browser.
- Certificate PDFs live in a private bucket at `{user_id}/{certificate_id}.pdf`; storage policy lets users read only their own folder. Buckets enforce size limits and MIME types (video 1 GB; PDFs 20 MB).
- `completions`/`certificates` reference courses with `ON DELETE RESTRICT` — issued CPD records and certificates survive forever, and `/verify` keeps working.
- If the certificate email fails (tracked via `certificates.email_sent`), the learner can re-send it with one click; the certificate itself is never blocked by email problems.

## Notes

- Seed-course videos are placeholders — replace them with your own Vimeo/YouTube unlisted links or uploads in the admin.
- `numeric(4,2)` CPD hours supports values like 1.0, 1.5, 2.25.
- Certificate IDs use an unambiguous alphabet (no 0/O/1/I).
