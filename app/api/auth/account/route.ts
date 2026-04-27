import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { requireAdmin } from '@/lib/auth';

export async function PUT(request: Request) {
    try {
        const unauthorized = await requireAdmin();
        if (unauthorized) return unauthorized;

        const { currentPassword, newPassword } = await request.json();

        if (!currentPassword || !newPassword) {
            return NextResponse.json({ error: 'Missing password' }, { status: 400 });
        }

        if (typeof newPassword !== 'string' || newPassword.trim().length < 6) {
            return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
        }

        // 1. Find User
        const user = await prisma.user.findUnique({
            where: { username: 'admin' }
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // 2. Verify Current Password
        const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isValid) {
            return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
        }

        // 3. Prepare Updates
        // 3. Update password only. The public UI uses a single admin password.
        const updatedUser = await prisma.user.update({
            where: { username: 'admin' },
            data: { passwordHash: await bcrypt.hash(newPassword.trim(), 10) }
        });

        return NextResponse.json({
            success: true,
            username: updatedUser.username,
            passwordChanged: true
        });

    } catch (error) {
        console.error('Account update error:', error);
        return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';
