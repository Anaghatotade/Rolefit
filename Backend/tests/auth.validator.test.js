const { registerSchema, loginSchema } = require("../src/validators/auth.validator")

/**
 * Focused Zod validation coverage. registerSchema's password minimum is the
 * one rule the whole registration flow depends on to keep weak passwords out
 * before a user is ever created — this is the "important Zod validation
 * case" from the audit.
 */
describe("auth.validator", () => {
    describe("registerSchema", () => {
        it("rejects a password shorter than 8 characters", () => {
            const result = registerSchema.safeParse({
                username: "alice",
                email: "alice@example.com",
                password: "short1"
            })

            expect(result.success).toBe(false)
            expect(result.error.issues[0].message).toMatch(/at least 8 characters/i)
        })

        it("rejects an invalid email address", () => {
            const result = registerSchema.safeParse({
                username: "alice",
                email: "not-an-email",
                password: "longenoughpassword"
            })

            expect(result.success).toBe(false)
            expect(result.error.issues[0].message).toMatch(/valid email/i)
        })

        it("rejects a username shorter than 3 characters", () => {
            const result = registerSchema.safeParse({
                username: "ab",
                email: "alice@example.com",
                password: "longenoughpassword"
            })

            expect(result.success).toBe(false)
        })

        it("accepts valid input and normalizes the email", () => {
            const result = registerSchema.safeParse({
                username: "alice",
                email: "  ALICE@Example.com  ",
                password: "longenoughpassword"
            })

            expect(result.success).toBe(true)
            expect(result.data.email).toBe("alice@example.com")
        })
    })

    describe("loginSchema", () => {
        it("rejects an empty password", () => {
            const result = loginSchema.safeParse({
                email: "alice@example.com",
                password: ""
            })

            expect(result.success).toBe(false)
        })

        it("accepts valid credentials", () => {
            const result = loginSchema.safeParse({
                email: "alice@example.com",
                password: "anything"
            })

            expect(result.success).toBe(true)
        })
    })
})
