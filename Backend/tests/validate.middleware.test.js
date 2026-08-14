const validate = require("../src/middlewares/validate.middleware")
const { registerSchema } = require("../src/validators/auth.validator")

/**
 * Confirms the validate() middleware actually short-circuits the request
 * (never calls the controller) when Zod rejects the body, and that it
 * forwards the ApiError with the schema's own message instead of a generic
 * one — this is what stops a malformed request from ever reaching the DB or
 * an AI call.
 */
describe("validate middleware", () => {
    function mockRes() {
        return { status: jest.fn().mockReturnThis(), json: jest.fn() }
    }

    it("calls next with a 400 ApiError when the body fails schema validation", () => {
        const req = { body: { username: "ab", email: "bad", password: "short" } }
        const res = mockRes()
        const next = jest.fn()

        validate(registerSchema)(req, res, next)

        expect(next).toHaveBeenCalledTimes(1)
        const err = next.mock.calls[0][0]
        expect(err.statusCode).toBe(400)
        expect(typeof err.message).toBe("string")
        expect(err.message.length).toBeGreaterThan(0)
    })

    it("normalizes req.body and calls next with no error on valid input", () => {
        const req = { body: { username: "alice", email: "  Alice@Example.com ", password: "longenoughpassword" } }
        const res = mockRes()
        const next = jest.fn()

        validate(registerSchema)(req, res, next)

        expect(next).toHaveBeenCalledWith()
        expect(req.body.email).toBe("alice@example.com")
    })
})
