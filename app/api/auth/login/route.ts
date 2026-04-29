import { NextResponse } from 'next/server';
import { getOwnerPasswordConfig, setSessionCookie, verifyOwnerPassword } from '@/lib/auth';

export async function POST(request: Request) {
    try {
        const { password } = await request.json();

        if (!password || typeof password !== 'string') {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        const config = getOwnerPasswordConfig();
        if (!config.configured) {
            return NextResponse.json({
                error: '未配置编辑密码。请设置 OWNER_PASSWORD 环境变量后重启应用。'
            }, { status: 503 });
        }

        const result = await verifyOwnerPassword(password);
        if (!result.success) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        const response = NextResponse.json({ success: true, passwordManagedByEnv: config.managedByEnv });
        setSessionCookie(response, undefined, request);
        return response;
    } catch {
        return NextResponse.json({ error: 'Login failed' }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';
