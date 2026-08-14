const rateLimit = require("express-rate-limit")

/**
 * Two separate limiters, deliberately different thresholds:
 *
 * - authLimiter: prevents brute-forcing login/register.
 * - aiLimiter: MUCH stricter. Every request behind this hits the Gemini API,
 *   which is metered and costs money. Without this, one user (or a script)
 *   could rack up an unbounded bill. This is the kind of thing tutorials
 *   never mention because it doesn't matter in a demo — it matters the
 *   moment your API key is real and public.
 */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { message: "Too many attempts. Please try again in a few minutes." },
    standardHeaders: true,
    legacyHeaders: false
})

const aiLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 15,
    message: { message: "AI request limit reached for this hour. Please try again later." },
    standardHeaders: true,
    legacyHeaders: false
})

const chatLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 40,
    message: { message: "Copilot message limit reached for this hour. Please try again later." },
    standardHeaders: true,
    legacyHeaders: false
})

module.exports = { authLimiter, aiLimiter, chatLimiter }
