import apiClient from "./client";

// Private brand-guide access check (email allowlist on the backend).
export const brandAPI = {
  access: async () => {
    const res = await apiClient.get("/brand/access");
    return res.data?.data || { allowed: false };
  },
};
