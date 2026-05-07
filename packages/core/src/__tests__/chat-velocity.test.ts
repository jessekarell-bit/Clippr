import { describe, expect, it } from 'vitest';
import type { PublishClipJobData } from '../contracts/jobs.js';

describe('shared contracts', () => {
  it('accepts publish payload shape', () => {
    const payload: PublishClipJobData = {
      clipId: 'clip-1',
      userId: 'user-1',
      s3Url: 'https://cdn.example.com/video.mp4',
      title: 'Highlight',
      targetPlatforms: ['YOUTUBE', 'TIKTOK'],
    };

    expect(payload.targetPlatforms.length).toBe(2);
  });
});
