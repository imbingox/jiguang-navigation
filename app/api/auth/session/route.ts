import { NextResponse } from 'next/server';
import { getOwnerPasswordConfig, getSession } from '@/lib/auth';

export async function GET() {
    const session = await getSession();
    const passwordConfig = getOwnerPasswordConfig();

    return NextResponse.json({
        authenticated: Boolean(session),
        subject: session?.subject || null,
        passwordConfigured: passwordConfig.configured,
        passwordManagedByEnv: passwordConfig.managedByEnv,
    });
}

export const dynamic = 'force-dynamic';
