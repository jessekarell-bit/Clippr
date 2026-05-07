import { startWorkers } from './workers.js';

startWorkers().catch((error) => {
  console.error('Worker bootstrap failed', error);
  process.exit(1);
});
