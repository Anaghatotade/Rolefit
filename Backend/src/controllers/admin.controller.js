const User = require("../models/user.model")
const ReadinessReport = require("../models/readinessReport.model")
const asyncHandler = require("../utils/asyncHandler")

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Deliberately ONE endpoint returning everything the dashboard needs,
 * rather than several granular ones — this is a small admin page read
 * once per visit, not a paginated/filterable data table, so there's no
 * real benefit to splitting it up, only more round trips.
 *
 * Every number here comes from data the app already stores for other
 * reasons (User.createdAt/lastLoginAt, ReadinessReport.createdAt) — no new
 * event-logging collection was added. "Active users" and "new signups" are
 * computed at request time from existing timestamps, not accumulated in a
 * separate counter that could drift out of sync with reality.
 */
const getOverview = asyncHandler(async (req, res) => {
    const now = Date.now()
    const last24h = new Date(now - DAY_MS)
    const last7d = new Date(now - 7 * DAY_MS)

    const [
        totalUsers,
        newSignups7d,
        activeUsers24h,
        totalReports,
        recentSignups,
        recentLogins,
        recentReports
    ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ createdAt: { $gte: last7d } }),
        User.countDocuments({ lastLoginAt: { $gte: last24h } }),
        ReadinessReport.countDocuments(),
        User.find().sort({ createdAt: -1 }).limit(10).select("username email createdAt"),
        User.find({ lastLoginAt: { $exists: true } }).sort({ lastLoginAt: -1 }).limit(10).select("username email lastLoginAt"),
        ReadinessReport.find().sort({ createdAt: -1 }).limit(10)
            .populate("user", "username email")
            .select("jobDescription matchScore createdAt user")
    ])

    res.status(200).json({
        stats: { totalUsers, newSignups7d, activeUsers24h, totalReports },
        recentSignups,
        recentLogins,
        recentReports
    })
})

module.exports = { getOverview }
