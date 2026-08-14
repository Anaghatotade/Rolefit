const express = require("express")
const { register, login, logout, getMe } = require("../controllers/auth.controller")
const authMiddleware = require("../middlewares/auth.middleware")
const validate = require("../middlewares/validate.middleware")
const { registerSchema, loginSchema } = require("../validators/auth.validator")
const { authLimiter } = require("../middlewares/rateLimit.middleware")

const router = express.Router()

router.post("/register", authLimiter, validate(registerSchema), register)
router.post("/login", authLimiter, validate(loginSchema), login)
router.post("/logout", authMiddleware, logout)
router.get("/me", authMiddleware, getMe)

module.exports = router
