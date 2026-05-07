import { google } from 'googleapis';
import type { PublishInput, PublishResult } from './types.js';

export async function publishYouTubeShort(input: PublishInput): Promise<PublishResult> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: input.accessToken });

  const youtube = google.youtube({ version: 'v3', auth });
  const response = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: { title: input.title, description: input.description },
      status: { privacyStatus: 'private' },
    },
    media: { body: input.videoUrl as any },
  });

  return { platformPostId: response.data.id ?? 'unknown', raw: response.data };
}
