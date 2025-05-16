import { NextResponse } from 'next/server';

/**
 * Proxies a GET request to retrieve the current agent configuration from the backend API.
 *
 * @returns The agent configuration as a JSON response, or an error message with status 500 if the backend request fails.
 */
export async function GET() {
    try {
        const res = await fetch('http://localhost:3001/api/config', { cache: 'no-store' });
        const data = await res.json();
        return NextResponse.json(data);
    } catch (err) {
        console.error('Error proxying GET /api/config:', err);
        return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
    }
}

/**
 * Proxies a POST request to the backend API to update the agent configuration.
 *
 * Forwards the incoming JSON request body to the backend `/api/config` endpoint and returns the backend's JSON response with its status code.
 *
 * @param request - The incoming HTTP request containing the JSON body to forward.
 * @returns A JSON response with the backend's response data and status code, or a 500 error if the proxying fails.
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const res = await fetch('http://localhost:3001/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        return NextResponse.json(data, { status: res.status });
    } catch (err) {
        console.error('Error proxying POST /api/config:', err);
        return NextResponse.json({ error: 'Failed to update config' }, { status: 500 });
    }
}
