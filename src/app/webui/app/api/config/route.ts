import { NextResponse } from 'next/server';

// Proxy GET request to backend API for fetching current agent config
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

// Proxy POST request to backend API for updating agent config
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
