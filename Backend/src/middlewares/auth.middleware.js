const jwt = require("jsonwebtoken")
const Blacklist = require("../models/blacklist.model")
const ApiError = require("../utils/ApiError")
const asyncHandler = require("../utils/asyncHandler")

/**
 * Runs on every protected route.
 *
 * Order matters: check the blacklist BEFORE trusting jwt.verify's success,
 * because a token can be cryptographically valid (not expired, correct
 * signature) and still be one the user explicitly logged out of. This is
 * the whole reason the blacklist collection exists — see README for the
 * stateless-JWT trade-off this introduces (a DB read on every request).
 */
const authMiddleware = asyncHandler(async (req, res, next) => {
    const token = req.cookies?.token

    if (!token) {
        throw new ApiError(401, "You must be logged in to access this resource")
    }

    const isBlacklisted = await Blacklist.findOne({ token })
    if (isBlacklisted) {
        throw new ApiError(401, "Session has been logged out. Please log in again")
    }

    let decoded
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET)
    } catch (err) {
        throw new ApiError(401, "Invalid or expired session. Please log in again")
    }

    req.user = { id: decoded.id, email: decoded.email }
    next()
})

module.exports = authMiddleware
