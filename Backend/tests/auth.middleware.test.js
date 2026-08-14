jest.mock("../src/models/blacklist.model")
jest.mock("jsonwebtoken")

const jwt = require("jsonwebtoken")
const Blacklist = require("../src/models/blacklist.model")
const authMiddleware = require("../src/middlewares/auth.middleware")

/**
 * Covers the actual security-relevant branches of authMiddleware:
 * missing token, a token that is cryptographically valid but blacklisted
 * (logged out), an invalid/expired token, and the success path. The
 * blacklist check running BEFORE jwt.verify's result is trusted is the
 * whole point of this middleware, per its own doc comment.
 */
// authMiddleware is wrapped in asyncHandler, whose wrapper function does not
// return the inner promise (it fires Promise.resolve(fn(...)).catch(next)
// and returns undefined). Awaiting the call directly therefore resolves
// before the inner async work — and any next(err) it triggers — has run, so
// tests flush the microtask queue once after invoking it.
const flushPromises = () => new Promise((resolve) => setImmediate(resolve))

describe("authMiddleware", () => {
    function mockRes() {
        return { status: jest.fn().mockReturnThis(), json: jest.fn(), clearCookie: jest.fn() }
    }

    afterEach(() => {
        jest.clearAllMocks()
    })

    it("rejects a request with no token", async () => {
        const req = { cookies: {} }
        const res = mockRes()
        const next = jest.fn()

        authMiddleware(req, res, next)
        await flushPromises()

        expect(next).toHaveBeenCalledTimes(1)
        expect(next.mock.calls[0][0].statusCode).toBe(401)
        expect(Blacklist.findOne).not.toHaveBeenCalled()
    })

    it("rejects a cryptographically valid token that has been blacklisted (logged out)", async () => {
        const req = { cookies: { token: "valid-but-logged-out" } }
        const res = mockRes()
        const next = jest.fn()

        Blacklist.findOne.mockResolvedValue({ token: "valid-but-logged-out" })

        authMiddleware(req, res, next)
        await flushPromises()

        expect(Blacklist.findOne).toHaveBeenCalledWith({ token: "valid-but-logged-out" })
        // jwt.verify must never even be consulted once the blacklist hits.
        expect(jwt.verify).not.toHaveBeenCalled()
        expect(next.mock.calls[0][0].statusCode).toBe(401)
        expect(req.user).toBeUndefined()
    })

    it("rejects an invalid or expired token", async () => {
        const req = { cookies: { token: "garbage" } }
        const res = mockRes()
        const next = jest.fn()

        Blacklist.findOne.mockResolvedValue(null)
        jwt.verify.mockImplementation(() => {
            throw new Error("jwt expired")
        })

        authMiddleware(req, res, next)
        await flushPromises()

        expect(next.mock.calls[0][0].statusCode).toBe(401)
    })

    it("attaches req.user and calls next() for a valid, non-blacklisted token", async () => {
        const req = { cookies: { token: "good-token" } }
        const res = mockRes()
        const next = jest.fn()

        Blacklist.findOne.mockResolvedValue(null)
        jwt.verify.mockReturnValue({ id: "user-123", email: "alice@example.com" })

        authMiddleware(req, res, next)
        await flushPromises()

        expect(req.user).toEqual({ id: "user-123", email: "alice@example.com" })
        expect(next).toHaveBeenCalledWith()
    })
})
