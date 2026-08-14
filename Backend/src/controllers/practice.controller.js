const ReadinessReport = require("../models/readinessReport.model")
const ApiError = require("../utils/ApiError")
const asyncHandler = require("../utils/asyncHandler")
const { gradeAnswer } = require("../services/ai.service")

/**
 * MOCK INTERVIEW PRACTICE MODE
 *
 * A readiness report already contains 10 questions (5 technical, 5
 * behavioral) with AI-generated ideal answers. This feature turns that
 * static list into an interactive loop: the user answers a question in
 * their own words, we send both the question and their answer (plus the
 * stored ideal answer as a grading reference) back to Gemini, and store the
 * graded result on the report itself so progress persists across sessions.
 */

const submitAnswer = asyncHandler(async (req, res) => {
    const { questionType, questionIndex, userAnswer } = req.body

    const report = await ReadinessReport.findOne({ _id: req.params.id, user: req.user.id })
    if (!report) {
        throw new ApiError(404, "Report not found")
    }

    const questionSet = questionType === "technical" ? report.technicalQuestions : report.behavioralQuestions
    const target = questionSet[questionIndex]

    if (!target) {
        throw new ApiError(400, "No question exists at that index for this question type")
    }

    const grade = await gradeAnswer({
        question: target.question,
        idealAnswer: target.idealAnswer,
        userAnswer
    })

    // Replace any previous attempt at the same question rather than piling
    // up duplicates, so re-attempting a question updates progress instead
    // of cluttering history.
    report.practiceAttempts = report.practiceAttempts.filter(
        (attempt) => !(attempt.questionType === questionType && attempt.questionIndex === questionIndex)
    )
    report.practiceAttempts.push({
        questionType,
        questionIndex,
        userAnswer,
        ...grade
    })

    await report.save()

    res.status(200).json({ message: "Answer graded", grade, attempts: report.practiceAttempts })
})

const getProgress = asyncHandler(async (req, res) => {
    const report = await ReadinessReport.findOne({ _id: req.params.id, user: req.user.id })
        .select("technicalQuestions behavioralQuestions practiceAttempts")

    if (!report) {
        throw new ApiError(404, "Report not found")
    }

    res.status(200).json({
        technicalQuestions: report.technicalQuestions,
        behavioralQuestions: report.behavioralQuestions,
        practiceAttempts: report.practiceAttempts
    })
})

module.exports = { submitAnswer, getProgress }
