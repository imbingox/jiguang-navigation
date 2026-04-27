import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { requireAdmin } from '@/lib/auth';

export async function PUT(request: Request) {
    try {
        const unauthorized = await requireAdmin();
        if (unauthorized) return unauthorized;

        const { oldPassword, newPassword } = await request.json();

        if (!oldPassword || !newPassword) {
            return NextResponse.json({ error: 'Missing password' }, { status: 400 });
        }

        if (typeof newPassword !== 'string' || newPassword.trim().length < 6) {
            return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({ where: { username: 'admin' } });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const isValid = await bcrypt.compare(oldPassword, user.passwordHash);
        if (!isValid) {
            return NextResponse.json({ error: 'Invalid old password' }, { status: 401 });
        }

        const newHash = await bcrypt.hash(newPassword.trim(), 10);
        await prisma.user.update({
            where: { username: 'admin' },
            data: { passwordHash: newHash }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to update password' }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';
