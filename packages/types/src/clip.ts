export type ClipStatus = 'pending' | 'processing' | 'ready' | 'rejected' | 'published';

export interface Clip {
  id: string;
  streamId: string;
  userId: string;
  title: string | null;
  status: ClipStatus;
  startOffsetSecs: number;
  endOffsetSecs: number;
  durationSecs: number;
  rawS3Key: string | null;
  convertedS3Key: string | null;
  thumbnailS3Key: string | null;
  subtitlesSrt: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClipScore {
  id: string;
  clipId: string;
  overallScore: number;
  audioPeakScore: number | null;
  chatActivityScore: number | null;
  transcriptScore: number | null;
  engagementHistoryScore: number | null;
  scoreMetadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface HighlightWindow {
  startOffsetSecs: number;
  endOffsetSecs: number;
  audioPeakScore: number;
  chatActivityScore: number;
  transcriptScore: number;
  overallScore: number;
  triggerKeywords: string[];
}

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
  confidence: number;
}

export interface Transcription {
  id: string;
  streamId: string;
  segmentIndex: number | null;
  text: string;
  words: WordTimestamp[] | null;
  startedAt: Date;
  endedAt: Date;
  createdAt: Date;
}

export type PublicationStatus = 'queued' | 'uploading' | 'published' | 'failed';
export type Platform = 'youtube' | 'tiktok' | 'instagram';

export interface Publication {
  id: string;
  clipId: string;
  platformAccountId: string;
  platform: Platform;
  status: PublicationStatus;
  platformPostId: string | null;
  platformPostUrl: string | null;
  scheduledFor: Date | null;
  publishedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}
