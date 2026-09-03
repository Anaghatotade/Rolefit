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
