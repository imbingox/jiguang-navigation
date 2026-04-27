import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const SESSION_COOKIE = 'aurora_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

let cachedSessionSecret: string | null = null;

function getSessionSecretFile() {
    if (process.env.SESSION_SECRET_FILE) return process.env.SESSION_SECRET_FILE;

    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl?.startsWith('file:')) {
        const rawPath = dbUrl.slice('file:'.length);
        const dbPath = rawPath.startsWith('/') ? rawPath : path.resolve(process.cwd(), rawPath);
        return path.join(path.dirname(dbPath), 'session.secret');
    }

    return path.join(process.cwd(), 'data', 'session.secret');
}

function getSessionSecret() {
    if (process.env.SESSION_SECRET || process.env.AUTH_SECRET) {
        return process.env.SESSION_SECRET || process.env.AUTH_SECRET || '';
    }

    if (cachedSessionSecret) return cachedSessionSecret;

    try {
        const sessionSecretFile = getSessionSecretFile();

        if (fs.existsSync(sessionSecretFile)) {
            const existingSecret = fs.readFileSync(sessionSecretFile, 'utf8').trim();
            if (existingSecret) {
                cachedSessionSecret = existingSecret;
                return cachedSessionSecret;
            }
        }

        const generatedSecret = crypto.randomBytes(32).toString('base64url');
        fs.mkdirSync(path.dirname(sessionSecretFile), { recursive: true });
        fs.writeFileSync(sessionSecretFile, `${generatedSecret}\n`, { mode: 0o600 });
        cachedSessionSecret = generatedSecret;
        return cachedSessionSecret;
    } catch (error) {
        if (process.env.NODE_ENV === 'production') {
            console.error('Failed to initialize session secret:', error);
        }

        cachedSessionSecret = crypto.randomBytes(32).toString('base64url');
        return cachedSessionSecret;
    }
}

function sign(value: string) {
    return crypto.createHmac('sha256', getSessionSecret()).update(value).digest('base64url');
}

export function isWeakSessionSecret() {
    const envSecret = process.env.SESSION_SECRET || process.env.AUTH_SECRET;
    return process.env.NODE_ENV === 'production' && Boolean(envSecret) && envSecret === 'change-me-in-production';
}

export function createSessionValue(username: string) {
    const payload = Buffer.from(JSON.stringify({ username, iat: Date.now() })).toString('base64url');
    return `${payload}.${sign(payload)}`;
}

export function verifySessionValue(value?: string) {
    if (!value) return null;
    const [payload, signature] = value.split('.');
    if (!payload || !signature || signature !== sign(payload)) return null;

    try {
        const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { username?: string; iat?: number };
        if (!data.username || !data.iat) return null;
        if (Date.now() - data.iat > SESSION_MAX_AGE * 1000) return null;
        return { username: data.username };
    } catch {
        return null;
    }
}

export async function getSession() {
    const cookieStore = await cookies();
    return verifySessionValue(cookieStore.get(SESSION_COOKIE)?.value);
}

export async function isAuthenticated() {
    return Boolean(await getSession());
}

export async function requireAdmin() {
    if (await isAuthenticated()) return null;
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export function setSessionCookie(response: NextResponse, username: string) {
    response.cookies.set({
        name: SESSION_COOKIE,
        value: createSessionValue(username),
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: SESSION_MAX_AGE,
    });
}

export function clearSessionCookie(response: NextResponse) {
    response.cookies.set({
        name: SESSION_COOKIE,
        value: '',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 0,
    });
}
