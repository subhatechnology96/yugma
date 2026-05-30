import { bootstrapApplication } from '@angular/platform-browser';
import { registerLocaleData } from '@angular/common';
import localeEnIn from '@angular/common/locales/en-IN';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

// Indian number grouping (lakh/crore) for the ₹ formatting used across the CRM module.
registerLocaleData(localeEnIn);

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
