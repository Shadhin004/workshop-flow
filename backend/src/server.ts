import app from './app.js';
import { getEnv } from './config/env.js';

export default app;

// Start standalone HTTP listener for local dev and container/App Service hosting
if (!process.env.VERCEL) {
  const env = getEnv();
  app.listen(env.port, () => {
    console.log(`WorkshopFlow API listening on http://localhost:${env.port}`);
  });
}
