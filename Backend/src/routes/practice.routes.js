const express = require("express")
const { submitAnswer, getProgress } = require("../controllers/practice.controller")
const authMiddleware = require("../middlewares/auth.middleware")
const validate = require("../middlewares/validate.middleware")
const { submitAnswerSchema } = require("../validators/report.validator")
const { aiLimiter } = require("../middlewares/rateLimit.middleware")

const router = express.Router()

router.use(authMiddleware)

router.get("/:id", getProgress)
router.post("/:id/answer", aiLimiter, validate(submitAnswerSchema), submitAnswer)

module.exports = router
