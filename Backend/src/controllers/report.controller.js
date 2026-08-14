// const pdfParse = require("pdf-parse")
// const puppeteer = require("puppeteer")
// const ReadinessReport = require("../models/readinessReport.model")
// const ApiError = require("../utils/ApiError")
// const asyncHandler = require("../utils/asyncHandler")
// const { generateReadinessReport, generateTailoredResumeHtml } = require("../services/ai.service")

// const createReport = asyncHandler(async (req, res) => {
//     if (!req.file) {
//         throw new ApiError(400, "Resume PDF is required")
//     }

//     const { jobDescription, selfDescription } = req.body

//     const parsed = await pdfParse(req.file.buffer)
//     const resumeText = parsed.text.trim()

//     if (resumeText.length < 50) {
//         throw new ApiError(400, "Couldn't extract enough text from this PDF. Please upload a text-based resume, not a scanned image.")
//     }

//     const aiResult = await generateReadinessReport({ jobDescription, selfDescription, resumeText })

//     const report = await ReadinessReport.create({
//         user: req.user.id,
//         jobDescription,
//         selfDescription,
//         resumeText,
//         ...aiResult
//     })

//     res.status(201).json({ message: "Readiness report generated", report })
// })
const { PDFParse } = require("pdf-parse")
const puppeteer = require("puppeteer")
const ReadinessReport = require("../models/readinessReport.model")
const ApiError = require("../utils/ApiError")
const asyncHandler = require("../utils/asyncHandler")
const {
    generateReadinessReport,
    generateTailoredResumeHtml
} = require("../services/ai.service")

const createReport = asyncHandler(async (req, res) => {
    if (!req.file) {
        throw new ApiError(400, "Resume PDF is required")
    }

    const { jobDescription, selfDescription } = req.body

    const parser = new PDFParse({
        data: req.file.buffer
    })

    try {
        const parsed = await parser.getText()
        const resumeText = parsed.text.trim()

        if (resumeText.length < 50) {
            throw new ApiError(
                400,
                "Couldn't extract enough text from this PDF. Please upload a text-based resume, not a scanned image."
            )
        }

        const aiResult = await generateReadinessReport({
            jobDescription,
            selfDescription,
            resumeText
        })

        const report = await ReadinessReport.create({
            user: req.user.id,
            jobDescription,
            selfDescription,
            resumeText,
            ...aiResult
        })

        res.status(201).json({
            message: "Readiness report generated",
            report
        })
    } finally {
        await parser.destroy()
    }
})

const getAllReports = asyncHandler(async (req, res) => {
    // Exclude heavy fields for the list view — full detail is fetched per-report.
    const reports = await ReadinessReport.find({ user: req.user.id })
        .select("jobDescription matchScore createdAt")
        .sort({ createdAt: -1 })

    res.status(200).json({ reports })
})

const getReportById = asyncHandler(async (req, res) => {
    const report = await ReadinessReport.findOne({ _id: req.params.id, user: req.user.id })

    if (!report) {
        // Same message whether the report doesn't exist or belongs to someone
        // else — never confirm to a client that a given ID exists but "isn't
        // theirs," which itself leaks information.
        throw new ApiError(404, "Report not found")
    }

    res.status(200).json({ report })
})

/**
 * IDOR FIX: the tutorial's equivalent function fetched the report with
 * findById(req.params.id) only — no ownership check — so any authenticated
 * user could generate (and download) a PDF built from another user's stored
 * report just by knowing or guessing its MongoDB ObjectId. Scoping the query
 * to { _id, user: req.user.id } closes that.
 */
const generateResumePdf = asyncHandler(async (req, res) => {
    const report = await ReadinessReport.findOne({ _id: req.params.id, user: req.user.id })

    if (!report) {
        throw new ApiError(404, "Report not found")
    }

    const html = await generateTailoredResumeHtml({
        jobDescription: report.jobDescription,
        resumeText: report.resumeText
    })

    const browser = await puppeteer.launch({
        headless: true,
        args: [ "--no-sandbox", "--disable-setuid-sandbox" ]
    })

    try {
        const page = await browser.newPage()
        await page.setContent(html, { waitUntil: "networkidle0" })
        const pdfBuffer = await page.pdf({ format: "A4", printBackground: true })

        res.setHeader("Content-Type", "application/pdf")
        res.setHeader("Content-Disposition", "attachment; filename=tailored-resume.pdf")
        res.status(200).send(pdfBuffer)
    } finally {
        // Always close the browser, even if page rendering throws — otherwise
        // a failed request leaks a whole headless Chromium process.
        await browser.close()
    }
})

module.exports = { createReport, getAllReports, getReportById, generateResumePdf }
