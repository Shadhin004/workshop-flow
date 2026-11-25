import { ApplicationConfig, provideZoneChangeDetection, provideAppInitializer } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { injectSpeedInsights } from '@vercel/speed-insights';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(),
    provideAppInitializer(() => {
      injectSpeedInsights({ framework: 'angular' });
    }),
  ],
};
