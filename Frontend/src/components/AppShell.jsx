import { Link, useLocation } from "react-router-dom"
import { useAuth } from "../features/auth/auth.context"

/**
 * Every authenticated page renders inside this. Before this existed, the
 * only way back to the dashboard from a report was a plain text "← Back"
 * link on that one page — Practice mode had no way back at all except the
 * browser's back button. A persistent nav is the single highest-leverage
 * fix for "this doesn't feel like a real product."
 */
export default function AppShell({ children }) {
    const { user, logout } = useAuth()
    const location = useLocation()

    const initials = user?.username?.slice(0, 2)?.toUpperCase() || "?"

    return (
        <div className="app-shell">
            <nav className="nav">
                <div className="nav-inner">
                    <Link to="/dashboard" className="nav-brand">Role<span>Fit</span></Link>
                    <div className="nav-links">
                        <Link
                            to="/dashboard"
                            className={`nav-link ${location.pathname === "/dashboard" ? "active" : ""}`}
                        >
                            Dashboard
                        </Link>
                    </div>
                    <div className="nav-user">
                        <div className="avatar">{initials}</div>
                        <button className="btn btn-ghost btn-sm" onClick={logout}>Log out</button>
                    </div>
                </div>
            </nav>
            <main>{children}</main>
        </div>
    )
}
