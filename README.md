# RoleFit — AI Interview & Resume Readiness Platform

RoleFit analyzes how well your resume fits a target job description, generates
likely technical and behavioral interview questions with ideal answers, flags
concrete skill gaps, builds a prep plan, and lets you practice those questions
in an interactive mock-interview mode where an AI grades your typed answers.
It can also generate a tailored, ATS-friendly version of your resume as a PDF.

## Why this exists

Most "AI resume tool" demos are single-shot: upload → get a static report →
done. RoleFit treats that report as the *start* of preparation, not the end —
Mock Interview Practice Mode turns the generated questions into an actual
practice loop with scored feedback, so the tool is useful the week before an
interview, not just the day you apply.

## Architecture

```
Frontend (React + Vite)              Backend (Express + MongoDB Atlas)
├─ features/marketing (landing)      ├─ routes → middlewares → controllers
├─ features/auth                     ├─ services/ai.service.js (Gemini)
├─ features/readiness (dashboard)    ├─ models (Mongoose)
├─ features/practice                 └─ centralized error handling
├─ features/copilot
├─ components/ (AppShell, Toast, EmptyState, ScoreBadge — shared UI)
├─ style/index.css (design tokens + component classes)
└─ lib/apiClient.js (shared axios)
```

**Routes:** `/` (public landing) → `/login` / `/register` → `/dashboard`
(protected) → `/reports/:id` → `/reports/:id/practice` or
`/reports/:id/copilot`. Every authenticated route renders inside a persistent
`AppShell` nav so there's always a way back to the dashboard.

## Career Copilot

A context-aware chat scoped to a single readiness report. The backend pulls
that report's job description, resume text, match score, and skill gaps into
the prompt on every message, so answers are grounded in the candidate's
actual application rather than generic advice. Conversation history is kept
client-side and re-sent each turn (capped at the last 20 messages) — there's
no server-side chat session, which keeps the feature simple and stateless,
consistent with the rest of the app's request model.

**Request flow for report generation:**
Resume PDF (multipart) → Multer (in-memory, mimetype-checked) → `pdf-parse`
extracts text → Gemini generates a match score, questions, skill gaps, and a
prep plan **constrained to a Zod schema** (via `zod-to-json-schema`, passed as
Gemini's `responseSchema`) → validated again on the way back with Zod →
persisted to MongoDB scoped to the authenticated user.

**Request flow for practice mode:**
User selects a generated question → types an answer → backend sends
`{question, idealAnswer, userAnswer}` to Gemini for grading (same
constrained-schema approach) → score + feedback stored as a subdocument on
the report, so progress persists across sessions.

## Authentication

JWT stored in an `httpOnly`, `sameSite=lax`, `secure`-in-production cookie.
Logout writes the token to a `Blacklist` collection (JWTs can't be revoked
server-side by design, so this is a deliberate workaround) with a MongoDB TTL
index so blacklist entries auto-expire instead of growing forever.

**Trade-off worth knowing:** cookie-based auth needs CSRF mitigation;
`sameSite=lax` is strong mitigation, not complete immunity, unlike a
Bearer-token-in-header scheme which sidesteps CSRF entirely by not being
auto-attached by the browser. We chose cookies for the `httpOnly` XSS
protection and simpler frontend code.

## Setup

### Backend
```bash
cd Backend
cp .env.example .env   # fill in MONGODB_URI, JWT_SECRET, GOOGLE_GENAI_API_KEY, CLIENT_URL
npm install
npm run dev
```

### Frontend
```bash
cd Frontend
cp .env.example .env   # set VITE_API_URL
npm install
npm run dev
```

The backend validates all required env vars at boot and exits immediately
with a clear message if any are missing — it won't start into a broken state.

## Security measures

- httpOnly/secure/sameSite session cookie
- bcrypt password hashing
- Zod validation on every mutating endpoint (before any DB or AI call)
- Ownership checks on every report/PDF lookup (fixes an IDOR where any
  authenticated user could fetch another user's report by ID)
- Multer mimetype + size limits on resume upload
- Rate limiting: stricter limits on AI-calling routes (they cost real money
  per request) than on general auth routes
- `helmet` for standard HTTP security headers
- Centralized error handler — internal error details are logged server-side,
  never leaked in the response

## Known limitations / next steps

- No refresh-token rotation — session simply expires after `JWT_EXPIRES_IN`
- Practice grading is single-turn (no follow-up questions from the AI)
- No resume version history — each report stores its own resume text
  independently
- Copilot conversations aren't persisted — refreshing the page clears chat
  history for that session (the report data itself is unaffected)
