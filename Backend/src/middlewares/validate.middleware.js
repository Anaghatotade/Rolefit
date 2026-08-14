const ApiError = require("../utils/ApiError")

/**
 * Takes a Zod schema and returns Express middleware that validates req.body
 * against it BEFORE the controller (and before any DB/AI call) runs.
 *
 * This is the fix for the tutorial's biggest gap: none of its endpoints
 * validate input, so a missing/malformed field only fails deep inside a
 * controller (or worse, silently reaches the Gemini API and wastes a call).
 */
function validate(schema) {
    return function (req, res, next) {
        const result = schema.safeParse(req.body)

        if (!result.success) {
            const firstIssue = result.error.issues[0]
            return next(new ApiError(400, firstIssue.message))
        }

        req.body = result.data
        next()
    }
}

module.exports = validate
