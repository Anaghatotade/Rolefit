const express = require("express")
const { createReport, getAllReports, getReportById, generateResumePdf } = require("../controllers/report.controller")
const authMiddleware = require("../middlewares/auth.middleware")
const validate = require("../middlewares/validate.middleware")
const { createReportSchema } = require("../validators/report.validator")
const upload = require("../middlewares/upload.middleware")
const { aiLimiter } = require("../middlewares/rateLimit.middleware")

const router = express.Router()

router.use(authMiddleware)

router.post("/", aiLimiter, upload.single("resume"), validate(createReportSchema), createReport)
router.get("/", getAllReports)
router.get("/:id", getReportById)
router.post("/:id/resume-pdf", aiLimiter, generateResumePdf)

module.exports = router
