export interface IngestJobPayload {
  streamId: string;
  youtubeStreamId: string;
  youtubeVideoId: string;
  userId: string;
  liveChatId?: string;
}

export interface AIJobPayload {
  streamId: string;
  segmentIndex: number;
  s3Key: string;
  segmentStartedAt: string;
  segmentDurationSecs: number;
}

export interface ClipJobPayload {
  clipId: string;
  streamId: string;
  startOffsetSecs: number;
  endOffsetSecs: number;
}

export interface PublishJobPayload {
  publicationId: string;
  clipId: string;
  platform: 'youtube' | 'tiktok' | 'instagram';
  platformAccountId: string;
}
