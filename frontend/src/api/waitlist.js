import apiClient from "./client";

// Coming-soon product interest capture (real, Brevo/Mongo-backed).
export const waitlistAPI = {
  join: (payload) => apiClient.post("/waitlist", payload),
  count: (product) => apiClient.get("/waitlist/count", { params: { product } }),
};
