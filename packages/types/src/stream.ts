export type StreamStatus = 'pending' | 'ingesting' | 'completed' | 'failed';

export interface Stream {
  id: string;
  userId: string;
  youtubeStreamId: string;
  youtubeVideoId: string | null;
  title: string | null;
  status: StreamStatus;
  hlsManifestUrl: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StreamSegment {
  id: string;
  streamId: string;
  segmentIndex: number;
  s3Key: string;
  durationSecs: number;
  startedAt: Date;
  createdAt: Date;
}

export interface HLSSegment {
  index: number;
  uri: string;
  durationSecs: number;
  startedAt: Date;
}

export interface ChatMessage {
  id: string;
  streamId: string;
  youtubeMsgId: string;
  authorName: string | null;
  messageText: string | null;
  publishedAt: Date;
  isSuperchat: boolean;
  superchatAmountMicros: bigint | null;
}

export type YouTubeBroadcastStatus = 'created' | 'ready' | 'live' | 'complete' | 'revoked';
