import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { isWeakSessionSecret, setSessionCookie } from '@/lib/auth';

export async function POST(request: Request) {
    try {
        if (isWeakSessionSecret()) {
            return NextResponse.json({ error: 'SESSION_SECRET is required in production' }, { status: 500 });
        }

        const { password } = await request.json();
        const user = await prisma.user.findUnique({ where: { username: 'admin' } });

        if (!user || !password) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        const usesDefaultPassword = await bcrypt.compare('123456', user.passwordHash);
        const response = NextResponse.json({ success: true, mustChangePassword: usesDefaultPassword });
        setSessionCookie(response, user.username);
        return response;
    } catch (error) {
        return NextResponse.json({ error: 'Login failed' }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';
