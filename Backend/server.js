//server ko start karna

require("dotenv").config()

const mongoose = require("mongoose")
const { validateEnv } = require("./src/config/env")
validateEnv()

const connectToDB = require("./src/config/database")
const app = require("./src/app")

const PORT = process.env.PORT || 3000

connectToDB().then(() => {
    const server = app.listen(PORT, () => {   //starts the server
        console.log(`RoleFit backend running on port ${PORT}`)
    })

    // Hosting platforms send SIGTERM on redeploys/restarts/scaling events —
    // without handling it, in-flight requests get dropped mid-response
    // instead of finishing cleanly. Stop accepting new connections, let
    // existing ones complete, then close the DB connection.
    function shutdown(signal) {
        console.log(`${signal} received, shutting down gracefully...`)
        server.close(async () => {
            await mongoose.connection.close()
            console.log("Server and DB connection closed.")
            process.exit(0)
        })
        // Force-exit if shutdown hangs (e.g. a stuck connection) instead of
        // leaving the process alive indefinitely.
        setTimeout(() => process.exit(1), 10000).unref()
    }

    process.on("SIGTERM", () => shutdown("SIGTERM"))
    process.on("SIGINT", () => shutdown("SIGINT"))
})
