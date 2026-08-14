import { useEffect, useMemo, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { fetchPracticeProgress, submitPracticeAnswer } from "../services/practice.api"
import { SkeletonLines } from "../../../components/Feedback"
import { useToast } from "../../../components/toast.context"

export default function PracticeSession() {
    const { id } = useParams()
    const { showToast } = useToast()

    const [ technicalQuestions, setTechnicalQuestions ] = useState([])
    const [ behavioralQuestions, setBehavioralQuestions ] = useState([])
    const [ attempts, setAttempts ] = useState([])
    const [ loading, setLoading ] = useState(true)
    const [ loadError, setLoadError ] = useState(null)

    const [ activeIndex, setActiveIndex ] = useState(0)
    const [ answer, setAnswer ] = useState("")
    const [ grading, setGrading ] = useState(false)
    const [ gradeError, setGradeError ] = useState(null)

    useEffect(() => { loadProgress() }, [ id ])

    function loadProgress() {
        setLoading(true)
        setLoadError(null)
        fetchPracticeProgress(id)
            .then((data) => {
                setTechnicalQuestions(data.technicalQuestions)
                setBehavioralQuestions(data.behavioralQuestions)
                setAttempts(data.practiceAttempts)
            })
            .catch((err) => setLoadError(err.message))
            .finally(() => setLoading(false))
    }

    const questions = useMemo(() => ([
        ...technicalQuestions.map((q, i) => ({ ...q, questionType: "technical", questionIndex: i })),
        ...behavioralQuestions.map((q, i) => ({ ...q, questionType: "behavioral", questionIndex: i }))
    ]), [ technicalQuestions, behavioralQuestions ])

    const current = questions[activeIndex]
    const currentAttempt = attempts.find(
        (a) => current && a.questionType === current.questionType && a.questionIndex === current.questionIndex
    )
    const progressPct = questions.length > 0 ? Math.round((attempts.length / questions.length) * 100) : 0

    useEffect(() => {
        setAnswer("")
        setGradeError(null)
    }, [ activeIndex ])

    async function handleSubmit(e) {
        e.preventDefault()
        setGradeError(null)
        setGrading(true)
        try {
            const data = await submitPracticeAnswer(id, {
                questionType: current.questionType,
                questionIndex: current.questionIndex,
                userAnswer: answer
            })
            setAttempts(data.attempts)
            showToast(`Answer graded — ${data.grade.score}/100`)
        } catch (err) {
            setGradeError(err.message)
        } finally {
            setGrading(false)
        }
    }

    if (loading) return <div className="container page"><SkeletonLines count={6} /></div>
    if (loadError) return <div className="container page"><div className="banner banner-error" role="alert">{loadError}</div></div>
    if (questions.length === 0) return <div className="container page"><p>No questions available for this report.</p></div>

    return (
        <div className="container">
            <div className="page">
                <Link to={`/reports/${id}`} className="btn btn-ghost btn-sm" style={{ marginBottom: "var(--space-4)", paddingLeft: 0 }}>← Back to report</Link>

                <div className="row-between" style={{ marginBottom: "var(--space-2)" }}>
                    <h1>Mock Interview Practice</h1>
                    <span className="hint">{attempts.length}/{questions.length} answered</span>
                </div>
                <div className="progress-track" style={{ marginBottom: "var(--space-5)" }}>
                    <div className="progress-fill" style={{ width: `${progressPct}%` }} />
                </div>

                <nav className="row" style={{ flexWrap: "wrap", marginBottom: "var(--space-5)" }}>
                    {questions.map((q, i) => {
                        const answered = attempts.some(
                            (a) => a.questionType === q.questionType && a.questionIndex === q.questionIndex
                        )
                        const isActive = i === activeIndex
                        return (
                            <button
                                key={`${q.questionType}-${q.questionIndex}`}
                                className={`btn btn-sm ${isActive ? "btn-primary" : answered ? "btn-secondary" : "btn-ghost"}`}
                                style={{ minWidth: 36 }}
                                onClick={() => setActiveIndex(i)}
                            >
                                {i + 1}
                            </button>
                        )
                    })}
                </nav>

                <div className="card">
                    <span className="badge badge-neutral" style={{ marginBottom: "var(--space-3)" }}>{current.questionType}</span>
                    <h2 style={{ marginBottom: "var(--space-4)" }}>{current.question}</h2>

                    <form onSubmit={handleSubmit}>
                        <textarea
                            className="textarea"
                            required
                            minLength={5}
                            style={{ minHeight: 140 }}
                            placeholder="Type your answer as you would say it out loud..."
                            value={answer}
                            onChange={(e) => setAnswer(e.target.value)}
                        />
                        {gradeError && <div className="banner banner-error" role="alert" style={{ margin: "var(--space-3) 0" }}>{gradeError}</div>}
                        <button className="btn btn-primary" type="submit" disabled={grading} style={{ marginTop: "var(--space-3)" }}>
                            {grading ? "Grading..." : currentAttempt ? "Re-submit answer" : "Submit answer"}
                        </button>
                    </form>

                    {currentAttempt && (
                        <div style={{ marginTop: "var(--space-5)", paddingTop: "var(--space-5)", borderTop: "1px solid var(--color-border)" }}>
                            <div className="row" style={{ marginBottom: "var(--space-3)" }}>
                                <span className={`badge badge-${currentAttempt.score >= 75 ? "success" : currentAttempt.score >= 50 ? "warning" : "danger"}`}>
                                    {currentAttempt.score}/100
                                </span>
                            </div>
                            <p>{currentAttempt.feedback}</p>
                            <div className="row" style={{ alignItems: "flex-start", gap: "var(--space-6)", flexWrap: "wrap" }}>
                                <div>
                                    <h3 style={{ marginBottom: "var(--space-2)", fontSize: "var(--text-sm)" }}>Strengths</h3>
                                    <ul style={{ margin: 0, paddingLeft: "var(--space-4)", fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
                                        {currentAttempt.strengths.map((s, i) => <li key={i}>{s}</li>)}
                                    </ul>
                                </div>
                                <div>
                                    <h3 style={{ marginBottom: "var(--space-2)", fontSize: "var(--text-sm)" }}>Improve</h3>
                                    <ul style={{ margin: 0, paddingLeft: "var(--space-4)", fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
                                        {currentAttempt.improvements.map((s, i) => <li key={i}>{s}</li>)}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
