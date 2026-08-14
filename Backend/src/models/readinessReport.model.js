const mongoose = require("mongoose")

const questionSchema = new mongoose.Schema({
    question: { type: String, required: true },
    idealAnswer: { type: String, required: true }
}, { _id: false })

const skillGapSchema = new mongoose.Schema({
    skill: { type: String, required: true },
    reason: { type: String, required: true }
}, { _id: false })

/**
 * One entry per question the user has attempted in Mock Interview Practice
 * Mode. Kept as a subdocument array on the report (not a separate
 * collection) because attempts are always read/written in the context of
 * a single report and never queried independently across reports.
 */
const practiceAttemptSchema = new mongoose.Schema({
    questionType: { type: String, enum: [ "technical", "behavioral" ], required: true },
    questionIndex: { type: Number, required: true },
    userAnswer: { type: String, required: true },
    score: { type: Number, min: 0, max: 100, required: true },
    feedback: { type: String, required: true },
    strengths: [ { type: String } ],
    improvements: [ { type: String } ],
    answeredAt: { type: Date, default: Date.now }
}, { _id: false })

const readinessReportSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    jobDescription: { type: String, required: true },
    selfDescription: { type: String, required: true },
    resumeText: { type: String, required: true },
    matchScore: { type: Number, min: 0, max: 100, required: true },
    technicalQuestions: [ questionSchema ],
    behavioralQuestions: [ questionSchema ],
    skillGaps: [ skillGapSchema ],
    prepPlan: [ { type: String } ],
    practiceAttempts: [ practiceAttemptSchema ]
}, { timestamps: true })

module.exports = mongoose.model("ReadinessReport", readinessReportSchema)
