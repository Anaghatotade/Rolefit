import axios from "axios"

/**
 * The tutorial creates a separate axios instance per feature (auth.api.js,
 * interview.api.js) with the same baseURL and withCredentials hardcoded
 * twice. One shared client means one place to change the base URL (env-based
 * here, not hardcoded) and one place to handle cross-cutting concerns like
 * "the session expired" globally instead of duplicating that check in every
 * feature's api file.
 */
const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000/api",
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
