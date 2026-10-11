import 'dotenv/config';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 4000);
createApp().listen(port, () => {
  console.log(`EcoProof API listening on :${port}`);
});
