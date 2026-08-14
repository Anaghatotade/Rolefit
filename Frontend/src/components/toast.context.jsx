import { createContext, useCallback, useContext, useState } from "react"

const ToastContext = createContext(null)

let idCounter = 0

/**
 * A deliberately small toast system — no external library. Most tutorial
 * projects give zero feedback on success (a report saves, an answer gets
 * graded, and the UI just... changes). A brief, dismissable confirmation is
 * a cheap way to make the app feel like it's responding to you.
 */
export function ToastProvider({ children }) {
    const [ toasts, setToasts ] = useState([])

    const showToast = useCallback((message, type = "success") => {
        const id = ++idCounter
        setToasts((prev) => [ ...prev, { id, message, type } ])
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id))
        }, 3500)
    }, [])

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="toast-stack">
                {toasts.map((t) => (
                    <div key={t.id} className={`toast toast-${t.type}`}>{t.message}</div>
                ))}
            </div>
        </ToastContext.Provider>
    )
}

export function useToast() {
    const ctx = useContext(ToastContext)
    if (!ctx) throw new Error("useToast must be used within ToastProvider")
    return ctx
}
