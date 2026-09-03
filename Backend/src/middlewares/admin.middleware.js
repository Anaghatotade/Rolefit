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
