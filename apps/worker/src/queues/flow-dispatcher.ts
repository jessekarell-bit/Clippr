import { FlowProducer } from 'bullmq';
import { redisConnection } from './redis-connection.js';
import type { SegmentCompletedJobData } from '@clippr/core';

const flowProducer = new FlowProducer({ connection: redisConnection });

export async function dispatchHighlightAnalysisFlow(data: SegmentCompletedJobData): Promise<void> {
  await flowProducer.add({
    name: 'evaluate-and-clip',
    queueName: 'clip-generation-queue',
    data,
    opts: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 300,
    },
    children: [
      {
        name: 'transcribe-segment',
        queueName: 'clip-generation-queue',
        data,
      },
      {
        name: 'analyze-audio',
        queueName: 'clip-generation-queue',
        data,
      },
      {
        name: 'analyze-chat',
        queueName: 'clip-generation-queue',
        data,
      },
    ],
  });
}
