export type Platform = 'YOUTUBE' | 'TIKTOK' | 'INSTAGRAM';

export interface SegmentCompletedJobData {
  streamId: string;
  segmentPath: string;
  fileName: string;
  channelId: string;
}

export interface EvaluateAndClipJobData extends SegmentCompletedJobData {
  transcriptJobKey: string;
  audioJobKey: string;
  chatJobKey: string;
}

export interface PublishClipJobData {
  clipId: string;
  userId: string;
  s3Url: string;
  title: string;
  description?: string;
  targetPlatforms: Platform[];
  scheduledAt?: string;
}
