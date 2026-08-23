const mongoose = require("mongoose")

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Retries the initial connection a few times with backoff before giving up.
 * This does NOT fix real misconfigurations (wrong URI, wrong password, an
 * IP that's actually blocked in Atlas's Network Access list) — those fail
 * the same way on every attempt and still exit after retries are exhausted.
 * It exists for genuinely transient conditions: a brief network blip, Atlas
 * still spinning up, or a whitelist change that hasn't fully propagated yet
 * — cases where the very next attempt, seconds later, would have worked.
 */
async function connectToDB({ retries = 3, baseDelayMs = 2000 } = {}) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            await mongoose.connect(process.env.MONGODB_URI)
            console.log("Connected to MongoDB Atlas")
            return
        } catch (err) {
            const isLastAttempt = attempt === retries
            console.error(`MongoDB connection attempt ${attempt + 1}/${retries + 1} failed:`, err.message)

            if (isLastAttempt) {
                console.error("Giving up after repeated failures. Common causes: wrong MONGODB_URI, wrong password, or the connecting IP isn't in Atlas's Network Access whitelist.")
                process.exit(1)
            }

            await sleep(baseDelayMs * Math.pow(2, attempt)) // 2s, 4s, 8s
        }
    }
}

module.exports = connectToDB
