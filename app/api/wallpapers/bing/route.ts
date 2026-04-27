import { NextResponse } from 'next/server';
import { fetchAndCacheBingWallpaper } from '@/lib/bing-wallpaper';
import { requireAdmin } from '@/lib/auth';

export async function POST() {
    try {
        const unauthorized = await requireAdmin();
        if (unauthorized) return unauthorized;

        const wallpaper = await fetchAndCacheBingWallpaper();
        if (!wallpaper) {
            return NextResponse.json({ error: 'Failed to fetch Bing wallpaper' }, { status: 500 });
        }
        return NextResponse.json({ success: true, wallpaper });
    } catch (error) {
        return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';
