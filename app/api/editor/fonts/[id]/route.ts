import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth';


export async function DELETE(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const unauthorized = await requireAdmin();
        if (unauthorized) return unauthorized;

        const params = await props.params;
        const id = params.id;
        await prisma.customFont.delete({
            where: { id }
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete font' }, { status: 500 });
    }
}
