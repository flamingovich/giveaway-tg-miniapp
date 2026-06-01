import { bootstrap } from './server.js';

bootstrap().catch((e) => {
  console.error(e);
  process.exit(1);
});
