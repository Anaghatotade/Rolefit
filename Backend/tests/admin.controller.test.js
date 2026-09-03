jest.mock("../src/models/user.model")
jest.mock("../src/models/readinessReport.model")

const User = require("../src/models/user.model")
const ReadinessReport = require("../src/models/readinessReport.model")
const { getOverview } = require("../src/controllers/admin.controller")

const flushPromises = () => new Promise((resolve) => setImmediate(resolve))

/**
 * Confirms the overview endpoint queries existing data correctly rather
 * than relying on any new event-logging collection — "new signups" comes
 * from User.createdAt, "active users" from User.lastLoginAt, activity feed
 * from ReadinessReport.createdAt. If any of these query shapes silently
 * broke, the numbers shown during a live demo would just be wrong with no
 * obvious error — worth pinning down with a test.
 */
describe("admin.controller getOverview", () => {
    function mockRes() {
        return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }
    }

    function mockFind(returnValue) {
        return {
            sort: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            populate: jest.fn().mockReturnThis(),
            select: jest.fn().mockResolvedValue(returnValue)
        }
    }

    afterEach(() => {
        jest.clearAllMocks()
    })

    it("aggregates stats and recent activity from existing collections", async () => {
        const req = {}
        const res = mockRes()
        const next = jest.fn()

        User.countDocuments
            .mockResolvedValueOnce(42) // totalUsers
            .mockResolvedValueOnce(5)  // newSignups7d
            .mockResolvedValueOnce(3)  // activeUsers24h
        ReadinessReport.countDocuments.mockResolvedValue(17)

        const fakeSignups = [ { _id: "u1", username: "anagha", email: "a@test.com", createdAt: new Date() } ]
        const fakeLogins = [ { _id: "u1", username: "anagha", email: "a@test.com", lastLoginAt: new Date() } ]
        const fakeReports = [ { _id: "r1", jobDescription: "JD", matchScore: 80, createdAt: new Date(), user: { username: "anagha" } } ]

        User.find
            .mockReturnValueOnce(mockFind(fakeSignups))
            .mockReturnValueOnce(mockFind(fakeLogins))
        ReadinessReport.find.mockReturnValueOnce(mockFind(fakeReports))

        getOverview(req, res, next)
        await flushPromises()

        expect(User.countDocuments).toHaveBeenCalledTimes(3) // total + newSignups7d + activeUsers24h
        expect(ReadinessReport.countDocuments).toHaveBeenCalledTimes(1)
        expect(res.status).toHaveBeenCalledWith(200)
        expect(res.json).toHaveBeenCalledWith({
            stats: { totalUsers: 42, newSignups7d: 5, activeUsers24h: 3, totalReports: 17 },
            recentSignups: fakeSignups,
            recentLogins: fakeLogins,
            recentReports: fakeReports
        })
        expect(next).not.toHaveBeenCalled()
    })
})
