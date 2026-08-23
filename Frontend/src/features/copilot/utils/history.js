// Must match copilotMessageSchema's history caps on the backend
// (Backend/src/validators/report.validator.js) — kept as named exports so
// it's testable in isolation instead of buried as a local function inside
// the Copilot page component.
export const HISTORY_MESSAGE_COUNT_CAP = 20
export const HISTORY_ENTRY_CHAR_CAP = 4000

export function buildHistoryPayload(messages) {
    return messages.slice(-HISTORY_MESSAGE_COUNT_CAP).map((m) => ({
        role: m.role,
        content: m.content.length > HISTORY_ENTRY_CHAR_CAP
            ? m.content.slice(0, HISTORY_ENTRY_CHAR_CAP)
            : m.content
    }))
}
