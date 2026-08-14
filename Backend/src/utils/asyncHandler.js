/**
 * The tutorial's controllers are plain async functions with no try/catch.
 * In Express 5 that mostly still works for thrown sync errors, but an
 * unhandled *rejected promise* inside an async controller (a failed Mongo
 * query, a failed Gemini call, a corrupt PDF) has no guaranteed path to the
 * error middleware. Wrapping every controller closes that gap in one place
 * instead of repeating try/catch in every function.
 */
function asyncHandler(fn) {
    return function (req, res, next) {
        Promise.resolve(fn(req, res, next)).catch(next)
    }
}

module.exports = asyncHandler
