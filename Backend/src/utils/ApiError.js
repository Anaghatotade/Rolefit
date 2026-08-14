/**
 * A thrown ApiError carries an HTTP status code with it, so the centralized
 * error middleware always knows how to respond instead of defaulting every
 * unexpected error to a 500.
 */
class ApiError extends Error {
    constructor(statusCode, message) {
        super(message)
        this.statusCode = statusCode
    }
}

module.exports = ApiError
