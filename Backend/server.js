require("dotenv").config()

const { validateEnv } = require("./src/config/env")
validateEnv()

const connectToDB = require("./src/config/database")
const app = require("./src/app")

const PORT = process.env.PORT || 3000

connectToDB().then(() => {
    app.listen(PORT, () => {
        console.log(`RoleFit backend running on port ${PORT}`)
    })
})
