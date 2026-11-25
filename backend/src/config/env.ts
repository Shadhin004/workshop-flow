import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '../..');

export interface EnvConfig {
  port: number;
  nodeEnv: string;
  databasePath: string;
  corsOrigin: string | boolean;
}

export function getEnv(): EnvConfig {
  const port = Number(process.env.PORT || 3000);
  const isVercel = Boolean(process.env.VERCEL);

  return {
    port: Number.isFinite(port) && port > 0 ? port : 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    databasePath:
      process.env.DATABASE_PATH ||
      (isVercel
        ? '/tmp/workshop-flow.db'
        : path.join(backendRoot, 'data', 'workshop-flow.db')),
    corsOrigin:
      process.env.CORS_ORIGIN || (isVercel ? true : 'http://localhost:4200'),
  };
}
