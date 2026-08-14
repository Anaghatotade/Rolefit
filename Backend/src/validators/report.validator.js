const { z } = require("zod")

const createReportSchema = z.object({
    jobDescription: z.string().trim().min(30, "Job description looks too short to analyze meaningfully"),
    selfDescription: z.string().trim().min(20, "Tell us a bit more about yourself (min 20 characters)")
})

const submitAnswerSchema = z.object({
    questionType: z.enum([ "technical", "behavioral" ]),
    questionIndex: z.number().int().min(0),
    userAnswer: z.string().trim().min(5, "Your answer is too short to grade meaningfully")
})

const copilotMessageSchema = z.object({
    message: z.string().trim().min(1, "Message can't be empty").max(1000, "Keep messages under 1000 characters"),
    history: z.array(z.object({
        role: z.enum([ "user", "assistant" ]),
        content: z.string().max(4000)
    })).max(20).optional().default([])
})

module.exports = { createReportSchema, submitAnswerSchema, copilotMessageSchema }
