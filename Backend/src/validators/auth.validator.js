const { z } = require("zod")

const registerSchema = z.object({
    username: z.string().trim().min(3, "Username must be at least 3 characters").max(30),
    email: z.string().trim().toLowerCase().email("Enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters")
})

const loginSchema = z.object({
    email: z.string().trim().toLowerCase().email("Enter a valid email address"),
    password: z.string().min(1, "Password is required")
})

module.exports = { registerSchema, loginSchema }
