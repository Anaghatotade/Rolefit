const multer = require("multer")
const ApiError = require("../utils/ApiError")

/**
 * In-memory storage: the file lives as a Buffer on req.file.buffer, never
 * touches disk. Fine for resumes (a few hundred KB–few MB); would need
 * diskStorage or direct-to-cloud-storage streaming for large files, since
 * memory storage means N concurrent uploads = N buffers held in RAM.
 *
 * Fix over the tutorial: a fileFilter that actually checks the mimetype.
 * The original only capped file SIZE, so a renamed .exe or .docx passed
 * straight to pdf-parse, which would throw an unhandled error mid-request.
 */
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype !== "application/pdf") {
            return cb(new ApiError(400, "Only PDF files are accepted for resume upload"))
        }
        cb(null, true)
    }
})

module.exports = upload
