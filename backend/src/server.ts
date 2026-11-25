import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import app from './app.js';
import { getEnv } from './config/env.js';

export default app;

// Start standalone HTTP listener for local dev and container/App Service hosting
if (!process.env.VERCEL) {
  const env = getEnv();
  const staticDir = path.resolve(__dirname, '../../frontend/dist/frontend/browser');
  if (fs.existsSync(staticDir)) {
    app.use(express.static(staticDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  }

  app.listen(env.port, () => {
    console.log(`WorkshopFlow API listening on http://localhost:${env.port}`);
  });
}
