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
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
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
