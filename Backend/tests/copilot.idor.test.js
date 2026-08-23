jest.mock("../src/models/readinessReport.model")
jest.mock("../src/services/ai.service", () => ({
    askCopilot: jest.fn()
}))

const ReadinessReport = require("../src/models/readinessReport.model")
const { askCopilot } = require("../src/services/ai.service")
const { sendMessage } = require("../src/controllers/copilot.controller")

/**
 * Copilot builds its prompt from a report's job description, resume text,
 * and skill gaps — all private data. Same ownership-scoping requirement as
 * every other per-report endpoint.
 */
const flushPromises = () => new Promise((resolve) => setImmediate(resolve))

describe("copilot.controller IDOR protection", () => {
    function mockRes() {
        return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }
    }

    afterEach(() => {
        jest.clearAllMocks()
    })

    it("refuses to chat about a report that isn't the requester's own", async () => {
        const req = {
            params: { id: "someone-elses-report" },
            user: { id: "user-a" },
            body: { message: "What are my skill gaps?", history: [] }
        }
        const res = mockRes()
        const next = jest.fn()
        ReadinessReport.findOne.mockResolvedValue(null)

        sendMessage(req, res, next)
        await flushPromises()

        expect(ReadinessReport.findOne).toHaveBeenCalledWith({ _id: "someone-elses-report", user: "user-a" })
        expect(next.mock.calls[0][0].statusCode).toBe(404)
        expect(askCopilot).not.toHaveBeenCalled()
    })

    it("assembles context from the owned report and returns the reply", async () => {
        const req = {
            params: { id: "my-report" },
            user: { id: "user-a" },
            body: { message: "What are my skill gaps?", history: [] }
        }
        const res = mockRes()
        const next = jest.fn()
        const fakeReport = {
            _id: "my-report",
            user: "user-a",
            jobDescription: "JD text",
            resumeText: "resume text",
            matchScore: 78,
            skillGaps: [ { skill: "Docker", reason: "not mentioned" } ]
        }
        ReadinessReport.findOne.mockResolvedValue(fakeReport)
        askCopilot.mockResolvedValue("You're missing Docker experience.")

        sendMessage(req, res, next)
        await flushPromises()

        expect(askCopilot).toHaveBeenCalledWith({
            reportContext: {
                jobDescription: "JD text",
                resumeText: "resume text",
                matchScore: 78,
                skillGaps: fakeReport.skillGaps
            },
            history: [],
            message: "What are my skill gaps?"
        })
        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.json).toHaveBeenCalledWith({ reply: "You're missing Docker experience." })
    })
})
