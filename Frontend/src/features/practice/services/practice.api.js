import apiClient from "../../../lib/apiClient"

export async function fetchPracticeProgress(reportId) {
    const { data } = await apiClient.get(`/practice/${reportId}`)
    return data
}

export async function submitPracticeAnswer(reportId, payload) {
    const { data } = await apiClient.post(`/practice/${reportId}/answer`, payload)
    return data
}
