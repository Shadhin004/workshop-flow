import { createApp } from './app.js';
import { getEnv } from './config/env.js';
import { createDatabase } from './db/database.js';
import { seedDatabase } from './db/seed.js';

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

app.listen(env.port, () => {
  console.log(`WorkshopFlow API listening on http://localhost:${env.port}`);
});
