import { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { fetchReports, createReport } from "../services/readiness.api"
import { EmptyState, SkeletonLines } from "../../../components/Feedback"
import ScoreBadge from "../../../components/ScoreBadge"
import { useToast } from "../../../components/toast.context"

const MAX_FILE_BYTES = 3 * 1024 * 1024
const MIN_JD = 30
const MIN_SELF = 20

export default function Home() {
    const navigate = useNavigate()
    const { showToast } = useToast()

    const [ reports, setReports ] = useState([])
    const [ loadingReports, setLoadingReports ] = useState(true)
    const [ listError, setListError ] = useState(null)

    const [ form, setForm ] = useState({ jobDescription: "", selfDescription: "" })
    const [ resumeFile, setResumeFile ] = useState(null)
    const [ formError, setFormError ] = useState(null)
    const [ submitting, setSubmitting ] = useState(false)

    useEffect(() => { loadReports() }, [])

    function loadReports() {
        setLoadingReports(true)
        setListError(null)
        fetchReports()
            .then((data) => setReports(data.reports))
            .catch((err) => setListError(err.message))
            .finally(() => setLoadingReports(false))
    }

    const jdOk = form.jobDescription.trim().length >= MIN_JD
    const selfOk = form.selfDescription.trim().length >= MIN_SELF
    const canSubmit = jdOk && selfOk && !!resumeFile && !submitting

    function handleFileChange(e) {
        const file = e.target.files[0]
        setFormError(null)
        if (file && file.size > MAX_FILE_BYTES) {
            setFormError(`"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)}MB — resumes must be under 3MB`)
            setResumeFile(null)
            e.target.value = ""
            return
        }
        setResumeFile(file || null)
    }

    async function handleCreate(e) {
        e.preventDefault()
        setFormError(null)
        if (!resumeFile) {
            setFormError("Please attach your resume as a PDF")
            return
        }
        setSubmitting(true)
        try {
            const data = await createReport({ ...form, resumeFile })
            showToast("Readiness report generated")
            navigate(`/reports/${data.report._id}`)
        } catch (err) {
            setFormError(err.message)
        } finally {
            setSubmitting(false)
        }
    }

    const avgScore = useMemo(() => {
        if (reports.length === 0) return null
        return Math.round(reports.reduce((sum, r) => sum + r.matchScore, 0) / reports.length)
    }, [ reports ])

    return (
        <div className="container">
            <div className="page">
                <div className="section-title">
                    <h1>Dashboard</h1>
                </div>

                {!loadingReports && reports.length > 0 && (
                    <div className="stat-grid">
                        <div className="stat">
                            <div className="value">{reports.length}</div>
                            <div className="label">Reports</div>
                        </div>
                        <div className="stat">
                            <div className="value">{avgScore}%</div>
                            <div className="label">Avg match score</div>
                        </div>
                        <div className="stat">
                            <div className="value">{reports[0]?.matchScore ?? "—"}%</div>
                            <div className="label">Latest score</div>
                        </div>
                    </div>
                )}

                <div className="card" style={{ marginBottom: "var(--space-6)" }}>
                    <h2 style={{ marginBottom: "var(--space-4)" }}>New Readiness Report</h2>
                    <form onSubmit={handleCreate}>
                        {formError && <div className="banner banner-error" role="alert" style={{ marginBottom: "var(--space-4)" }}>{formError}</div>}

                        <div className="field">
                            <div className="field-row-end">
                                <label className="label">Job description</label>
                                <span className={`hint ${form.jobDescription.length > 0 && !jdOk ? "hint-error" : ""}`}>
                                    {form.jobDescription.trim().length}/{MIN_JD}+ chars
                                </span>
                            </div>
                            <textarea
                                className="textarea"
                                required
                                placeholder="Paste the full job description here..."
                                value={form.jobDescription}
                                onChange={(e) => setForm({ ...form, jobDescription: e.target.value })}
                            />
                        </div>

                        <div className="field">
                            <div className="field-row-end">
                                <label className="label">About you</label>
                                <span className={`hint ${form.selfDescription.length > 0 && !selfOk ? "hint-error" : ""}`}>
                                    {form.selfDescription.trim().length}/{MIN_SELF}+ chars
                                </span>
                            </div>
                            <textarea
                                className="textarea"
                                required
                                placeholder="A few sentences about your background and goals..."
                                value={form.selfDescription}
                                onChange={(e) => setForm({ ...form, selfDescription: e.target.value })}
                            />
                        </div>

                        <div className="field">
                            <label className="label">Resume (PDF, max 3MB)</label>
                            <label className="file-drop">
                                <input type="file" accept="application/pdf" onChange={handleFileChange} />
                                {resumeFile ? (
                                    <span className="filename">{resumeFile.name}</span>
                                ) : (
                                    <span>Click to choose a PDF, or drag one here</span>
                                )}
                            </label>
                        </div>

                        <button className="btn btn-primary" type="submit" disabled={!canSubmit}>
                            {submitting ? "Analyzing... this can take up to a minute" : "Generate report"}
                        </button>
                    </form>
                </div>

                <div className="section-title">
                    <h2>Your Reports</h2>
                </div>

                {loadingReports && <SkeletonLines count={4} />}
                {!loadingReports && listError && <div className="banner banner-error" role="alert">{listError}</div>}

                {!loadingReports && !listError && reports.length === 0 && (
                    <EmptyState
                        title="No reports yet"
                        description="Generate your first readiness report above to get a match score, skill gaps, and a prep plan."
                    />
                )}

                <div className="stack">
                    {reports.map((r) => (
                        <Link key={r._id} to={`/reports/${r._id}`} className="card card-hover" style={{ textDecoration: "none", color: "inherit" }}>
                            <div className="row-between">
                                <div>
                                    <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", marginBottom: 4 }}>
                                        {new Date(r.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                                    </div>
                                    <div style={{ fontSize: "var(--text-sm)", maxWidth: 480, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {r.jobDescription}
                                    </div>
                                </div>
                                <ScoreBadge score={r.matchScore} />
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    )
}
