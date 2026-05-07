import type { PublishInput, PublishResult } from './types.js';

export async function publishTikTokVideo(input: PublishInput): Promise<PublishResult> {
  const response = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({
      post_info: {
        title: input.title,
        privacy_level: 'SELF_ONLY',
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
      },
      source_info: { source: 'PULL_FROM_URL', video_url: input.videoUrl },
    }),
  });

  if (!response.ok) {
    throw new Error(`TikTok publish init failed: ${response.status}`);
  }

  const body = await response.json();
  return { platformPostId: body?.data?.publish_id ?? 'unknown', raw: body };
}
