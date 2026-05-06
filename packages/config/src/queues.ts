export const QUEUE_NAMES = {
  INGEST: 'stream-ingest',
  AI: 'ai-processing',
  CLIP: 'clip-generation',
  PUBLISH: 'clip-publishing',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
