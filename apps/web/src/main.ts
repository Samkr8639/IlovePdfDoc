import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .then(() => {
    (window as any).__pt_app_bootstrapped = true;
  })
  .catch((err) => console.error(err));
