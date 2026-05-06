import { downloadToBuffer } from '../lib/s3.js';

const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2';

export async function publishToTikTok(opts: {
  convertedS3Key: string;
  title: string;
  accessToken: string;
}): Promise<{ postId: string; postUrl: string }> {
  const { convertedS3Key, title, accessToken } = opts;

  const videoBuffer = await downloadToBuffer(convertedS3Key);

  // Step 1: Initialize video upload
  const initRes = await fetch(`${TIKTOK_API_BASE}/post/publish/video/init/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({
      post_info: {
        title,
        privacy_level: 'PUBLIC_TO_EVERYONE',
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
        video_cover_timestamp_ms: 1000,
      },
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: videoBuffer.length,
        chunk_size: videoBuffer.length,
        total_chunk_count: 1,
      },
    }),
  });

  if (!initRes.ok) {
    throw new Error(
      `TikTok upload init failed: ${initRes.status} ${await initRes.text()}`
    );
  }

  const initData = (await initRes.json()) as {
    data?: { publish_id: string; upload_url: string };
    error?: { code: string; message: string };
  };

  if (initData.error?.code !== 'ok' || !initData.data) {
    throw new Error(`TikTok init error: ${JSON.stringify(initData.error)}`);
  }

  const { publish_id, upload_url } = initData.data;

  // Step 2: Upload video chunk
  const uploadRes = await fetch(upload_url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Range': `bytes 0-${videoBuffer.length - 1}/${videoBuffer.length}`,
      'Content-Length': String(videoBuffer.length),
    },
    body: videoBuffer,
  });

  if (uploadRes.status !== 201 && uploadRes.status !== 200) {
    throw new Error(
      `TikTok chunk upload failed: ${uploadRes.status} ${await uploadRes.text()}`
    );
  }

  // Step 3: Complete upload
  const completeRes = await fetch(`${TIKTOK_API_BASE}/post/publish/status/fetch/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({ publish_id }),
  });

  const completeData = (await completeRes.json()) as {
    data?: { status: string; share_url?: string };
  };

  return {
    postId: publish_id,
    postUrl: completeData.data?.share_url ?? `https://www.tiktok.com/`,
  };
}
