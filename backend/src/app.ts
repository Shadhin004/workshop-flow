import { getEnv } from './config/env.js';
import { createApp } from './create-app.js';
import { createDatabase } from './db/database.js';
import { seedDatabase } from './db/seed.js';

export { createApp, type AppOptions } from './create-app.js';

const env = getEnv();
const db = createDatabase(env.databasePath);
const seeded = seedDatabase(db);

if (seeded) {
  console.log('Seeded WorkshopFlow database with furniture workshop data.');
}

const app = createApp({
  db,
  corsOrigin: env.corsOrigin,
});

export default app;
