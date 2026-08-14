const express = require("express")
const cors = require("cors")
const helmet = require("helmet")
const cookieParser = require("cookie-parser")

const authRoutes = require("./routes/auth.routes")
const reportRoutes = require("./routes/report.routes")
const practiceRoutes = require("./routes/practice.routes")
const copilotRoutes = require("./routes/copilot.routes")
const errorMiddleware = require("./middlewares/error.middleware")

const app = express()

app.use(helmet())
app.use(cors({
    origin: process.env.CLIENT_URL, // env-based, not hardcoded — fixes the tutorial's localhost:5173 lock-in
    credentials: true
}))
app.use(express.json())
app.use(cookieParser())

app.get("/health", (req, res) => res.status(200).json({ status: "ok" }))

app.use("/api/auth", authRoutes)
app.use("/api/reports", reportRoutes)
app.use("/api/practice", practiceRoutes)
app.use("/api/copilot", copilotRoutes)

// Must be registered after all routes — Express only treats a 4-arg
// middleware as an error handler if it's last in the chain.
app.use(errorMiddleware)

module.exports = app
