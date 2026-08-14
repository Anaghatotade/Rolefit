import apiClient from "../../../lib/apiClient"

export async function createReport({ jobDescription, selfDescription, resumeFile }) {
    const formData = new FormData()
    formData.append("jobDescription", jobDescription)
    formData.append("selfDescription", selfDescription)
    formData.append("resume", resumeFile)

    const { data } = await apiClient.post("/reports", formData, {
        headers: { "Content-Type": "multipart/form-data" }
    })
    return data
}

export async function fetchReports() {
    const { data } = await apiClient.get("/reports")
    return data
}

export async function fetchReportById(id) {
    const { data } = await apiClient.get(`/reports/${id}`)
    return data
}

export async function downloadTailoredResume(id) {
    const response = await apiClient.post(`/reports/${id}/resume-pdf`, null, {
        responseType: "blob"
    })
    return response.data
}
