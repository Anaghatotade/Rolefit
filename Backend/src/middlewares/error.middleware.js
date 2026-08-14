const ApiError = require("../utils/ApiError")

/**
 * Single place where every error in the app ends up. Must be registered
 * LAST in app.js, after all routes.
 *
 * - Known errors (ApiError) → their own status code + message.
 * - Mongoose validation errors → 400 with a readable message.
 * - Mongoose duplicate key errors (E11000) → 409.
 * - A Gemini call that exhausted its retries → 503 with a "try again" message.
 * - Anything else (a bug, a Puppeteer failure) → 500, and the raw error is
 *   only logged server-side, never sent to the client, so internal details
 *   never leak.
 */
function errorMiddleware(err, req, res, next) {
    console.error(err)

    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({ message: err.message })
    }

    if (err.name === "ValidationError") {
        return res.status(400).json({ message: err.message })
    }

    if (err.code === 11000) {
        return res.status(409).json({ message: "A record with these details already exists." })
    }

    // A Gemini call that exhausted its retries (see generateWithRetry in
    // ai.service.js) — status 429/503 on the underlying error. Worth telling
    // the user this is a "try again shortly" situation, not a broken app.
    if (err.status === 429 || err.status === 503) {
        return res.status(503).json({ message: "The AI service is temporarily overloaded. Please try again in a moment." })
    }

    return res.status(500).json({ message: "Something went wrong. Please try again." })
}

module.exports = errorMiddleware

