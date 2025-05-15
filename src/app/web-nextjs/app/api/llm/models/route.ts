import { NextResponse } from 'next/server';

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const provider = url.searchParams.get('provider') || '';
        const res = await fetch(
            `http://localhost:3001/api/llm/models?provider=${encodeURIComponent(provider)}`
        );
        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            console.error('Unexpected response for models:', text);
            return NextResponse.json({ models: [] }, { status: 500 });
        }
        return NextResponse.json(data);
    } catch (err) {
        console.error('Error proxying models:', err);
        return NextResponse.json({ models: [] }, { status: 500 });
    }
}
