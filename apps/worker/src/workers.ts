import { Worker } from 'bullmq';
import { redisConnection } from './queues/redis-connection.js';
import { clipGenerationProcessor } from './queues/clip-generation.worker.js';
import { publishProcessor } from './publish/publish-worker.js';
import { log } from './observability/logger.js';

export async function startWorkers(): Promise<void> {
  new Worker('clip-generation-queue', clipGenerationProcessor, { connection: redisConnection });
  new Worker('social-publication-queue', publishProcessor, { connection: redisConnection });
  log('info', 'Workers are listening');
}
