const { GoogleGenAI, Type } = require("@google/genai")
const { z } = require("zod")
const { zodToJsonSchema } = require("zod-to-json-schema")

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY })
// Google retired the entire Gemini 2.0 line on June 1, 2026. gemini-3.6-flash
// is the current generally-available stable model (GA since July 2026).
// Third-party model IDs are exactly the kind of thing that breaks without
// warning in a live demo — worth knowing this happened if it comes up.
const MODEL = "gemini-3.6-flash"

/**
 * Gemini occasionally returns 503 ("model is currently experiencing high
 * demand") or 429 (rate limited) — both are transient, not a bug in this
 * app, and both are worth retrying automatically rather than surfacing to
 * the user on the first attempt. Anything else (a 400 for a bad request, a
 * 404 for a bad model name) is NOT retried, since retrying a request that's
 * wrong by construction just wastes three calls to fail the same way three
 * times.
 */
const RETRYABLE_STATUS_CODES = new Set([ 429, 503 ])

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

async function generateWithRetry(params, { retries = 2, baseDelayMs = 1000 } = {}) {
    let lastError
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await ai.models.generateContent(params)
        } catch (err) {
            lastError = err
            const isRetryable = RETRYABLE_STATUS_CODES.has(err.status)
            const isLastAttempt = attempt === retries

            if (!isRetryable || isLastAttempt) {
                throw err
            }

            // Exponential backoff: 1s, then 2s — enough to ride out a brief
            // spike without making the user wait excessively.
            await sleep(baseDelayMs * Math.pow(2, attempt))
        }
    }
    throw lastError
}

/**
 * This is the core AI-integration concept of the whole project:
 * instead of asking Gemini for prose and parsing it with regex (fragile —
 * the model's wording changes run to run), we define the exact shape we
 * want with Zod, convert it to a JSON Schema, and pass it as
 * `responseSchema` with `responseMimeType: "application/json"`. Gemini is
 * then constrained to return JSON matching that shape. We still parse with
 * Zod on the way back out, because "constrained" reduces malformed output,
 * it doesn't guarantee it — trusting an external API blindly is exactly the
 * kind of mistake this rebuild is fixing elsewhere.
 */
const reportResponseSchema = z.object({
    matchScore: z.number().min(0).max(100),
    technicalQuestions: z.array(z.object({
        question: z.string(),
        idealAnswer: z.string()
    })).length(5),
    behavioralQuestions: z.array(z.object({
        question: z.string(),
        idealAnswer: z.string()
    })).length(5),
    skillGaps: z.array(z.object({
        skill: z.string(),
        reason: z.string()
    })),
    prepPlan: z.array(z.string())
})

async function generateReadinessReport({ jobDescription, selfDescription, resumeText }) {
    const prompt = `
You are an expert technical interviewer and career coach.
Given the job description, the candidate's self description, and their resume text,
produce a realistic readiness assessment.

Job Description:
${jobDescription}

Candidate Self Description:
${selfDescription}

Resume Text:
${resumeText}

Return exactly 5 technical questions and 5 behavioral questions likely to be
asked for this role, each with a strong ideal answer grounded in the resume
and job description. Identify genuine skill gaps (skills the JD needs that
the resume doesn't evidence). Give a day-wise prep plan as a list of strings.
`

    const response = await generateWithRetry({
        model: MODEL,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: zodToJsonSchema(reportResponseSchema, "reportSchema").definitions.reportSchema
        }
    })

    const parsed = JSON.parse(response.text)
    return reportResponseSchema.parse(parsed)
}

const gradeResponseSchema = z.object({
    score: z.number().min(0).max(100),
    feedback: z.string(),
    strengths: z.array(z.string()),
    improvements: z.array(z.string())
})

/**
 * Powers Mock Interview Practice Mode. Grades a candidate's typed answer
 * against the question and the ideal answer already generated (and stored)
 * for that report — so the model has a concrete reference point instead of
 * grading "in a vacuum," which keeps scores more consistent across attempts.
 */
async function gradeAnswer({ question, idealAnswer, userAnswer }) {
    const prompt = `
You are grading a candidate's interview answer.

Question: ${question}

A strong reference answer: ${idealAnswer}

Candidate's actual answer: ${userAnswer}

Score the candidate's answer from 0-100 based on correctness, completeness,
and clarity compared to the reference answer. Give concise, specific feedback,
2-4 concrete strengths, and 2-4 concrete improvements. Be honest, not
inflated — a vague or incorrect answer should score low.
`

    const response = await generateWithRetry({
        model: MODEL,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: zodToJsonSchema(gradeResponseSchema, "gradeSchema").definitions.gradeSchema
        }
    })

    const parsed = JSON.parse(response.text)
    return gradeResponseSchema.parse(parsed)
}

async function generateTailoredResumeHtml({ jobDescription, resumeText }) {
    const prompt = `
You are an expert resume writer producing an ATS-friendly resume as clean
semantic HTML (no external CSS/JS, inline styles only, printable A4 layout).
Tailor the content to the job description below using only facts present in
the original resume text — do not invent experience.

Job Description:
${jobDescription}

Original Resume Text:
${resumeText}

Return ONLY the HTML document, nothing else.
`

    const response = await generateWithRetry({
        model: MODEL,
        contents: prompt
    })

    return response.text
        .replace(/^```html\n?/, "")
        .replace(/```$/, "")
        .trim()
}

/**
 * Powers the RoleFit Career Copilot chat. Deliberately NOT schema-constrained
 * like the two functions above — a conversational reply is free-form text by
 * nature, so forcing it into a JSON shape would add complexity with no
 * benefit. Consistent with generateTailoredResumeHtml's plain-text approach.
 *
 * Conversation history is passed in from the frontend and re-sent on every
 * call rather than stored server-side — there's no session state here, each
 * request is self-contained with everything Gemini needs to answer.
 */
async function askCopilot({ reportContext, history, message }) {
    const transcript = history
        .map((turn) => `${turn.role === "user" ? "Candidate" : "Copilot"}: ${turn.content}`)
        .join("\n")

    const prompt = `
You are RoleFit Copilot, a focused career-prep assistant. You ONLY have context
about this specific candidate's job application below — answer using it, and
say so plainly if something isn't covered by the available context rather
than inventing details.

Job Description:
${reportContext.jobDescription}

Resume Summary (first portion of extracted resume text):
${reportContext.resumeText.slice(0, 3000)}

Match Score: ${reportContext.matchScore}%

Identified Skill Gaps:
${reportContext.skillGaps.map((g) => `- ${g.skill}: ${g.reason}`).join("\n") || "None identified"}

Conversation so far:
${transcript || "(no previous messages)"}

Candidate: ${message}
Copilot:`

    const response = await generateWithRetry({
        model: MODEL,
        contents: prompt
    })

    return response.text.trim()
}

module.exports = { generateReadinessReport, gradeAnswer, generateTailoredResumeHtml, askCopilot }