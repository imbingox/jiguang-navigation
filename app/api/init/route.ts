import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkDatabaseConsistency } from '@/lib/db-consistency';
import { getOwnerPasswordConfig } from '@/lib/auth';

let consistencyCheckDone = false;

export async function GET() {
    try {
        if (!consistencyCheckDone) {
            await checkDatabaseConsistency(true);
            consistencyCheckDone = true;
        }

        const [sites, categories, settings] = await Promise.all([
            prisma.site.findMany({ orderBy: { order: 'asc' } }),
            prisma.category.findMany({ orderBy: { order: 'asc' } }),
            prisma.globalSettings.findUnique({ where: { id: 1 } })
        ]);

        const parsedSettings = settings ? {
            layout: JSON.parse(settings.layout),
            config: JSON.parse(settings.config),
            theme: JSON.parse(settings.theme),
            searchEngine: settings.searchEngine
        } : null;

        if (parsedSettings && parsedSettings.layout && parsedSettings.layout.bgType === 'bing') {
            const latestBing = await prisma.wallpaper.findFirst({
                where: { type: 'bing' },
                orderBy: { createdAt: 'desc' }
            });
            if (latestBing) {
                parsedSettings.layout.bgUrl = latestBing.url;
            }
        }

        return NextResponse.json({
            sites,
            categories,
            settings: parsedSettings,
            authConfigured: getOwnerPasswordConfig().configured,
        });
    } catch (error) {
        console.error('[Init API] Error:', error);
        return NextResponse.json({ error: 'Failed to fetch initial data' }, { status: 500 });
    }
}

export const dynamic = 'force-dynamic';
