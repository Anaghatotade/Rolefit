const adminMiddleware = require("../src/middlewares/admin.middleware")

/**
 * adminMiddleware is plain synchronous code (no DB calls, no awaits) so —
 * unlike the asyncHandler-wrapped middlewares elsewhere in this test suite —
 * it can be exercised directly with a simple try/catch instead of flushing
 * the microtask queue.
 */
describe("adminMiddleware", () => {
    const originalEnv = process.env.ADMIN_EMAILS

    afterEach(() => {
        process.env.ADMIN_EMAILS = originalEnv
    })

    function mockReq(email) {
        return { user: { email } }
    }

    it("rejects with 403 when ADMIN_EMAILS is unset entirely", () => {
        delete process.env.ADMIN_EMAILS
        const req = mockReq("owner@example.com")
        const next = jest.fn()

        expect(() => adminMiddleware(req, {}, next)).toThrow()
        try {
            adminMiddleware(req, {}, next)
        } catch (err) {
            expect(err.statusCode).toBe(403)
        }
    })

    it("rejects a logged-in user whose email isn't in the admin list", () => {
        process.env.ADMIN_EMAILS = "owner@example.com"
        const req = mockReq("someone-else@example.com")

        expect(() => adminMiddleware(req, {}, jest.fn())).toThrow()
    })

    it("allows a user whose email is in the admin list", () => {
        process.env.ADMIN_EMAILS = "owner@example.com"
        const req = mockReq("owner@example.com")
        const next = jest.fn()

        adminMiddleware(req, {}, next)

        expect(next).toHaveBeenCalledTimes(1)
    })

    it("is case-insensitive and tolerates whitespace around list entries", () => {
        process.env.ADMIN_EMAILS = " Owner@Example.com ,  second@example.com"
        const req = mockReq("owner@example.com")
        const next = jest.fn()

        adminMiddleware(req, {}, next)

        expect(next).toHaveBeenCalledTimes(1)
    })

    it("handles multiple admin emails correctly", () => {
        process.env.ADMIN_EMAILS = "owner@example.com,teammate@example.com"
        const next = jest.fn()

        adminMiddleware(mockReq("teammate@example.com"), {}, next)

        expect(next).toHaveBeenCalledTimes(1)
    })
})
