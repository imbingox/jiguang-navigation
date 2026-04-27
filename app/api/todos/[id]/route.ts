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
        await prisma.todo.delete({
            where: { id }
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete todo' }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const unauthorized = await requireAdmin();
        if (unauthorized) return unauthorized;

        const { id } = await params;
        const { done } = await request.json();
        const todo = await prisma.todo.update({
            where: { id },
            data: { done }
        });
        return NextResponse.json(todo);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update todo' }, { status: 500 });
    }
}
