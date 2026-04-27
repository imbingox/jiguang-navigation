import { mkdirSync } from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const defaultDatabaseUrl = 'file:./data/dev.db';
const databaseUrl = process.env.DATABASE_URL || defaultDatabaseUrl;

if (!databaseUrl.startsWith('file:')) {
  console.error(`[db:ensure] Unsupported DATABASE_URL: ${databaseUrl}`);
  process.exit(1);
}

const rawPath = databaseUrl.slice('file:'.length);
const dbPath = path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);

mkdirSync(path.dirname(dbPath), { recursive: true });

const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const result = spawnSync(
  npxCommand,
  ['prisma', 'db', 'push'],
  {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
  }
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
