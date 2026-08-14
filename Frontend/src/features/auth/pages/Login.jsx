import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useAuth } from "../auth.context"

export default function Login() {
    const { login } = useAuth()
    const navigate = useNavigate()
    const [ form, setForm ] = useState({ email: "", password: "" })
    const [ error, setError ] = useState(null)
    const [ submitting, setSubmitting ] = useState(false)

    async function handleSubmit(e) {
        e.preventDefault()
        setError(null)
        setSubmitting(true)
        try {
            await login(form)
            navigate("/dashboard")
        } catch (err) {
            setError(err.message)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="container" style={{ maxWidth: 400 }}>
            <div className="page" style={{ paddingTop: "10vh" }}>
                <Link to="/" className="nav-brand" style={{ display: "block", marginBottom: "var(--space-6)" }}>
                    Role<span>Fit</span>
                </Link>
                <form onSubmit={handleSubmit} className="card stack">
                    <h1>Welcome back</h1>
                    {error && <div className="banner banner-error" role="alert">{error}</div>}
                    <div className="field">
                        <label className="label">Email</label>
                        <input
                            className="input"
                            type="email"
                            required
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                        />
                    </div>
                    <div className="field">
                        <label className="label">Password</label>
                        <input
                            className="input"
                            type="password"
                            required
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                        />
                    </div>
                    <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
                        {submitting ? "Logging in..." : "Log in"}
                    </button>
                    <p style={{ textAlign: "center", margin: 0 }}>
                        No account? <Link to="/register">Register</Link>
                    </p>
                </form>
            </div>
        </div>
    )
}
