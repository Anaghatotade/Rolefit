jest.mock("../src/models/readinessReport.model")
jest.mock("puppeteer")
// Explicit factory (rather than automock) so requiring this module never
// constructs the real Gemini client, which warns loudly without an API key.
jest.mock("../src/services/ai.service", () => ({
    generateReadinessReport: jest.fn(),
    generateTailoredResumeHtml: jest.fn(),
    gradeAnswer: jest.fn()
}))
jest.mock("pdf-parse", () => ({ PDFParse: jest.fn() }))

const ReadinessReport = require("../src/models/readinessReport.model")
const puppeteer = require("puppeteer")
const { generateTailoredResumeHtml } = require("../src/services/ai.service")
const { getReportById, generateResumePdf } = require("../src/controllers/report.controller")

/**
 * IDOR regression coverage for report.controller. The fix scopes every
 * per-report lookup to { _id, user: req.user.id } instead of the tutorial's
 * findById(id) alone, so user A can never read or generate a PDF from user
 * B's report just by guessing/knowing its ObjectId. These tests assert both
 * that the ownership filter is actually sent to Mongoose, and that a report
 * belonging to someone else results in a 404 (not a leak of "exists but not
 * yours").
 */
// Controllers are wrapped in asyncHandler, whose wrapper doesn't return the
// inner promise, so tests flush the microtask queue after invoking them —
// see the note in auth.middleware.test.js for why.
const flushPromises = () => new Promise((resolve) => setImmediate(resolve))

describe("report.controller IDOR protection", () => {
    function mockRes() {
        return {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            setHeader: jest.fn(),
            send: jest.fn()
        }
    }

    afterEach(() => {
        jest.clearAllMocks()
    })

    describe("getReportById", () => {
        it("scopes the lookup to the requesting user and returns the report when owned", async () => {
            const req = { params: { id: "report-1" }, user: { id: "user-a" } }
            const res = mockRes()
            const next = jest.fn()
            const fakeReport = { _id: "report-1", user: "user-a", jobDescription: "..." }

            ReadinessReport.findOne.mockResolvedValue(fakeReport)

            getReportById(req, res, next)
            await flushPromises()

            expect(ReadinessReport.findOne).toHaveBeenCalledWith({ _id: "report-1", user: "user-a" })
            expect(res.status).toHaveBeenCalledWith(200)
            expect(res.json).toHaveBeenCalledWith({ report: fakeReport })
            expect(next).not.toHaveBeenCalled()
        })

        it("returns 404 (not the other user's data) when the report belongs to someone else", async () => {
            const req = { params: { id: "report-owned-by-b" }, user: { id: "user-a" } }
            const res = mockRes()
            const next = jest.fn()

            // Scoped query correctly finds nothing, since it's not user-a's report.
            ReadinessReport.findOne.mockResolvedValue(null)

            getReportById(req, res, next)
            await flushPromises()

            expect(ReadinessReport.findOne).toHaveBeenCalledWith({ _id: "report-owned-by-b", user: "user-a" })
            expect(next).toHaveBeenCalledTimes(1)
            const err = next.mock.calls[0][0]
            expect(err.statusCode).toBe(404)
            expect(res.json).not.toHaveBeenCalled()
        })
    })

    describe("generateResumePdf", () => {
        it("refuses to generate a PDF for a report that isn't the requester's own", async () => {
            const req = { params: { id: "someone-elses-report" }, user: { id: "user-a" } }
            const res = mockRes()
            const next = jest.fn()

            ReadinessReport.findOne.mockResolvedValue(null)

            generateResumePdf(req, res, next)
            await flushPromises()

            expect(ReadinessReport.findOne).toHaveBeenCalledWith({ _id: "someone-elses-report", user: "user-a" })
            expect(next.mock.calls[0][0].statusCode).toBe(404)
            // Never gets far enough to touch the AI service or launch a browser.
            expect(generateTailoredResumeHtml).not.toHaveBeenCalled()
            expect(puppeteer.launch).not.toHaveBeenCalled()
        })

        it("generates the PDF once ownership is confirmed", async () => {
            const req = { params: { id: "my-report" }, user: { id: "user-a" } }
            const res = mockRes()
            const next = jest.fn()
            const fakeReport = { _id: "my-report", user: "user-a", jobDescription: "JD", resumeText: "resume text" }

            ReadinessReport.findOne.mockResolvedValue(fakeReport)
            generateTailoredResumeHtml.mockResolvedValue("<html></html>")

            const fakePage = { setContent: jest.fn(), pdf: jest.fn().mockResolvedValue(Buffer.from("pdf")) }
            const fakeBrowser = { newPage: jest.fn().mockResolvedValue(fakePage), close: jest.fn() }
            puppeteer.launch.mockResolvedValue(fakeBrowser)

            generateResumePdf(req, res, next)
            await flushPromises()

            expect(ReadinessReport.findOne).toHaveBeenCalledWith({ _id: "my-report", user: "user-a" })
            expect(res.status).toHaveBeenCalledWith(200)
            expect(res.send).toHaveBeenCalledWith(Buffer.from("pdf"))
            expect(fakeBrowser.close).toHaveBeenCalled()
            expect(next).not.toHaveBeenCalled()
        })
    })
})
