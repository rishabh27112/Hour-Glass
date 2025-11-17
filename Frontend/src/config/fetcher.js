// Simple helper to build Authorization headers from stored token
export function buildHeaders(extra = {}) {
  try {
    const token = (globalThis.localStorage && localStorage.getItem('token')) || (globalThis.sessionStorage && sessionStorage.getItem('token')) || '';
    const headers = { ...extra };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  } catch (e) {
    return { ...extra };
  }
}

export default buildHeaders;
