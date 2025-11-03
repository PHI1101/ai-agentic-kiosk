import { NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: Request) {
  const backendUrl = `https://ai-kiosk-backend-production.up.railway.app/api/orders/process-command/`;

  try {
    const reqBody = await request.json(); // Get the request body

    const response = await axios.post(backendUrl, reqBody, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return NextResponse.json(response.data, { status: response.status });
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response) {
      return NextResponse.json(error.response.data, { status: error.response.status });
    } else {
      console.error('Proxy error:', error);
      return NextResponse.json({ message: 'An internal server error occurred in the proxy.' }, { status: 500 });
    }
  }
}
