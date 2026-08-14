import apiClient from "../../../lib/apiClient"

export async function sendCopilotMessage(reportId, { message, history }) {
    const { data } = await apiClient.post(`/copilot/${reportId}/message`, { message, history })
    return data
}
