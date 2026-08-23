import { describe, it, expect } from "vitest"
import { buildHistoryPayload, HISTORY_ENTRY_CHAR_CAP, HISTORY_MESSAGE_COUNT_CAP } from "./history"

describe("buildHistoryPayload", () => {
    it("passes short messages through unchanged", () => {
        const messages = [
            { role: "user", content: "What are my skill gaps?" },
            { role: "assistant", content: "You're missing Docker experience." }
        ]

        expect(buildHistoryPayload(messages)).toEqual(messages)
    })

    it("truncates any entry longer than the char cap — regression test for the validation bug this fixed", () => {
        const longReply = "a".repeat(HISTORY_ENTRY_CHAR_CAP + 500)
        const messages = [ { role: "assistant", content: longReply } ]

        const result = buildHistoryPayload(messages)

        expect(result[0].content.length).toBe(HISTORY_ENTRY_CHAR_CAP)
    })

    it("only keeps the most recent messages up to the count cap", () => {
        const messages = Array.from({ length: HISTORY_MESSAGE_COUNT_CAP + 10 }, (_, i) => ({
            role: "user",
            content: `message ${i}`
        }))

        const result = buildHistoryPayload(messages)

        expect(result).toHaveLength(HISTORY_MESSAGE_COUNT_CAP)
        // The oldest messages should have been dropped, newest kept.
        expect(result[0].content).toBe(`message ${messages.length - HISTORY_MESSAGE_COUNT_CAP}`)
        expect(result[result.length - 1].content).toBe(`message ${messages.length - 1}`)
    })
})
