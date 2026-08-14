import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { fetchReportById, downloadTailoredResume } from "../services/readiness.api"
import { SkeletonLines } from "../../../components/Feedback"
import ScoreBadge from "../../../components/ScoreBadge"
import { useToast } from "../../../components/toast.context"

export default function ReportView() {
    const { id } = useParams()
    const { showToast } = useToast()
    const [ report, setReport ] = useState(null)
    const [ loading, setLoading ] = useState(true)
    const [ error, setError ] = useState(null)
    const [ downloading, setDownloading ] = useState(false)
    const [ downloadError, setDownloadError ] = useState(null)

    useEffect(() => {
        setLoading(true)
        setError(null)
        fetchReportById(id)
            .then((data) => setReport(data.report))
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false))
    }, [ id ])

    async function handleDownload() {
        setDownloading(true)
        setDownloadError(null)
        try {
            const blob = await downloadTailoredResume(id)
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = url
            a.download = "tailored-resume.pdf"
            a.click()
            window.URL.revokeObjectURL(url)
            showToast("Tailored resume downloaded")
        } catch (err) {
            setDownloadError(err.message)
        } finally {
            setDownloading(false)
        }
    }

    if (loading) {
        return (
            <div className="container">
                <div className="page"><SkeletonLines count={6} /></div>
            </div>
        )
    }
    if (error) return <div className="container page"><div className="banner banner-error" role="alert">{error}</div></div>
    if (!report) return null

    const answeredCount = report.practiceAttempts?.length || 0
    const totalQuestions = report.technicalQuestions.length + report.behavioralQuestions.length

    return (
        <div className="container">
            <div className="page">
                <Link to="/dashboard" className="btn btn-ghost btn-sm" style={{ marginBottom: "var(--space-4)", paddingLeft: 0 }}>← Dashboard</Link>

                <div className="row-between" style={{ marginBottom: "var(--space-2)" }}>
                    <h1>Readiness Report</h1>
                    <ScoreBadge score={report.matchScore} />
                </div>
                <p style={{ maxWidth: 600 }}>{report.jobDescription.slice(0, 160)}{report.jobDescription.length > 160 ? "..." : ""}</p>

                {/* Next-action row — every result should lead somewhere */}
                <div className="row" style={{ marginBottom: "var(--space-6)", flexWrap: "wrap" }}>
                    <Link to={`/reports/${id}/practice`} className="btn btn-primary">
                        {answeredCount > 0 ? `Continue practice (${answeredCount}/${totalQuestions})` : "Start Mock Interview"}
                    </Link>
                    <Link to={`/reports/${id}/copilot`} className="btn btn-secondary">Ask Copilot</Link>
                    <button className="btn btn-secondary" onClick={handleDownload} disabled={downloading}>
                        {downloading ? "Generating PDF..." : "Download tailored resume"}
                    </button>
                </div>
                {downloadError && <div className="banner banner-error" role="alert" style={{ marginBottom: "var(--space-4)" }}>{downloadError}</div>}

                <div className="card" style={{ marginBottom: "var(--space-5)", borderColor: "var(--color-primary)" }}>
                    <div className="row-between" style={{ marginBottom: "var(--space-2)" }}>
                        <h2>Mock Interview Practice</h2>
                        <span className="badge badge-neutral">{answeredCount}/{totalQuestions} answered</span>
                    </div>
                    <p style={{ marginBottom: "var(--space-4)" }}>
                        Answer the {totalQuestions} technical and behavioral questions generated for this role,
                        one at a time, and get instant AI-graded feedback — score, strengths, and what to improve
                        — on every response.
                    </p>
                    <Link to={`/reports/${id}/practice`} className="btn btn-primary">
                        {answeredCount > 0 ? `Continue Mock Interview (${answeredCount}/${totalQuestions})` : "Start Mock Interview"}
                    </Link>
                </div>

                <div className="card" style={{ marginBottom: "var(--space-5)" }}>
                    <h2 style={{ marginBottom: "var(--space-3)" }}>Skill Gaps</h2>
                    {report.skillGaps.length === 0 && <p style={{ margin: 0 }}>No major gaps identified.</p>}
                    <div className="stack">
                        {report.skillGaps.map((gap, i) => (
                            <div key={i} className="row" style={{ alignItems: "flex-start" }}>
                                <span className="badge badge-warning">{gap.skill}</span>
                                <span style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>{gap.reason}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="card">
                    <h2 style={{ marginBottom: "var(--space-3)" }}>Prep Plan</h2>
                    <ol style={{ margin: 0, paddingLeft: "var(--space-5)", color: "var(--color-text-muted)" }}>
                        {report.prepPlan.map((step, i) => <li key={i} style={{ marginBottom: "var(--space-2)" }}>{step}</li>)}
                    </ol>
                </div>
            </div>
        </div>
    )
}
