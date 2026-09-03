import apiClient from "../../../lib/apiClient"

export async function fetchAdminOverview() {
    const { data } = await apiClient.get("/admin/overview")
    return data
}
