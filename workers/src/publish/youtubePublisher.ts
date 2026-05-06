import { downloadToBuffer } from '../lib/s3.js';
import { query } from '../lib/db.js';

const YOUTUBE_UPLOAD_BASE = 'https://www.googleapis.com/upload/youtube/v3';
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

export async function publishToYouTube(opts: {
  clipId: string;
  convertedS3Key: string;
  title: string;
  description: string;
  accessToken: string;
}): Promise<{ videoId: string; videoUrl: string }> {
  const { clipId, convertedS3Key, title, description, accessToken } = opts;

  const videoBuffer = await downloadToBuffer(convertedS3Key);

  // Step 1: Initialize resumable upload session
  const initRes = await fetch(
    `${YOUTUBE_UPLOAD_BASE}/videos?uploadType=resumable&part=snippet,status`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': 'video/mp4',
        'X-Upload-Content-Length': String(videoBuffer.length),
      },
      body: JSON.stringify({
        snippet: {
          title,
          description,
          categoryId: '22', // People & Blogs
          defaultLanguage: 'en',
        },
        status: {
          privacyStatus: 'public',
          selfDeclaredMadeForKids: false,
        },
      }),
    }
  );

  if (!initRes.ok) {
    throw new Error(
      `YouTube upload init failed: ${initRes.status} ${await initRes.text()}`
    );
  }

  const uploadUrl = initRes.headers.get('Location');
  if (!uploadUrl) {
    throw new Error('YouTube did not return an upload URL');
  }

  // Step 2: Upload video bytes
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(videoBuffer.length),
    },
    body: videoBuffer,
  });

  if (!uploadRes.ok && uploadRes.status !== 308) {
    throw new Error(
      `YouTube upload failed: ${uploadRes.status} ${await uploadRes.text()}`
    );
  }

  const uploadData = (await uploadRes.json()) as { id?: string };
  const videoId = uploadData.id;

  if (!videoId) {
    throw new Error('YouTube upload completed but no video ID returned');
  }

  return {
    videoId,
    videoUrl: `https://www.youtube.com/shorts/${videoId}`,
  };
}
