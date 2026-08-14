import Protected from "../features/auth/components/Protected"
import AppShell from "./AppShell"

export default function AuthenticatedLayout({ children }) {
    return (
        <Protected>
            <AppShell>{children}</AppShell>
        </Protected>
    )
}
