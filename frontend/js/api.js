const API_URL = 'https://quiz-f2u1.onrender.com/api';

const request = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(`${API_URL}${endpoint}`, config);

    // 🔥 SAFE JSON PARSE
    const text = await response.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error("Server returned invalid response (not JSON)");
    }

    if (!response.ok) {
      throw new Error(data.message || 'Something went wrong');
    }

    return data;

  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};