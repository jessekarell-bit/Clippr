import type { PublishInput, PublishResult } from './types.js';

export async function publishInstagramReel(input: PublishInput, igUserId: string): Promise<PublishResult> {
  const createRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      media_type: 'REELS',
      video_url: input.videoUrl,
      caption: `${input.title}\n\n${input.description ?? ''}`,
      access_token: input.accessToken,
    }),
  });

  if (!createRes.ok) {
    throw new Error(`Instagram container create failed: ${createRes.status}`);
  }

  const container = await createRes.json();
  const containerId = container.id as string;

  const publishRes = await fetch(`https://graph.facebook.com/v21.0/${igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ creation_id: containerId, access_token: input.accessToken }),
  });

  if (!publishRes.ok) {
    throw new Error(`Instagram publish failed: ${publishRes.status}`);
  }

  const published = await publishRes.json();
  return { platformPostId: published.id ?? containerId, raw: published };
}
