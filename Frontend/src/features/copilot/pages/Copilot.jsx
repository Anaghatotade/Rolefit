import { useEffect, useRef, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { fetchReportById } from "../../readiness/services/readiness.api"
import { sendCopilotMessage } from "../services/copilot.api"
import { SkeletonLines } from "../../../components/Feedback"

const QUICK_PROMPTS = [
    "What are my biggest skill gaps and how do I close them?",
    "How should I structure my answer to the first technical question?",
    "Rewrite my elevator pitch for this specific role"
]
const HISTORY_ENTRY_CHAR_CAP = 4000

function buildHistoryPayload(messages) {
    return messages.slice(-20).map((m) => ({
        role: m.role,
        content: m.content.length > HISTORY_ENTRY_CHAR_CAP ? m.content.slice(0, HISTORY_ENTRY_CHAR_CAP) : m.content
    }))
}
export default function Copilot() {
    const { id } = useParams()
    const [ report, setReport ] = useState(null)
    const [ loadingReport, setLoadingReport ] = useState(true)
    const [ loadError, setLoadError ] = useState(null)

    const [ messages, setMessages ] = useState([])
    const [ input, setInput ] = useState("")
    const [ sending, setSending ] = useState(false)
    const [ sendError, setSendError ] = useState(null)
    const threadEndRef = useRef(null)

    useEffect(() => {
        fetchReportById(id)
            .then((data) => setReport(data.report))
            .catch((err) => setLoadError(err.message))
            .finally(() => setLoadingReport(false))
    }, [ id ])

    useEffect(() => {
        threadEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [ messages, sending ])

    async function handleSend(text) {
        const trimmed = (text ?? input).trim()
        if (!trimmed || sending) return

        setSendError(null)
        const nextMessages = [ ...messages, { role: "user", content: trimmed } ]
        setMessages(nextMessages)
        setInput("")
        setSending(true)

        try {
            // Send the last 20 turns as history — matches the backend's cap,
            // and keeps the prompt from growing unbounded in a long session.
            const data = await sendCopilotMessage(id, {
                message: trimmed,
                history: messages.slice(-20)
            })
            setMessages([ ...nextMessages, { role: "assistant", content: data.reply } ])
        } catch (err) {
            setSendError(err.message)
            // Roll back the optimistic user message on failure so a retry
            // doesn't duplicate it in history sent to the backend.
            setMessages(messages)
        } finally {
            setSending(false)
        }
    }

    if (loadingReport) return <div className="container page"><SkeletonLines count={4} /></div>
    if (loadError) return <div className="container page"><div className="banner banner-error" role="alert">{loadError}</div></div>

    return (
        <div className="container" style={{ maxWidth: 720 }}>
            <div className="page">
                <Link to={`/reports/${id}`} className="btn btn-ghost btn-sm" style={{ marginBottom: "var(--space-4)", paddingLeft: 0 }}>← Back to report</Link>

                <h1 style={{ marginBottom: "var(--space-2)" }}>Career Copilot</h1>
                <div className="banner" style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", marginBottom: "var(--space-5)" }}>
                    Chatting about: <strong style={{ marginLeft: 4 }}>{report.jobDescription.slice(0, 80)}{report.jobDescription.length > 80 ? "..." : ""}</strong>
                    <span className="badge badge-neutral" style={{ marginLeft: "auto" }}>{report.matchScore}% match</span>
                </div>

                <div className="card" style={{ minHeight: 360, display: "flex", flexDirection: "column" }}>
                    <div className="chat-thread" style={{ flex: 1, marginBottom: "var(--space-4)" }}>
                        {messages.length === 0 && (
                            <div className="chat-suggestions">
                                {QUICK_PROMPTS.map((p) => (
                                    <button key={p} className="chip" onClick={() => handleSend(p)}>{p}</button>
                                ))}
                            </div>
                        )}
                        {messages.map((m, i) => (
                            <div key={i} className={`chat-bubble chat-bubble-${m.role === "user" ? "user" : "assistant"}`}>
                                {m.content}
                            </div>
                        ))}
                        {sending && (
                            <div className="chat-bubble chat-bubble-assistant" style={{ color: "var(--color-text-faint)" }}>
                                Copilot is thinking...
                            </div>
                        )}
                        <div ref={threadEndRef} />
                    </div>

                    {sendError && <div className="banner banner-error" role="alert" style={{ marginBottom: "var(--space-3)" }}>{sendError}</div>}

                    <form
                        className="row"
                        onSubmit={(e) => { e.preventDefault(); handleSend() }}
                    >
                        <input
                            className="input"
                            placeholder="Ask about your gaps, answers, or resume..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            maxLength={1000}
                        />
                        <button className="btn btn-primary" type="submit" disabled={sending || !input.trim()}>Send</button>
                    </form>
                </div>
            </div>
        </div>
    )
}
