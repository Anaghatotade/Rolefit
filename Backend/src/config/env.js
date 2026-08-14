/**
 * Fail-fast environment validation.
 *
 * Why this exists: the original tutorial reads process.env.* directly wherever
 * it's needed, so a missing JWT_SECRET or DB URI only surfaces as a confusing
 * runtime error deep inside a request handler (or worse, jwt.sign silently
 * signs with "undefined"). Validating once at boot means the app either starts
 * correctly or fails immediately with a clear message.
 */

const required = [
    "MONGODB_URI",
    "JWT_SECRET",
    "GOOGLE_GENAI_API_KEY",
    "CLIENT_URL"
]

function validateEnv() {
    const missing = required.filter((key) => !process.env[key])

    if (missing.length > 0) {
        console.error(`Missing required environment variables: ${missing.join(", ")}`)
        console.error("Copy .env.example to .env and fill in the values.")
        process.exit(1)
    }
}

module.exports = { validateEnv }
