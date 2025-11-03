const axios = require('axios');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const backendUrl = `https://ai-kiosk-backend-production.up.railway.app/api/orders/process-command/`;

  try {
    const response = await axios.post(backendUrl, req.body, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    const axiosError = error as import('axios').AxiosError;
    if (axiosError.response) {
      res.status(axiosError.response.status).json(axiosError.response.data);
    } else {
      console.error('Proxy error:', error);
      res.status(500).json({ message: 'An internal server error occurred in the proxy.' });
    }
  }
};
