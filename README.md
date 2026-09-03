# RoleFit

🔗 **[Live Demo](https://rolefit-beige.vercel.app)**

RoleFit is a full-stack app that checks how well a resume matches a job description, then helps you actually prepare for the interview instead of just telling you "72% match" and leaving you there.

Upload your resume + a job description -> get a match score, likely technical/behavioral questions with model answers, skill gaps, and a day-wise prep plan. Then you can practice those exact questions and get AI-graded feedback on your answers, ask a chatbot questions about your specific report, or generate a tailored ATS-friendly resume as a PDF.

## Why I built the practice mode

Most resume-matcher tools stop at the report. You get a score, maybe some bullet points, and that's it. I wanted something I'd actually use the week before an interview, so Mock Interview Practice Mode turns the generated questions into a real practice loop - answer in your own words, get scored, see what to improve.

**Stack:** React · Vite · Node.js · Express · MongoDB Atlas · Mongoose · Gemini API · JWT · Zod · Puppeteer · Jest · Vitest

## Architecture

```
Frontend (React + Vite)              Backend (Express + MongoDB Atlas)
├─ features/marketing (landing)      ├─ routes -> middlewares -> controllers
├─ features/auth                     ├─ services/ai.service.js (Gemini)
├─ features/readiness (dashboard)    ├─ models (Mongoose)
├─ features/practice                 └─ centralized error handling
├─ features/copilot
├─ components/ (AppShell, Toast, EmptyState, ScoreBadge)
├─ style/index.css
└─ lib/apiClient.js (shared axios instance)
```

Routes: `/` (landing) -> `/login` / `/register` -> `/dashboard` (protected) -> `/reports/:id` -> `/reports/:id/practice` or `/reports/:id/copilot`. Authenticated routes all render inside a persistent nav shell so you're never stuck without a way back to the dashboard.

### Report generation flow

Resume PDF (multipart) -> Multer (in-memory, checks mimetype) -> `pdf-parse` extracts the text -> Gemini generates match score + questions + skill gaps + prep plan, constrained to a Zod schema (converted via `zod-to-json-schema` and passed as Gemini's `responseSchema`) -> validated *again* with the same Zod schema on the way back (constrained output reduces bad responses, doesn't guarantee them) -> saved to MongoDB scoped to the logged-in user.

### Practice mode flow

Pick a question -> type an answer -> backend sends `{question, idealAnswer, userAnswer}` to Gemini for grading -> score + feedback gets stored as a subdocument on the report, so progress sticks around across sessions instead of resetting every time.

### Career Copilot

Chat scoped to one specific report. Every message, the backend pulls that report's job description, resume text, match score, and skill gaps into the prompt, so it's actually answering based on your application instead of giving generic advice. History is kept client-side and resent each message (capped at the last 20) - no chat session stored in the DB, kept it simple.

### Database connection

Lives at `Backend/src/config/database.js`, not `db.js` - same job, different name (a `config/` folder felt like the more honest home for it, next to `env.js`). One `mongoose.connect()` call at boot, with retry-with-backoff for transient connection failures (a brief network blip, or an Atlas IP whitelist change that hasn't fully propagated yet - not for real misconfigurations like a wrong password, which fail identically every retry). Graceful shutdown closes the connection cleanly on SIGTERM/SIGINT instead of dropping it mid-request on every redeploy.

### Deployment architecture

Frontend (Vercel) and backend (Render) are fully separate deployments - the frontend never talks to anything running on my machine. `VITE_API_URL` is baked into the frontend build at build time and points at the deployed backend's URL; the backend's `CLIENT_URL` env var points back at the deployed frontend's URL for CORS. Both sides fail loudly instead of silently if misconfigured: the backend won't boot without `MONGODB_URI`/`JWT_SECRET`/etc set (see `config/env.js`), and the frontend logs a clear console error in production if `VITE_API_URL` is missing, rather than silently falling back to `localhost:3000` - a real, sharp-edged trap in the original version of this file, since a build with that env var unset would only ever appear to "work" on a machine that happened to have a local backend running, and fail everywhere else with no obvious reason why.

One real caveat worth knowing: Render's free tier spins the backend down after a period of inactivity, so the first request after idle time can take 30-50 seconds while it cold-starts. This isn't a bug - it's a hosting-tier trade-off worth mentioning if a demo feels slow on the very first click.

### Admin activity dashboard

`/admin` (not linked from the nav - reached directly by URL) shows total users, new signups in the last 7 days, active users in the last 24 hours, total reports generated, and recent signup/login/report activity. Access is gated by email address via the `ADMIN_EMAILS` env var (comma-separated), checked in `admin.middleware.js` after the normal auth check - deliberately not a full roles/permissions system, since this has one owner who needs to see real usage during a demo, not a multi-tenant admin hierarchy. No new event-logging collection was added: "new signups" reads `User.createdAt` (already existed), "active users" reads the one new field this added (`User.lastLoginAt`, set on every successful login), and the activity feed reads `ReadinessReport.createdAt` (already existed) - all queried at request time, nothing pre-aggregated or cached to drift out of sync.

## Auth

JWT in an httpOnly, secure-in-prod cookie. sameSite is `lax` in local dev (frontend and backend are both on localhost, so they count as the same site) and `none` in production (frontend and backend live on different domains once deployed - e.g. vercel.app vs onrender.com - which makes every API call a cross-site request that `lax` would silently block). Logout writes the token to a Blacklist collection (JWT can't really be revoked server-side otherwise) with a TTL index so old entries clean themselves up automatically.

One trade-off worth knowing: cookie auth needs CSRF mitigation. `sameSite=lax` (dev) is decent mitigation but not a complete guarantee, and `sameSite=none` (prod, required for the cross-domain case above) provides none at all on its own - relying on `secure` + `httpOnly` + the app's own auth checks instead. A Bearer-token-in-header scheme sidesteps CSRF entirely since browsers never auto-attach headers cross-site. Went with cookies anyway for the httpOnly XSS protection and because it's less to manage on the frontend.

## Setup

**Backend**
```bash
cd Backend
cp .env.example .env   # MONGODB_URI, JWT_SECRET, GOOGLE_GENAI_API_KEY, CLIENT_URL, ADMIN_EMAILS (optional)
npm install
npm run dev
```

**Frontend**
```bash
cd Frontend
cp .env.example .env   # VITE_API_URL
npm install
npm run dev
```

Backend checks all required env vars on boot and exits with a clear error if something's missing, instead of starting up broken.

## Testing

Backend: Jest, focused on the security-relevant paths rather than trying to cover everything - auth middleware (missing/blacklisted/expired token rejection), the IDOR fix on report/practice/copilot controllers (a request scoped to one user can never read or act on another user's report), the admin dashboard's email-based access control, and Zod validation edge cases.

```bash
cd Backend && npm test
```

Frontend: Vitest, covering pure logic (score-color boundary values, the Copilot chat history truncation logic that fixed a real validation bug during development).

```bash
cd Frontend && npm test
```

Both run in CI on every push/PR (`.github/workflows/ci.yml`), plus a build check for both apps.

## Security stuff I paid attention to

- httpOnly/secure/sameSite cookie
- bcrypt for passwords
- Zod validation on every endpoint that mutates data, before it touches the DB or calls Gemini
- Ownership checks on report/PDF lookups - originally any logged-in user could grab another user's report just by knowing the ID (IDOR), fixed by scoping every query to the requesting user
- Multer checks file type + size on resume upload
- Rate limiting, tighter on the AI-calling routes since those cost actual money per request
- `helmet` for the usual security headers
- One error handler for the whole app - logs the real error server-side, never leaks internals in the response
- `trust proxy` set explicitly - matters once this is deployed behind a reverse proxy (Render/Railway/etc), otherwise rate limiting sees every request as coming from the proxy's IP and `secure` cookies never register as HTTPS
- Graceful shutdown on SIGTERM/SIGINT - finishes in-flight requests and closes the DB connection cleanly instead of dropping requests on every redeploy

## Known limitations

- No refresh tokens, session just expires after `JWT_EXPIRES_IN`
- Practice grading is one-shot, no follow-up questions from the AI
- No resume version history, each report just stores its own copy of the resume text
- Copilot chat isn't persisted - refresh the page and it's gone (the report itself is fine, just the conversation)

## Screenshots
### Architecture

![RoleFit Architecture](docs/architecture.png)

### Report Generation Flow

![Report Generation Sequence](docs/sequence-diagram.png)

### Landing Page
![RoleFit Landing Page](docs/landing.jpeg)

### Dashboard
![RoleFit Dashboard](docs/dashboard.jpeg)

### AI Readiness Report
![AI Readiness Report](docs/report.jpeg)

### Mock Interview Practice
![Mock Interview Practice](docs/practice.jpeg)

### Career Copilot
![Career Copilot](docs/copilot.jpeg)
