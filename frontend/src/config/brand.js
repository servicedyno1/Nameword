export const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL;

export const withSupportEmail = (text) => String(text).replace("{email}", SUPPORT_EMAIL);
