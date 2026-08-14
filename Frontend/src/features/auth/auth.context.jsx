import { createContext, useContext, useEffect, useState } from "react"
import { loginUser, registerUser, logoutUser, fetchCurrentUser } from "./services/auth.api"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [ user, setUser ] = useState(null)
    // "booting" distinguishes "we haven't checked session yet" from
    // "we checked and there's no user" — without it, a page refresh briefly
    // flashes the logged-out UI before the session check resolves.
    const [ booting, setBooting ] = useState(true)

    useEffect(() => {
        fetchCurrentUser()
            .then((data) => setUser(data.user))
            .catch(() => setUser(null))
            .finally(() => setBooting(false))
    }, [])

    async function login(payload) {
        const data = await loginUser(payload)
        setUser(data.user)
    }

    async function register(payload) {
        const data = await registerUser(payload)
        setUser(data.user)
    }

    async function logout() {
        await logoutUser()
        setUser(null)
    }

    return (
        <AuthContext.Provider value={{ user, booting, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error("useAuth must be used within AuthProvider")
    return ctx
}
