export interface SegmentCompletedEvent {
  streamId: string;
  segmentPath: string;
  fileName: string;
  createdAt: string;
}

export interface HighlightDetectedEvent {
  streamId: string;
  segmentPath: string;
  score: number;
  startSeconds: number;
  endSeconds: number;
}
