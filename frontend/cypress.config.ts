import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5174',
    supportFile: false,
    video: false,
  },
  env: {
    FIREBASE_TOKEN: process.env.CYPRESS_FIREBASE_TOKEN || '',
  },
});


