const mongoose = require("mongoose")

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        unique: [ true, "Username already taken" ],
        required: true,
        trim: true
    },
    email: {
        type: String,
        unique: [ true, "Account already exists with this email address" ],
        required: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    // Set on every successful login. This is the only new field added for
    // the admin activity dashboard — "new signups" already comes for free
    // from the existing `createdAt` timestamp, and "recent report/practice
    // activity" reuses ReadinessReport's existing timestamps. This is the
    // one genuinely missing piece: nothing previously recorded *when* a
    // user last logged in.
    lastLoginAt: {
        type: Date
    }
}, { timestamps: true })

module.exports = mongoose.model("User", userSchema)
