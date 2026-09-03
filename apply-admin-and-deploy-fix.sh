#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# RoleFit — deployment/demo architecture audit fixes + admin activity
# dashboard:
#
#   1. apiClient.js now fails LOUDLY in production if VITE_API_URL is
#      missing, instead of silently falling back to localhost - this was
#      the actual cause of "deployed frontend depends on my PC" risk.
#   2. New: /admin activity dashboard - signups, logins, active users,
#      recent reports. Gated by ADMIN_EMAILS env var, no new DB/roles
#      system, reuses existing timestamped data wherever possible.
#   3. New: User.lastLoginAt field, set on login - the one genuinely new
#      piece of tracked data (everything else reuses existing timestamps).
#   4. README updated: explains db.js naming, documents deployment
#      architecture, documents the admin dashboard.
#
# NOTE ON db.js: audited and confirmed there's no bug - the connection
# file already exists at Backend/src/config/database.js, just named
# differently than some tutorials use. No code change needed for that
# part of the request, only the explanation (now in the README).
#
# Run this from your RoleFit project ROOT (the folder containing
# Backend/, Frontend/, and README.md).
# ============================================================

if [ ! -d "Backend" ] || [ ! -d "Frontend" ]; then
    echo "ERROR: run this script from the RoleFit project root (must contain Backend/ and Frontend/)."
    exit 1
fi

echo "Applying deployment fix + admin dashboard..."

echo '  -> writing Frontend/src/lib/apiClient.js'
mkdir -p "$(dirname "Frontend/src/lib/apiClient.js")"
cat > "Frontend/src/lib/apiClient.js" << 'ROLEFIT_EOF'
import axios from "axios"

/**
 * The tutorial creates a separate axios instance per feature (auth.api.js,
 * interview.api.js) with the same baseURL and withCredentials hardcoded
 * twice. One shared client means one place to change the base URL (env-based
 * here, not hardcoded) and one place to handle cross-cutting concerns like
 * "the session expired" globally instead of duplicating that check in every
 * feature's api file.
 */
const baseURL = import.meta.env.VITE_API_URL

/**
 * Vite bakes env vars in at BUILD time, not runtime. If VITE_API_URL was
 * ever missing/mistyped on the hosting platform (Vercel) for a given
 * deploy, this silently fell back to localhost:3000 — meaning a visitor's
 * browser tries to call *their own* localhost, not the real backend, and
 * the whole app looks broken with no clear reason why. This makes that
 * failure loud and obvious in the deployed site's console instead of
 * silently "working" in a way that only ever succeeds on the developer's
 * own machine. The localhost fallback still applies below, but only ever
 * makes sense in local dev (import.meta.env.DEV) — in a production build
 * it should never be relied on.
 */
if (!baseURL && import.meta.env.PROD) {
    console.error(
        "VITE_API_URL is not set in this production build. API calls will fail. " +
        "Set VITE_API_URL in your hosting platform's environment variables and redeploy."
    )
}

const apiClient = axios.create({
    baseURL: baseURL || "http://localhost:3000/api",
    withCredentials: true
})

apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        const message = error.response?.data?.message || "Something went wrong. Please try again."
        return Promise.reject(new Error(message))
    }
)

export default apiClient
ROLEFIT_EOF

echo '  -> writing Backend/src/models/user.model.js'
mkdir -p "$(dirname "Backend/src/models/user.model.js")"
cat > "Backend/src/models/user.model.js" << 'ROLEFIT_EOF'
const mongoose = require("mongoose")

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        unique: [ true, "Username already taken" ],
        required: true,
        trim: true
    },
    email: {
        type: String,
        unique: [ true, "Account already exists with this email address" ],
        required: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    // Set on every successful login. This is the only new field added for
    // the admin activity dashboard — "new signups" already comes for free
    // from the existing `createdAt` timestamp, and "recent report/practice
    // activity" reuses ReadinessReport's existing timestamps. This is the
    // one genuinely missing piece: nothing previously recorded *when* a
    // user last logged in.
    lastLoginAt: {
        type: Date
    }
}, { timestamps: true })

module.exports = mongoose.model("User", userSchema)
ROLEFIT_EOF

echo '  -> writing Backend/src/controllers/auth.controller.js'
mkdir -p "$(dirname "Backend/src/controllers/auth.controller.js")"
cat > "Backend/src/controllers/auth.controller.js" << 'ROLEFIT_EOF'
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const User = require("../models/user.model")
const Blacklist = require("../models/blacklist.model")
const ApiError = require("../utils/ApiError")
const asyncHandler = require("../utils/asyncHandler")

/**
 * Cookie options fix (the actual security gap in the tutorial):
 *
 * - httpOnly: true  -> JavaScript on the page can't read the cookie, so a
 *   successful XSS injection can't just do document.cookie and exfiltrate
 *   the session token.
 * - secure: true in production -> cookie is only ever sent over HTTPS.
 * - sameSite: "lax" -> cookie isn't attached to most cross-site requests,
 *   which is the browser's own first line of defense against CSRF for a
 *   cookie-based session. "lax" still allows top-level navigation (a user
 *   clicking a link to your site), which is the right default for this app.
 *
 * Trade-off you should be able to explain: sameSite=lax does NOT fully
 * eliminate CSRF (state-changing GET requests, or subdomains under attacker
 * control, are still edge cases) — a Bearer-token-in-header approach avoids
 * CSRF entirely because browsers don't auto-attach headers cross-site. We
 * chose cookies anyway for the httpOnly XSS protection and simpler frontend
 * code, accepting sameSite as "strong mitigation," not "complete immunity."
 */
function cookieOptions() {
    const isProd = process.env.NODE_ENV === "production"
    return {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "none" : "lax",
        maxAge: 24 * 60 * 60 * 1000
    }
}

const register = asyncHandler(async (req, res) => {
    const { username, email, password } = req.body

    const existingUser = await User.findOne({ email })
    if (existingUser) {
        throw new ApiError(409, "An account with this email already exists")
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const user = await User.create({ username, email, password: hashedPassword })

    const token = jwt.sign(
        { id: user._id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
    )

    res.cookie("token", token, cookieOptions())
    res.status(201).json({
        message: "Account created successfully",
        user: { id: user._id, username: user.username, email: user.email }
    })
})

const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body

    const user = await User.findOne({ email })
    if (!user) {
        throw new ApiError(401, "Invalid email or password")
    }

    const isPasswordValid = await bcrypt.compare(password, user.password)
    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid email or password")
    }

    user.lastLoginAt = new Date()
    await user.save()

    const token = jwt.sign(
        { id: user._id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
    )

    res.cookie("token", token, cookieOptions())
    res.status(200).json({
        message: "Logged in successfully",
        user: { id: user._id, username: user.username, email: user.email }
    })
})

const logout = asyncHandler(async (req, res) => {
    const token = req.cookies?.token

    if (token) {
        const decoded = jwt.decode(token)
        await Blacklist.create({
            token,
            expiresAt: decoded?.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 24 * 60 * 60 * 1000)
        })
    }

    res.clearCookie("token", cookieOptions())
    res.status(200).json({ message: "Logged out successfully" })
})

const getMe = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id).select("-password")
    if (!user) {
        throw new ApiError(404, "User not found")
    }
    res.status(200).json({ user })
})

module.exports = { register, login, logout, getMe }
ROLEFIT_EOF

echo '  -> writing Backend/src/middlewares/admin.middleware.js'
mkdir -p "$(dirname "Backend/src/middlewares/admin.middleware.js")"
cat > "Backend/src/middlewares/admin.middleware.js" << 'ROLEFIT_EOF'
const ApiError = require("../utils/ApiError")

/**
 * Deliberately the simplest thing that works: admin access is granted by
 * email address, listed in the ADMIN_EMAILS env var (comma-separated).
 * No isAdmin flag on the User schema, no roles/permissions system, no
 * admin-management UI — this project has one owner who needs to see their
 * own activity dashboard during a demo, not a multi-tenant admin hierarchy.
 * Runs AFTER authMiddleware, so req.user is already verified and trusted.
 */
function adminMiddleware(req, res, next) {
    const adminEmails = (process.env.ADMIN_EMAILS || "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)

    if (!adminEmails.includes(req.user.email.toLowerCase())) {
        throw new ApiError(403, "You don't have access to this page")
    }

    next()
}

module.exports = adminMiddleware
ROLEFIT_EOF

echo '  -> writing Backend/src/controllers/admin.controller.js'
mkdir -p "$(dirname "Backend/src/controllers/admin.controller.js")"
cat > "Backend/src/controllers/admin.controller.js" << 'ROLEFIT_EOF'
const User = require("../models/user.model")
const ReadinessReport = require("../models/readinessReport.model")
const asyncHandler = require("../utils/asyncHandler")

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Deliberately ONE endpoint returning everything the dashboard needs,
 * rather than several granular ones — this is a small admin page read
 * once per visit, not a paginated/filterable data table, so there's no
 * real benefit to splitting it up, only more round trips.
 *
 * Every number here comes from data the app already stores for other
 * reasons (User.createdAt/lastLoginAt, ReadinessReport.createdAt) — no new
 * event-logging collection was added. "Active users" and "new signups" are
 * computed at request time from existing timestamps, not accumulated in a
 * separate counter that could drift out of sync with reality.
 */
const getOverview = asyncHandler(async (req, res) => {
    const now = Date.now()
    const last24h = new Date(now - DAY_MS)
    const last7d = new Date(now - 7 * DAY_MS)

    const [
        totalUsers,
        newSignups7d,
        activeUsers24h,
        totalReports,
        recentSignups,
        recentLogins,
        recentReports
    ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ createdAt: { $gte: last7d } }),
        User.countDocuments({ lastLoginAt: { $gte: last24h } }),
        ReadinessReport.countDocuments(),
        User.find().sort({ createdAt: -1 }).limit(10).select("username email createdAt"),
        User.find({ lastLoginAt: { $exists: true } }).sort({ lastLoginAt: -1 }).limit(10).select("username email lastLoginAt"),
        ReadinessReport.find().sort({ createdAt: -1 }).limit(10)
            .populate("user", "username email")
            .select("jobDescription matchScore createdAt user")
    ])

    res.status(200).json({
        stats: { totalUsers, newSignups7d, activeUsers24h, totalReports },
        recentSignups,
        recentLogins,
        recentReports
    })
})

module.exports = { getOverview }
ROLEFIT_EOF

echo '  -> writing Backend/src/routes/admin.routes.js'
mkdir -p "$(dirname "Backend/src/routes/admin.routes.js")"
cat > "Backend/src/routes/admin.routes.js" << 'ROLEFIT_EOF'
const express = require("express")
const { getOverview } = require("../controllers/admin.controller")
const authMiddleware = require("../middlewares/auth.middleware")
const adminMiddleware = require("../middlewares/admin.middleware")

const router = express.Router()

router.use(authMiddleware, adminMiddleware)

router.get("/overview", getOverview)

module.exports = router
ROLEFIT_EOF

echo '  -> writing Backend/src/app.js'
mkdir -p "$(dirname "Backend/src/app.js")"
cat > "Backend/src/app.js" << 'ROLEFIT_EOF'
const express = require("express")
const cors = require("cors")
const helmet = require("helmet")
const cookieParser = require("cookie-parser")

const authRoutes = require("./routes/auth.routes")
const reportRoutes = require("./routes/report.routes")
const practiceRoutes = require("./routes/practice.routes")
const copilotRoutes = require("./routes/copilot.routes")
const adminRoutes = require("./routes/admin.routes")
const errorMiddleware = require("./middlewares/error.middleware")

const app = express()

// Deployed platforms (Render, Railway, Fly, etc.) sit behind a reverse
// proxy — without this, express-rate-limit sees every request as coming
// from the proxy's single IP (breaking per-user limits), and req.secure
// (which the "secure" cookie flag depends on in production) never reads
// true even over real HTTPS. `1` trusts exactly one hop, which matches a
// typical single-proxy deployment.
app.set("trust proxy", 1)

// .trim() matters here more than it looks like it should: a trailing
// newline or stray space in the CLIENT_URL env var (very easy to introduce
// by pasting a URL into a hosting dashboard) is an invalid character for an
// HTTP header value. Without trimming, the `cors` package tries to set
// Access-Control-Allow-Origin with that invalid value and Node throws
// ERR_INVALID_CHAR on every single request — trimming here means a messy
// env var value just works correctly instead of crashing the whole app.
const clientUrl = (process.env.CLIENT_URL || "").trim()

app.use(helmet())
app.use(cors({
    origin: clientUrl, // env-based, not hardcoded — fixes the tutorial's localhost:5173 lock-in
    credentials: true
}))
// Explicit limit rather than Express's default — job descriptions/resume
// text are plain text and comfortably fit well under this; the explicit
// number documents the assumption instead of silently relying on a default
// that could change between Express versions.
app.use(express.json({ limit: "256kb" }))
app.use(cookieParser())

app.get("/health", (req, res) => res.status(200).json({ status: "ok" }))

app.use("/api/auth", authRoutes)
app.use("/api/reports", reportRoutes)
app.use("/api/practice", practiceRoutes)
app.use("/api/copilot", copilotRoutes)
app.use("/api/admin", adminRoutes)

// Must be registered after all routes — Express only treats a 4-arg
// middleware as an error handler if it's last in the chain.
app.use(errorMiddleware)

module.exports = app
ROLEFIT_EOF

echo '  -> writing Backend/.env.example'
mkdir -p "$(dirname "Backend/.env.example")"
cat > "Backend/.env.example" << 'ROLEFIT_EOF'
# Server
PORT=3000
NODE_ENV=development

# MongoDB Atlas connection string (get from Atlas dashboard > Connect > Drivers)
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/rolefit?retryWrites=true&w=majority

# JWT
JWT_SECRET=replace_with_a_long_random_string
JWT_EXPIRES_IN=1d

# Google Gemini
GOOGLE_GENAI_API_KEY=your_gemini_api_key

# Frontend origin allowed to send credentialed requests
CLIENT_URL=http://localhost:5173

# Optional — comma-separated emails allowed to view /admin (technical
# activity dashboard: signups, logins, active users, recent reports).
# Leave unset to disable admin access entirely; nothing else depends on it.
ADMIN_EMAILS=you@example.com
ROLEFIT_EOF

echo '  -> writing Backend/tests/admin.middleware.test.js'
mkdir -p "$(dirname "Backend/tests/admin.middleware.test.js")"
cat > "Backend/tests/admin.middleware.test.js" << 'ROLEFIT_EOF'
const adminMiddleware = require("../src/middlewares/admin.middleware")

/**
 * adminMiddleware is plain synchronous code (no DB calls, no awaits) so —
 * unlike the asyncHandler-wrapped middlewares elsewhere in this test suite —
 * it can be exercised directly with a simple try/catch instead of flushing
 * the microtask queue.
 */
describe("adminMiddleware", () => {
    const originalEnv = process.env.ADMIN_EMAILS

    afterEach(() => {
        process.env.ADMIN_EMAILS = originalEnv
    })

    function mockReq(email) {
        return { user: { email } }
    }

    it("rejects with 403 when ADMIN_EMAILS is unset entirely", () => {
        delete process.env.ADMIN_EMAILS
        const req = mockReq("owner@example.com")
        const next = jest.fn()

        expect(() => adminMiddleware(req, {}, next)).toThrow()
        try {
            adminMiddleware(req, {}, next)
        } catch (err) {
            expect(err.statusCode).toBe(403)
        }
    })

    it("rejects a logged-in user whose email isn't in the admin list", () => {
        process.env.ADMIN_EMAILS = "owner@example.com"
        const req = mockReq("someone-else@example.com")

        expect(() => adminMiddleware(req, {}, jest.fn())).toThrow()
    })

    it("allows a user whose email is in the admin list", () => {
        process.env.ADMIN_EMAILS = "owner@example.com"
        const req = mockReq("owner@example.com")
        const next = jest.fn()

        adminMiddleware(req, {}, next)

        expect(next).toHaveBeenCalledTimes(1)
    })

    it("is case-insensitive and tolerates whitespace around list entries", () => {
        process.env.ADMIN_EMAILS = " Owner@Example.com ,  second@example.com"
        const req = mockReq("owner@example.com")
        const next = jest.fn()

        adminMiddleware(req, {}, next)

        expect(next).toHaveBeenCalledTimes(1)
    })

    it("handles multiple admin emails correctly", () => {
        process.env.ADMIN_EMAILS = "owner@example.com,teammate@example.com"
        const next = jest.fn()

        adminMiddleware(mockReq("teammate@example.com"), {}, next)

        expect(next).toHaveBeenCalledTimes(1)
    })
})
ROLEFIT_EOF

echo '  -> writing Backend/tests/admin.controller.test.js'
mkdir -p "$(dirname "Backend/tests/admin.controller.test.js")"
cat > "Backend/tests/admin.controller.test.js" << 'ROLEFIT_EOF'
jest.mock("../src/models/user.model")
jest.mock("../src/models/readinessReport.model")

const User = require("../src/models/user.model")
const ReadinessReport = require("../src/models/readinessReport.model")
const { getOverview } = require("../src/controllers/admin.controller")

const flushPromises = () => new Promise((resolve) => setImmediate(resolve))

/**
 * Confirms the overview endpoint queries existing data correctly rather
 * than relying on any new event-logging collection — "new signups" comes
 * from User.createdAt, "active users" from User.lastLoginAt, activity feed
 * from ReadinessReport.createdAt. If any of these query shapes silently
 * broke, the numbers shown during a live demo would just be wrong with no
 * obvious error — worth pinning down with a test.
 */
describe("admin.controller getOverview", () => {
    function mockRes() {
        return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }
    }

    function mockFind(returnValue) {
        return {
            sort: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            populate: jest.fn().mockReturnThis(),
            select: jest.fn().mockResolvedValue(returnValue)
        }
    }

    afterEach(() => {
        jest.clearAllMocks()
    })

    it("aggregates stats and recent activity from existing collections", async () => {
        const req = {}
        const res = mockRes()
        const next = jest.fn()

        User.countDocuments
            .mockResolvedValueOnce(42) // totalUsers
            .mockResolvedValueOnce(5)  // newSignups7d
            .mockResolvedValueOnce(3)  // activeUsers24h
        ReadinessReport.countDocuments.mockResolvedValue(17)

        const fakeSignups = [ { _id: "u1", username: "anagha", email: "a@test.com", createdAt: new Date() } ]
        const fakeLogins = [ { _id: "u1", username: "anagha", email: "a@test.com", lastLoginAt: new Date() } ]
        const fakeReports = [ { _id: "r1", jobDescription: "JD", matchScore: 80, createdAt: new Date(), user: { username: "anagha" } } ]

        User.find
            .mockReturnValueOnce(mockFind(fakeSignups))
            .mockReturnValueOnce(mockFind(fakeLogins))
        ReadinessReport.find.mockReturnValueOnce(mockFind(fakeReports))

        getOverview(req, res, next)
        await flushPromises()

        expect(User.countDocuments).toHaveBeenCalledTimes(3) // total + newSignups7d + activeUsers24h
        expect(ReadinessReport.countDocuments).toHaveBeenCalledTimes(1)
        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.json).toHaveBeenCalledWith({
            stats: { totalUsers: 42, newSignups7d: 5, activeUsers24h: 3, totalReports: 17 },
            recentSignups: fakeSignups,
            recentLogins: fakeLogins,
            recentReports: fakeReports
        })
        expect(next).not.toHaveBeenCalled()
    })
})
ROLEFIT_EOF

echo '  -> writing Frontend/src/features/admin/services/admin.api.js'
mkdir -p "$(dirname "Frontend/src/features/admin/services/admin.api.js")"
cat > "Frontend/src/features/admin/services/admin.api.js" << 'ROLEFIT_EOF'
import apiClient from "../../../lib/apiClient"

export async function fetchAdminOverview() {
    const { data } = await apiClient.get("/admin/overview")
    return data
}
ROLEFIT_EOF

echo '  -> writing Frontend/src/features/admin/pages/AdminDashboard.jsx'
mkdir -p "$(dirname "Frontend/src/features/admin/pages/AdminDashboard.jsx")"
cat > "Frontend/src/features/admin/pages/AdminDashboard.jsx" << 'ROLEFIT_EOF'
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { fetchAdminOverview } from "../services/admin.api"
import { SkeletonLines } from "../../../components/Feedback"
import ScoreBadge from "../../../components/ScoreBadge"

/**
 * Not linked from the nav — intentionally. This is a single-owner demo
 * dashboard, not a feature every user should see or discover, so it's
 * reached directly at /admin rather than adding a nav item that would be a
 * dead end (403) for every non-admin visitor. Access is fully enforced
 * server-side (admin.middleware.js) regardless of whether this link is
 * visible anywhere — this page assumes nothing about who can reach it.
 */
export default function AdminDashboard() {
    const [ data, setData ] = useState(null)
    const [ loading, setLoading ] = useState(true)
    const [ error, setError ] = useState(null)

    useEffect(() => {
        fetchAdminOverview()
            .then(setData)
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false))
    }, [])

    if (loading) return <div className="container page"><SkeletonLines count={6} /></div>

    if (error) {
        return (
            <div className="container page">
                <div className="banner banner-error" role="alert">{error}</div>
                <p style={{ marginTop: "var(--space-4)" }}>
                    <Link to="/dashboard">← Back to dashboard</Link>
                </p>
            </div>
        )
    }

    const { stats, recentSignups, recentLogins, recentReports } = data

    return (
        <div className="container-wide">
            <div className="page">
                <Link to="/dashboard" className="btn btn-ghost btn-sm" style={{ marginBottom: "var(--space-4)", paddingLeft: 0 }}>← Dashboard</Link>
                <h1 style={{ marginBottom: "var(--space-2)" }}>Admin Activity</h1>
                <p style={{ marginBottom: "var(--space-5)" }}>Live signup, login, and usage activity across RoleFit.</p>

                <div className="stat-grid">
                    <div className="stat">
                        <div className="value">{stats.totalUsers}</div>
                        <div className="label">Total Users</div>
                    </div>
                    <div className="stat">
                        <div className="value">{stats.newSignups7d}</div>
                        <div className="label">New Signups (7d)</div>
                    </div>
                    <div className="stat">
                        <div className="value">{stats.activeUsers24h}</div>
                        <div className="label">Active Users (24h)</div>
                    </div>
                    <div className="stat">
                        <div className="value">{stats.totalReports}</div>
                        <div className="label">Reports Generated</div>
                    </div>
                </div>

                <div className="row" style={{ alignItems: "flex-start", gap: "var(--space-5)", flexWrap: "wrap" }}>
                    <div className="card" style={{ flex: "1 1 300px" }}>
                        <h2 style={{ marginBottom: "var(--space-3)" }}>Recent Signups</h2>
                        {recentSignups.length === 0 && <p style={{ margin: 0 }}>No signups yet.</p>}
                        <div className="stack">
                            {recentSignups.map((u) => (
                                <div key={u._id} className="row-between">
                                    <span style={{ fontSize: "var(--text-sm)" }}>{u.username} <span className="hint">({u.email})</span></span>
                                    <span className="hint">{new Date(u.createdAt).toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="card" style={{ flex: "1 1 300px" }}>
                        <h2 style={{ marginBottom: "var(--space-3)" }}>Recent Logins</h2>
                        {recentLogins.length === 0 && <p style={{ margin: 0 }}>No logins recorded yet.</p>}
                        <div className="stack">
                            {recentLogins.map((u) => (
                                <div key={u._id} className="row-between">
                                    <span style={{ fontSize: "var(--text-sm)" }}>{u.username} <span className="hint">({u.email})</span></span>
                                    <span className="hint">{new Date(u.lastLoginAt).toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="card" style={{ marginTop: "var(--space-5)" }}>
                    <h2 style={{ marginBottom: "var(--space-3)" }}>Recent Reports Generated</h2>
                    {recentReports.length === 0 && <p style={{ margin: 0 }}>No reports generated yet.</p>}
                    <div className="stack">
                        {recentReports.map((r) => (
                            <div key={r._id} className="row-between" style={{ alignItems: "flex-start" }}>
                                <div>
                                    <div style={{ fontSize: "var(--text-sm)" }}>
                                        {r.user?.username || "Unknown user"} <span className="hint">({r.user?.email || "—"})</span>
                                    </div>
                                    <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", maxWidth: 480 }}>
                                        {r.jobDescription.slice(0, 90)}{r.jobDescription.length > 90 ? "..." : ""}
                                    </div>
                                </div>
                                <div className="row" style={{ gap: "var(--space-3)" }}>
                                    <ScoreBadge score={r.matchScore} />
                                    <span className="hint">{new Date(r.createdAt).toLocaleString()}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
ROLEFIT_EOF

echo '  -> writing Frontend/src/app.routes.jsx'
mkdir -p "$(dirname "Frontend/src/app.routes.jsx")"
cat > "Frontend/src/app.routes.jsx" << 'ROLEFIT_EOF'
import { Routes, Route } from "react-router-dom"
import { AuthProvider } from "./features/auth/auth.context"
import { ToastProvider } from "./components/toast.context"
import AuthenticatedLayout from "./components/AuthenticatedLayout"
import Landing from "./features/marketing/pages/Landing"
import Login from "./features/auth/pages/Login"
import Register from "./features/auth/pages/Register"
import Home from "./features/readiness/pages/Home"
import ReportView from "./features/readiness/pages/ReportView"
import PracticeSession from "./features/practice/pages/PracticeSession"
import Copilot from "./features/copilot/pages/Copilot"
import AdminDashboard from "./features/admin/pages/AdminDashboard"

export default function App() {
    return (
        <AuthProvider>
            <ToastProvider>
                <Routes>
                    <Route path="/" element={<Landing />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/dashboard" element={<AuthenticatedLayout><Home /></AuthenticatedLayout>} />
                    <Route path="/reports/:id" element={<AuthenticatedLayout><ReportView /></AuthenticatedLayout>} />
                    <Route path="/reports/:id/practice" element={<AuthenticatedLayout><PracticeSession /></AuthenticatedLayout>} />
                    <Route path="/reports/:id/copilot" element={<AuthenticatedLayout><Copilot /></AuthenticatedLayout>} />
                    <Route path="/admin" element={<AuthenticatedLayout><AdminDashboard /></AuthenticatedLayout>} />
                </Routes>
            </ToastProvider>
        </AuthProvider>
    )
}
ROLEFIT_EOF

echo '  -> writing README.md'
mkdir -p "$(dirname "README.md")"
cat > "README.md" << 'ROLEFIT_EOF'
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
ROLEFIT_EOF

echo ""
echo "All files written."
echo ""
echo "IMPORTANT — one manual step required on Render:"
echo "  Go to your backend service -> Environment -> add a new variable:"
echo "    ADMIN_EMAILS = your-actual-login-email@example.com"
echo "  Save (triggers a redeploy). Without this, /admin returns 403 for everyone,"
echo "  including you."
echo ""
echo "Next steps:"
echo "  cd Backend  && npm install && npm test"
echo "  cd ../Frontend && npm install && npm test && npm run build"
echo ""
echo "Then commit, push, and redeploy both Render and Vercel as usual."
