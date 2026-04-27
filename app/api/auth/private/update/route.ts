import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { requireAdmin } from '@/lib/auth';
import { DEFAULT_APP_CONFIG, DEFAULT_LAYOUT_SETTINGS } from '@/lib/constants';

export async function PUT(request: Request) {
    try {
        const unauthorized = await requireAdmin();
        if (unauthorized) return unauthorized;

        const body = await request.json();
        const { password } = body;

        if (typeof password !== 'string') {
            return NextResponse.json({ error: 'Invalid password' }, { status: 400 });
        }

        if (password === "") {
            await prisma.globalSettings.upsert({
                where: { id: 1 },
                update: { privatePasswordHash: null },
                create: {
                    id: 1,
                    layout: JSON.stringify(DEFAULT_LAYOUT_SETTINGS),
                    config: JSON.stringify(DEFAULT_APP_CONFIG),
                    theme: JSON.stringify({ isDarkMode: false }),
                    privatePasswordHash: null,
                }
            });

            return NextResponse.json({ success: true });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await prisma.globalSettings.upsert({
            where: { id: 1 },
            update: { privatePasswordHash: hashedPassword },
            create: {
                id: 1,
                layout: JSON.stringify(DEFAULT_LAYOUT_SETTINGS),
                config: JSON.stringify(DEFAULT_APP_CONFIG),
                theme: JSON.stringify({ isDarkMode: false }),
                privatePasswordHash: hashedPassword,
            }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[Private Update] Error:', error);
        return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';
