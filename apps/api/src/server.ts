import { createApp } from './app.js';
import { config } from './config.js';

createApp().listen(config.PORT, () => {
  console.log(`EcoProof API listening on :${config.PORT}`);
});
