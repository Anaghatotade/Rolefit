import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { fetchAdminOverview } from "../services/admin.api"
import { SkeletonLines } from "../../../components/Feedback"
import ScoreBadge from "../../../components/ScoreBadge"

/**
 * Not linked from the nav — intentionally. This is a single-owner demo
 * dashboard, not a feature every user should see or discover, so it's
 * reached directly at /admin rather than adding a nav item that would be a
 * dead end (403) for every non-admin visitor. Access is fully enforced
 * server-side (admin.middleware.js) regardless of whether this link is
 * visible anywhere — this page assumes nothing about who can reach it.
 */
export default function AdminDashboard() {
    const [ data, setData ] = useState(null)
    const [ loading, setLoading ] = useState(true)
    const [ error, setError ] = useState(null)

    useEffect(() => {
        fetchAdminOverview()
            .then(setData)
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false))
    }, [])

    if (loading) return <div className="container page"><SkeletonLines count={6} /></div>

    if (error) {
        return (
            <div className="container page">
                <div className="banner banner-error" role="alert">{error}</div>
                <p style={{ marginTop: "var(--space-4)" }}>
                    <Link to="/dashboard">← Back to dashboard</Link>
                </p>
            </div>
        )
    }

    const { stats, recentSignups, recentLogins, recentReports } = data

    return (
        <div className="container-wide">
            <div className="page">
                <Link to="/dashboard" className="btn btn-ghost btn-sm" style={{ marginBottom: "var(--space-4)", paddingLeft: 0 }}>← Dashboard</Link>
                <h1 style={{ marginBottom: "var(--space-2)" }}>Admin Activity</h1>
                <p style={{ marginBottom: "var(--space-5)" }}>Live signup, login, and usage activity across RoleFit.</p>

                <div className="stat-grid">
                    <div className="stat">
                        <div className="value">{stats.totalUsers}</div>
                        <div className="label">Total Users</div>
                    </div>
                    <div className="stat">
                        <div className="value">{stats.newSignups7d}</div>
                        <div className="label">New Signups (7d)</div>
                    </div>
                    <div className="stat">
                        <div className="value">{stats.activeUsers24h}</div>
                        <div className="label">Active Users (24h)</div>
                    </div>
                    <div className="stat">
                        <div className="value">{stats.totalReports}</div>
                        <div className="label">Reports Generated</div>
                    </div>
                </div>

                <div className="row" style={{ alignItems: "flex-start", gap: "var(--space-5)", flexWrap: "wrap" }}>
                    <div className="card" style={{ flex: "1 1 300px" }}>
                        <h2 style={{ marginBottom: "var(--space-3)" }}>Recent Signups</h2>
                        {recentSignups.length === 0 && <p style={{ margin: 0 }}>No signups yet.</p>}
                        <div className="stack">
                            {recentSignups.map((u) => (
                                <div key={u._id} className="row-between">
                                    <span style={{ fontSize: "var(--text-sm)" }}>{u.username} <span className="hint">({u.email})</span></span>
                                    <span className="hint">{new Date(u.createdAt).toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="card" style={{ flex: "1 1 300px" }}>
                        <h2 style={{ marginBottom: "var(--space-3)" }}>Recent Logins</h2>
                        {recentLogins.length === 0 && <p style={{ margin: 0 }}>No logins recorded yet.</p>}
                        <div className="stack">
                            {recentLogins.map((u) => (
                                <div key={u._id} className="row-between">
                                    <span style={{ fontSize: "var(--text-sm)" }}>{u.username} <span className="hint">({u.email})</span></span>
                                    <span className="hint">{new Date(u.lastLoginAt).toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="card" style={{ marginTop: "var(--space-5)" }}>
                    <h2 style={{ marginBottom: "var(--space-3)" }}>Recent Reports Generated</h2>
                    {recentReports.length === 0 && <p style={{ margin: 0 }}>No reports generated yet.</p>}
                    <div className="stack">
                        {recentReports.map((r) => (
                            <div key={r._id} className="row-between" style={{ alignItems: "flex-start" }}>
                                <div>
                                    <div style={{ fontSize: "var(--text-sm)" }}>
                                        {r.user?.username || "Unknown user"} <span className="hint">({r.user?.email || "—"})</span>
                                    </div>
                                    <div style={{ fontSize: "var(--text-sm)", color: "var(--color-text-muted)", maxWidth: 480 }}>
                                        {r.jobDescription.slice(0, 90)}{r.jobDescription.length > 90 ? "..." : ""}
                                    </div>
                                </div>
                                <div className="row" style={{ gap: "var(--space-3)" }}>
                                    <ScoreBadge score={r.matchScore} />
                                    <span className="hint">{new Date(r.createdAt).toLocaleString()}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
