import { downloadToBuffer, uploadBuffer, BUCKET } from '../lib/s3.js';

const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function publishToInstagram(opts: {
  convertedS3Key: string;
  title: string;
  accessToken: string;
  instagramUserId: string;
  // Public HTTPS URL to the video — Instagram requires a publicly accessible URL
  publicVideoUrl: string;
}): Promise<{ postId: string; postUrl: string }> {
  const { title, accessToken, instagramUserId, publicVideoUrl } = opts;

  // Step 1: Create media container
  const createRes = await fetch(
    `${GRAPH_API_BASE}/${instagramUserId}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        media_type: 'REELS',
        video_url: publicVideoUrl,
        caption: title,
        share_to_feed: true,
        access_token: accessToken,
      }),
    }
  );

  if (!createRes.ok) {
    throw new Error(
      `Instagram media container creation failed: ${createRes.status} ${await createRes.text()}`
    );
  }

  const createData = (await createRes.json()) as { id?: string };
  const containerId = createData.id;
  if (!containerId) {
    throw new Error('Instagram did not return a container ID');
  }

  // Step 2: Poll container status until FINISHED
  let status = '';
  let attempts = 0;
  while (status !== 'FINISHED' && attempts < 30) {
    await sleep(5000);
    attempts++;

    const statusRes = await fetch(
      `${GRAPH_API_BASE}/${containerId}?fields=status_code&access_token=${accessToken}`
    );
    const statusData = (await statusRes.json()) as { status_code?: string };
    status = statusData.status_code ?? '';

    if (status === 'ERROR') {
      throw new Error(`Instagram media processing failed for container ${containerId}`);
    }
  }

  if (status !== 'FINISHED') {
    throw new Error(`Instagram media did not finish processing after ${attempts} polls`);
  }

  // Step 3: Publish the container
  const publishRes = await fetch(
    `${GRAPH_API_BASE}/${instagramUserId}/media_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: containerId,
        access_token: accessToken,
      }),
    }
  );

  if (!publishRes.ok) {
    throw new Error(
      `Instagram publish failed: ${publishRes.status} ${await publishRes.text()}`
    );
  }

  const publishData = (await publishRes.json()) as { id?: string };
  const postId = publishData.id ?? containerId;

  return {
    postId,
    postUrl: `https://www.instagram.com/reel/${postId}/`,
  };
}
