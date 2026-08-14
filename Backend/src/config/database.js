const mongoose = require("mongoose")

async function connectToDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI)
        console.log("Connected to MongoDB Atlas")
    } catch (err) {
        console.error("Failed to connect to MongoDB Atlas:", err.message)
        process.exit(1)
    }
}

module.exports = connectToDB
