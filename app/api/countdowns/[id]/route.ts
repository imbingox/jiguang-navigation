import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';


export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const unauthorized = await requireAdmin();
        if (unauthorized) return unauthorized;

        const { id } = await params;
        await prisma.countdown.delete({
            where: { id }
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete countdown' }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';
