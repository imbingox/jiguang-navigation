import { NextResponse } from 'next/server';
import { requireAdmin, updateOwnerPassword } from '@/lib/auth';

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

        const result = await updateOwnerPassword(currentPassword, newPassword);

        if (!result.success) {
            if (result.reason === 'missing') {
                return NextResponse.json({
                    error: '未配置编辑密码。请先设置 OWNER_PASSWORD 环境变量并重启。'
                }, { status: 503 });
            }

            if (result.reason === 'managed-by-env') {
                return NextResponse.json({
                    error: '当前编辑密码由环境变量管理，不能在页面里修改。'
                }, { status: 400 });
            }

            if (result.reason === 'invalid-current-password') {
                return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
            }
        }

        return NextResponse.json({
            success: true,
            passwordChanged: true,
        });
    } catch (error) {
        console.error('Account update error:', error);
        return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';
