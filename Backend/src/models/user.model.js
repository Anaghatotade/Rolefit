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
    }
}, { timestamps: true })

module.exports = mongoose.model("User", userSchema)
