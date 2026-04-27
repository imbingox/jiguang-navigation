import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';

export async function PUT(request: Request) {
    try {
        const unauthorized = await requireAdmin();
        if (unauthorized) return unauthorized;

        return NextResponse.json({ error: 'Username login is no longer supported' }, { status: 410 });

    } catch (error) {
        console.error('Change username error:', error);
        return NextResponse.json({ error: 'Failed to update username' }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';
