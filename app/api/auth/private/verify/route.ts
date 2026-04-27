import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { verifyOwnerPassword } from '@/lib/auth';

export async function POST(request: Request) {
    try {
        const { password } = await request.json();
        const settings = await prisma.globalSettings.findUnique({ where: { id: 1 } });

        if (!settings?.privatePasswordHash) {
            const result = await verifyOwnerPassword(password);
            return NextResponse.json({ success: result.success });
        }

        const isValid = await bcrypt.compare(password, settings.privatePasswordHash);
        return NextResponse.json({ success: isValid });
    } catch (error) {
        console.error('[Private Verify] Error:', error);
        return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';
