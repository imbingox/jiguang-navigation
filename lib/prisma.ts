import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 as PrismaBetterSqlite } from '@prisma/adapter-better-sqlite3'
import path from 'path'
import process from 'process'
import { pathToFileURL, fileURLToPath } from 'url'
import fs from 'fs'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

const DEFAULT_DATABASE_URL = 'file:data/dev.db'

function resolveDatabaseUrl() {
    let dbUrl = process.env.DATABASE_URL || DEFAULT_DATABASE_URL

    if (!dbUrl.startsWith('file:///')) {
        let dbPath = dbUrl.startsWith('file:') ? dbUrl.slice(5) : dbUrl

        if (!path.isAbsolute(dbPath)) {
            dbPath = path.resolve(process.cwd(), dbPath)
        }

        fs.mkdirSync(path.dirname(dbPath), { recursive: true })
        dbUrl = pathToFileURL(dbPath).href
        process.env.DATABASE_URL = dbUrl
    }

    return dbUrl
}

const dbPath = fileURLToPath(resolveDatabaseUrl())

export const prisma = globalForPrisma.prisma || (() => {
    const adapter = new PrismaBetterSqlite({ url: dbPath })

    return new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development' ? ['query'] : [],
    })
})()

if (!globalForPrisma.prisma) {
    prisma.$executeRawUnsafe('PRAGMA journal_mode = WAL;')
        .catch((e) => {
            console.error('Failed to enable WAL', e)
        })
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
