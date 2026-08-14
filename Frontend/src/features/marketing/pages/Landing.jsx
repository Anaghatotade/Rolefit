import { Link } from "react-router-dom"
import { useAuth } from "../../auth/auth.context"

export default function Landing() {
    const { user, booting } = useAuth()
    const isLoggedIn = !booting && !!user

    return (
        <div className="app-shell">
            <nav className="nav">
                <div className="nav-inner">
                    <Link to="/" className="nav-brand">Role<span>Fit</span></Link>
                    <div className="nav-links">
                        {isLoggedIn ? (
                            <Link to="/dashboard" className="btn btn-primary btn-sm">Dashboard</Link>
                        ) : (
                            <>
                                <Link to="/login" className="nav-link">Log in</Link>
                                <Link to="/register" className="btn btn-primary btn-sm">Get started</Link>
                            </>
                        )}
                    </div>
                </div>
            </nav>

            <div className="container">
                <section className="hero">
                    <h1>Know exactly how ready you are for the role — before the interview does.</h1>
                    <p>
                        RoleFit compares your resume against a real job description, tells you what's
                        genuinely missing, and lets you practice the actual questions you'll be asked —
                        with AI feedback on every answer.
                    </p>
                    <div className="hero-actions">
                        {isLoggedIn ? (
                            <Link to="/dashboard" className="btn btn-primary">Go to Dashboard</Link>
                        ) : (
                            <>
                                <Link to="/register" className="btn btn-primary">Get started free</Link>
                                <Link to="/login" className="btn btn-secondary">Log in</Link>
                            </>
                        )}
                    </div>
                </section>

                <section className="feature-grid">
                    <div className="card">
                        <h3>Readiness Report</h3>
                        <p>Upload your resume and a job description to get a match score, real skill gaps, and a day-wise prep plan.</p>
                    </div>
                    <div className="card">
                        <h3>Mock Interview Practice</h3>
                        <p>Answer the exact technical and behavioral questions likely to come up, and get AI-graded feedback on each one.</p>
                    </div>
                    <div className="card">
                        <h3>Tailored Resume</h3>
                        <p>Generate an ATS-friendly, role-specific version of your resume as a downloadable PDF.</p>
                    </div>
                    <div className="card">
                        <h3>Career Copilot</h3>
                        <p>Ask questions about your specific report — your gaps, your answers, your resume — and get grounded, contextual answers.</p>
                    </div>
                </section>
            </div>
        </div>
    )
}
