import 'dotenv/config';

// Start all workers by importing them (side-effect: registers Bull processors)
import './ingest/ingestWorker.js';
import './ai/aiWorker.js';
import './clip/clipWorker.js';
import './publish/publishWorker.js';

console.log('[workers] All workers started');

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[workers] SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[workers] SIGINT received, shutting down gracefully...');
  process.exit(0);
});
