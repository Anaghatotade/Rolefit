import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useAuth } from "../auth.context"

const MIN_PASSWORD = 8

export default function Register() {
    const { register } = useAuth()
    const navigate = useNavigate()
    const [ form, setForm ] = useState({ username: "", email: "", password: "" })
    const [ error, setError ] = useState(null)
    const [ submitting, setSubmitting ] = useState(false)

    const passwordOk = form.password.length >= MIN_PASSWORD
    const usernameOk = form.username.trim().length >= 3
    const canSubmit = passwordOk && usernameOk && form.email.length > 3

    async function handleSubmit(e) {
        e.preventDefault()
        setError(null)
        setSubmitting(true)
        try {
            await register(form)
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
                    <h1>Create your account</h1>
                    {error && <div className="banner banner-error" role="alert">{error}</div>}

                    <div className="field">
                        <label className="label">Username</label>
                        <input
                            className="input"
                            required
                            minLength={3}
                            value={form.username}
                            onChange={(e) => setForm({ ...form, username: e.target.value })}
                        />
                        <span className={`hint ${form.username.length > 0 && !usernameOk ? "hint-error" : ""}`}>
                            At least 3 characters
                        </span>
                    </div>

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
                            minLength={MIN_PASSWORD}
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                        />
                        <span className={`hint ${form.password.length > 0 && !passwordOk ? "hint-error" : "hint-ok"}`}>
                            {form.password.length}/{MIN_PASSWORD} characters minimum
                        </span>
                    </div>

                    <button className="btn btn-primary btn-block" type="submit" disabled={submitting || !canSubmit}>
                        {submitting ? "Creating account..." : "Register"}
                    </button>
                    <p style={{ textAlign: "center", margin: 0 }}>
                        Already have an account? <Link to="/login">Log in</Link>
                    </p>
                </form>
            </div>
        </div>
    )
}
