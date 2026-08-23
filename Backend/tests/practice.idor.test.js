jest.mock("../src/models/readinessReport.model")
jest.mock("../src/services/ai.service", () => ({
    gradeAnswer: jest.fn()
}))

const ReadinessReport = require("../src/models/readinessReport.model")
const { gradeAnswer } = require("../src/services/ai.service")
const { submitAnswer, getProgress } = require("../src/controllers/practice.controller")

/**
 * Same IDOR concern as report.controller — submitAnswer/getProgress both
 * take a report ID from req.params and must never return or mutate a report
 * that isn't the requesting user's, even though the ID alone would be
 * enough to find it in the database.
 */
const flushPromises = () => new Promise((resolve) => setImmediate(resolve))

describe("practice.controller IDOR protection", () => {
    function mockRes() {
        return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }
    }

    afterEach(() => {
        jest.clearAllMocks()
    })

    describe("getProgress", () => {
        it("scopes the lookup to the requesting user", async () => {
            const req = { params: { id: "report-1" }, user: { id: "user-a" } }
            const res = mockRes()
            const next = jest.fn()
            const selectMock = jest.fn().mockResolvedValue({
                technicalQuestions: [],
                behavioralQuestions: [],
                practiceAttempts: []
            })
            ReadinessReport.findOne.mockReturnValue({ select: selectMock })

            getProgress(req, res, next)
            await flushPromises()

            expect(ReadinessReport.findOne).toHaveBeenCalledWith({ _id: "report-1", user: "user-a" })
            expect(res.status).toHaveBeenCalledWith(200)
        })

        it("returns 404 for a report belonging to another user", async () => {
            const req = { params: { id: "someone-elses-report" }, user: { id: "user-a" } }
            const res = mockRes()
            const next = jest.fn()
            const selectMock = jest.fn().mockResolvedValue(null)
            ReadinessReport.findOne.mockReturnValue({ select: selectMock })

            getProgress(req, res, next)
            await flushPromises()

            expect(next.mock.calls[0][0].statusCode).toBe(404)
            expect(res.json).not.toHaveBeenCalled()
        })
    })

    describe("submitAnswer", () => {
        it("refuses to grade an answer against a report that isn't the requester's own", async () => {
            const req = {
                params: { id: "someone-elses-report" },
                user: { id: "user-a" },
                body: { questionType: "technical", questionIndex: 0, userAnswer: "my answer" }
            }
            const res = mockRes()
            const next = jest.fn()
            ReadinessReport.findOne.mockResolvedValue(null)

            submitAnswer(req, res, next)
            await flushPromises()

            expect(ReadinessReport.findOne).toHaveBeenCalledWith({ _id: "someone-elses-report", user: "user-a" })
            expect(next.mock.calls[0][0].statusCode).toBe(404)
            // Never gets far enough to spend a Gemini call on data that wasn't theirs.
            expect(gradeAnswer).not.toHaveBeenCalled()
        })
    })
})
