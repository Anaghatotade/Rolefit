const ReadinessReport = require("../models/readinessReport.model")
const ApiError = require("../utils/ApiError")
const asyncHandler = require("../utils/asyncHandler")
const { askCopilot } = require("../services/ai.service")

/**
 * Same ownership-scoping pattern used everywhere else that reads a report by
 * ID (see the IDOR fix in report.controller.js) — a chat scoped to someone
 * else's report would leak the same private resume/JD data.
 */
const sendMessage = asyncHandler(async (req, res) => {
    const { message, history } = req.body

    const report = await ReadinessReport.findOne({ _id: req.params.id, user: req.user.id })
    if (!report) {
        throw new ApiError(404, "Report not found")
    }

    const reply = await askCopilot({
        reportContext: {
            jobDescription: report.jobDescription,
            resumeText: report.resumeText,
            matchScore: report.matchScore,
            skillGaps: report.skillGaps
        },
        history,
        message
    })

    res.status(200).json({ reply })
})

module.exports = { sendMessage }
