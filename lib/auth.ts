import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const SESSION_COOKIE = 'aurora_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const SESSION_SUBJECT = 'owner';
const DEFAULT_DATABASE_URL = 'file:data/dev.db';

let cachedSessionSecret: string | null = null;

function getDatabaseFilePath() {
    const dbUrl = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;

    if (dbUrl.startsWith('file:///')) {
        return fileURLToPath(dbUrl);
    }

    if (dbUrl.startsWith('file:')) {
        const rawPath = dbUrl.slice('file:'.length);
        return path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);
    }

    return path.resolve(process.cwd(), 'data', 'dev.db');
}

function getDataDirectory() {
    return path.dirname(getDatabaseFilePath());
}

function getSessionSecretFile() {
    if (process.env.SESSION_SECRET_FILE) return process.env.SESSION_SECRET_FILE;
    return path.join(getDataDirectory(), 'session.secret');
}

function getOwnerPasswordFile() {
    if (process.env.OWNER_PASSWORD_FILE) return process.env.OWNER_PASSWORD_FILE;
    return path.join(getDataDirectory(), 'owner.password');
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

function readPasswordFile(filePath: string) {
    if (!fs.existsSync(filePath)) return null;
    const hash = fs.readFileSync(filePath, 'utf8').trim();
    return hash || null;
}

function writePasswordFile(filePath: string, passwordHash: string) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${passwordHash}\n`, { mode: 0o600 });
}

function bootstrapOwnerPassword() {
    const bootstrapPassword = process.env.OWNER_PASSWORD?.trim();
    if (!bootstrapPassword) return null;

    const filePath = getOwnerPasswordFile();
    const passwordHash = bcrypt.hashSync(bootstrapPassword, 10);
    writePasswordFile(filePath, passwordHash);

    return {
        hash: passwordHash,
        managedByEnv: false,
        filePath,
    };
}

function getLegacyOwnerPassword() {
    const dbPath = getDatabaseFilePath();
    if (!fs.existsSync(dbPath)) return null;

    let db: Database.Database | null = null;

    try {
        db = new Database(dbPath, { readonly: true, fileMustExist: true });
        const userTable = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'User'").get();
        if (!userTable) return null;

        const row = db.prepare<{ username: string }, { passwordHash?: string }>(
            'SELECT passwordHash FROM User WHERE username = @username LIMIT 1'
        ).get({ username: 'admin' });
        const legacyHash = row?.passwordHash?.trim();
        if (!legacyHash) return null;

        const filePath = getOwnerPasswordFile();
        writePasswordFile(filePath, legacyHash);

        return {
            hash: legacyHash,
            managedByEnv: false,
            filePath,
        };
    } catch (error) {
        console.error('Failed to migrate legacy owner password:', error);
        return null;
    } finally {
        db?.close();
    }
}

function getOwnerPasswordState() {
    const envHash = process.env.OWNER_PASSWORD_HASH?.trim();
    if (envHash) {
        return {
            hash: envHash,
            managedByEnv: true,
            filePath: null as string | null,
        };
    }

    const filePath = getOwnerPasswordFile();
    const storedHash = readPasswordFile(filePath);
    if (storedHash) {
        return {
            hash: storedHash,
            managedByEnv: false,
            filePath,
        };
    }

    return getLegacyOwnerPassword() || bootstrapOwnerPassword();
}

function sign(value: string) {
    return crypto.createHmac('sha256', getSessionSecret()).update(value).digest('base64url');
}

export function isWeakSessionSecret() {
    const envSecret = process.env.SESSION_SECRET || process.env.AUTH_SECRET;
    return process.env.NODE_ENV === 'production' && Boolean(envSecret) && envSecret === 'change-me-in-production';
}

export function getOwnerPasswordConfig() {
    const state = getOwnerPasswordState();

    return {
        configured: Boolean(state),
        managedByEnv: Boolean(state?.managedByEnv),
    };
}

export async function verifyOwnerPassword(password: string) {
    const state = getOwnerPasswordState();

    if (!state) {
        return { success: false, reason: 'missing' as const };
    }

    const success = await bcrypt.compare(password, state.hash);
    const reason = success ? null : 'invalid';
    return {
        success,
        reason,
    };
}

export async function updateOwnerPassword(currentPassword: string, newPassword: string) {
    const state = getOwnerPasswordState();

    if (!state) {
        return { success: false, reason: 'missing' as const };
    }

    if (state.managedByEnv || !state.filePath) {
        return { success: false, reason: 'managed-by-env' as const };
    }

    const isValid = await bcrypt.compare(currentPassword, state.hash);
    if (!isValid) {
        return { success: false, reason: 'invalid-current-password' as const };
    }

    const passwordHash = await bcrypt.hash(newPassword.trim(), 10);
    writePasswordFile(state.filePath, passwordHash);

    return { success: true, reason: null };
}

export function createSessionValue(subject: string = SESSION_SUBJECT) {
    const payload = Buffer.from(JSON.stringify({ subject, iat: Date.now() })).toString('base64url');
    return `${payload}.${sign(payload)}`;
}

export function verifySessionValue(value?: string) {
    if (!value) return null;
    const [payload, signature] = value.split('.');
    if (!payload || !signature || signature !== sign(payload)) return null;

    try {
        const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { subject?: string; iat?: number };
        if (!data.subject || !data.iat) return null;
        if (Date.now() - data.iat > SESSION_MAX_AGE * 1000) return null;
        return { subject: data.subject };
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

export function setSessionCookie(response: NextResponse, subject: string = SESSION_SUBJECT) {
    response.cookies.set({
        name: SESSION_COOKIE,
        value: createSessionValue(subject),
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
