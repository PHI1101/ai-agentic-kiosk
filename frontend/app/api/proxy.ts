
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // We only want to handle POST requests, reject others
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const backendUrl = `${process.env.NEXT_PUBLIC_API_URL || "https://ai-kiosk-backend-production.up.railway.app/api"}/orders/process-command/`;

  try {
    // Forward the POST request to the Django backend
    const response = await axios.post(backendUrl, req.body, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Forward the response from the backend to the frontend client
    res.status(response.status).json(response.data);

  } catch (error) {
    // Handle errors from the backend request
    if (axios.isAxiosError(error) && error.response) {
      res.status(error.response.status).json(error.response.data);
    } else {
      console.error('Proxy error:', error);
      res.status(500).json({ message: 'An internal server error occurred in the proxy.' });
    }
  }
}
