import 'dotenv/config';
import { createApp } from './app.js';
import { admin } from './supabase.js';

const port = Number(process.env.PORT) || 4000;
createApp().listen(port, () => {
  console.log(`SRRS API running at http://localhost:${port}/api`);
  if (!admin) console.warn('No SUPABASE_SERVICE_ROLE_KEY set: sign-up and booking-attempt logging are off.');
});
