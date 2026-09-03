import axios from "axios"

/**
 * The tutorial creates a separate axios instance per feature (auth.api.js,
 * interview.api.js) with the same baseURL and withCredentials hardcoded
 * twice. One shared client means one place to change the base URL (env-based
 * here, not hardcoded) and one place to handle cross-cutting concerns like
 * "the session expired" globally instead of duplicating that check in every
 * feature's api file.
 */
const baseURL = import.meta.env.VITE_API_URL

/**
 * Vite bakes env vars in at BUILD time, not runtime. If VITE_API_URL was
 * ever missing/mistyped on the hosting platform (Vercel) for a given
 * deploy, this silently fell back to localhost:3000 — meaning a visitor's
 * browser tries to call *their own* localhost, not the real backend, and
 * the whole app looks broken with no clear reason why. This makes that
 * failure loud and obvious in the deployed site's console instead of
 * silently "working" in a way that only ever succeeds on the developer's
 * own machine. The localhost fallback still applies below, but only ever
 * makes sense in local dev (import.meta.env.DEV) — in a production build
 * it should never be relied on.
 */
if (!baseURL && import.meta.env.PROD) {
    console.error(
        "VITE_API_URL is not set in this production build. API calls will fail. " +
        "Set VITE_API_URL in your hosting platform's environment variables and redeploy."
    )
}

const apiClient = axios.create({
    baseURL: baseURL || "http://localhost:3000/api",
    withCredentials: true
})

apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        const message = error.response?.data?.message || "Something went wrong. Please try again."
        return Promise.reject(new Error(message))
    }
)

export default apiClient
