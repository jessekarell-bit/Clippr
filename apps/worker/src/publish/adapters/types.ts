export interface PublishInput {
  accessToken: string;
  videoUrl: string;
  title: string;
  description?: string;
}

export interface PublishResult {
  platformPostId: string;
  raw: unknown;
}
