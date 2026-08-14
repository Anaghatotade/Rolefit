const mongoose = require("mongoose")

/**
 * Improvement over the tutorial: the original blacklist just stores the raw
 * token forever, so the collection only ever grows. Since a blacklisted
 * token becomes useless the moment it would have expired anyway (JWT expiry
 * is enforced independently in the verify step), we store the token's own
 * expiry and let MongoDB's TTL index delete the document automatically once
 * that time passes. `expireAfterSeconds: 0` means "expire exactly at the
 * timestamp stored in this field."
 */
const blacklistSchema = new mongoose.Schema({
    token: {
        type: String,
        required: true,
        unique: true
    },
    expiresAt: {
        type: Date,
        required: true
    }
})

blacklistSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

module.exports = mongoose.model("Blacklist", blacklistSchema)
