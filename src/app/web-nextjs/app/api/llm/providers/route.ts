import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const res = await fetch('http://localhost:3001/api/llm/providers');
        const text = await res.text();
        // Attempt JSON parse
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            // If backend returns non-JSON, wrap in error
            console.error('Unexpected response for providers:', text);
            return NextResponse.json({ providers: [] }, { status: 500 });
        }
        return NextResponse.json(data);
    } catch (err) {
        console.error('Error proxying providers:', err);
        return NextResponse.json({ providers: [] }, { status: 500 });
    }
}
