import Bull from 'bull';
import { QUEUE_NAMES } from '@clippr/config';
import type {
  IngestJobPayload,
  AIJobPayload,
  ClipJobPayload,
  PublishJobPayload,
} from '@clippr/types';

const redisOptions = {
  redis: process.env.REDIS_URL ?? 'redis://localhost:6379',
};

// Reuse queues across hot reloads in development
declare global {
  // eslint-disable-next-line no-var
  var _bullQueues:
    | {
        ingest: Bull.Queue<IngestJobPayload>;
        ai: Bull.Queue<AIJobPayload>;
        clip: Bull.Queue<ClipJobPayload>;
        publish: Bull.Queue<PublishJobPayload>;
      }
    | undefined;
}

function createQueues() {
  return {
    ingest: new Bull<IngestJobPayload>(QUEUE_NAMES.INGEST, redisOptions),
    ai: new Bull<AIJobPayload>(QUEUE_NAMES.AI, redisOptions),
    clip: new Bull<ClipJobPayload>(QUEUE_NAMES.CLIP, redisOptions),
    publish: new Bull<PublishJobPayload>(QUEUE_NAMES.PUBLISH, redisOptions),
  };
}

const queues =
  process.env.NODE_ENV === 'production'
    ? createQueues()
    : (globalThis._bullQueues ??= createQueues());

export const ingestQueue = queues.ingest;
export const aiQueue = queues.ai;
export const clipQueue = queues.clip;
export const publishQueue = queues.publish;
