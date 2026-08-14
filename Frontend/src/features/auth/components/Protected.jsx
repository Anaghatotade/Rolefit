import { Navigate } from "react-router-dom"
import { useAuth } from "../auth.context"

export default function Protected({ children }) {
    const { user, booting } = useAuth()

    if (booting) return <div className="page-loading">Loading...</div>
    if (!user) return <Navigate to="/login" replace />

    return children
}
