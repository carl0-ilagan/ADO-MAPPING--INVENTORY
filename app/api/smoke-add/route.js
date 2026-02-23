import { NextResponse } from 'next/server';
import { addMapping } from '@/lib/firebaseDB.js';

export async function POST(req) {
  try {
    const body = await req.json();
    if (!body) return NextResponse.json({ error: 'Missing body' }, { status: 400 });

    // Ensure we set canonical region if provided
    const payload = { ...body };
    // Force _ongoing true for smoke tests unless explicitly false
    if (typeof payload._ongoing === 'undefined') payload._ongoing = true;

    const id = await addMapping(payload);
    return NextResponse.json({ ok: true, id }, { status: 200 });
  } catch (err) {
    console.error('smoke-add route error:', err?.message || err);
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
