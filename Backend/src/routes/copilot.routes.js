const express = require("express")
const { sendMessage } = require("../controllers/copilot.controller")
const authMiddleware = require("../middlewares/auth.middleware")
const validate = require("../middlewares/validate.middleware")
const { copilotMessageSchema } = require("../validators/report.validator")
const { chatLimiter } = require("../middlewares/rateLimit.middleware")

const router = express.Router()

router.use(authMiddleware)

router.post("/:id/message", chatLimiter, validate(copilotMessageSchema), sendMessage)

module.exports = router
