// API Configuration
// Use environment variable if available, otherwise use production URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 
  (process.env.NODE_ENV === 'production' 
    ? 'https://hour-glass-1.onrender.com' 
    : 'http://localhost:4000');

export default API_BASE_URL;
