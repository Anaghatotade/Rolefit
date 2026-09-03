const express = require("express")
const { getOverview } = require("../controllers/admin.controller")
const authMiddleware = require("../middlewares/auth.middleware")
const adminMiddleware = require("../middlewares/admin.middleware")

const router = express.Router()

router.use(authMiddleware, adminMiddleware)

router.get("/overview", getOverview)

module.exports = router
