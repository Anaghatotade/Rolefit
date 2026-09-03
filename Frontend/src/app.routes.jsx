import { Routes, Route } from "react-router-dom"
import { AuthProvider } from "./features/auth/auth.context"
import { ToastProvider } from "./components/toast.context"
import AuthenticatedLayout from "./components/AuthenticatedLayout"
import Landing from "./features/marketing/pages/Landing"
import Login from "./features/auth/pages/Login"
import Register from "./features/auth/pages/Register"
import Home from "./features/readiness/pages/Home"
import ReportView from "./features/readiness/pages/ReportView"
import PracticeSession from "./features/practice/pages/PracticeSession"
import Copilot from "./features/copilot/pages/Copilot"
import AdminDashboard from "./features/admin/pages/AdminDashboard"

export default function App() {
    return (
        <AuthProvider>
            <ToastProvider>
                <Routes>
                    <Route path="/" element={<Landing />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/dashboard" element={<AuthenticatedLayout><Home /></AuthenticatedLayout>} />
                    <Route path="/reports/:id" element={<AuthenticatedLayout><ReportView /></AuthenticatedLayout>} />
                    <Route path="/reports/:id/practice" element={<AuthenticatedLayout><PracticeSession /></AuthenticatedLayout>} />
                    <Route path="/reports/:id/copilot" element={<AuthenticatedLayout><Copilot /></AuthenticatedLayout>} />
                    <Route path="/admin" element={<AuthenticatedLayout><AdminDashboard /></AuthenticatedLayout>} />
                </Routes>
            </ToastProvider>
        </AuthProvider>
    )
}
