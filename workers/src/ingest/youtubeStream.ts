import { spawn } from 'child_process';
import { query, queryOne } from '../lib/db.js';
import { recordChatActivity } from '../lib/redis.js';
import type { YouTubeBroadcastStatus } from '@clippr/types';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

// Resolves the HLS manifest URL from a YouTube video URL using yt-dlp.
// yt-dlp is the most reliable way to get live HLS manifests — the Data API
// does not expose them directly for user streams.
export async function resolveHLSViaYtDlp(videoUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('yt-dlp', [
      '--no-playlist',
      '-g',
      '--format', 'best[ext=ts]/best',
      videoUrl,
    ]);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`yt-dlp failed (code ${code}): ${stderr.trim()}`));
        return;
      }
      const urls = stdout.trim().split('\n').filter(Boolean);
      const m3u8 = urls.find((u) => u.includes('.m3u8') || u.includes('manifest'));
      const url = m3u8 ?? urls[0];
      if (!url) {
        reject(new Error('yt-dlp returned no URLs'));
        return;
      }
      resolve(url.trim());
    });
  });
}

export async function getLiveBroadcastStatus(
  broadcastId: string,
  accessToken: string
): Promise<YouTubeBroadcastStatus> {
  const url = `${YOUTUBE_API_BASE}/liveBroadcasts?part=status&id=${encodeURIComponent(broadcastId)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`YouTube liveBroadcasts API error: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as {
    items?: Array<{ status: { lifeCycleStatus: string } }>;
  };

  const status = data.items?.[0]?.status?.lifeCycleStatus;
  return (status as YouTubeBroadcastStatus) ?? 'complete';
}

export async function getLiveChatId(
  broadcastId: string,
  accessToken: string
): Promise<string | null> {
  const url = `${YOUTUBE_API_BASE}/liveBroadcasts?part=snippet&id=${encodeURIComponent(broadcastId)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    items?: Array<{ snippet: { liveChatId: string } }>;
  };

  return data.items?.[0]?.snippet?.liveChatId ?? null;
}

interface YouTubeChatMessage {
  id: string;
  snippet: {
    displayMessage: string;
    publishedAt: string;
    superChatDetails?: { amountMicros: string };
    type: string;
  };
  authorDetails: { displayName: string };
}

interface ChatPollResult {
  nextPageToken: string | null;
  pollingIntervalMillis: number;
  messages: YouTubeChatMessage[];
}

async function fetchChatPage(
  liveChatId: string,
  accessToken: string,
  pageToken?: string
): Promise<ChatPollResult> {
  const params = new URLSearchParams({
    liveChatId,
    part: 'snippet,authorDetails',
    maxResults: '200',
  });
  if (pageToken) params.set('pageToken', pageToken);

  const res = await fetch(`${YOUTUBE_API_BASE}/liveChat/messages?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`YouTube Live Chat API error: ${res.status}`);
  }

  const data = (await res.json()) as {
    nextPageToken?: string;
    pollingIntervalMillis?: number;
    items?: YouTubeChatMessage[];
  };

  return {
    nextPageToken: data.nextPageToken ?? null,
    pollingIntervalMillis: data.pollingIntervalMillis ?? 5000,
    messages: data.items ?? [],
  };
}

export async function pollLiveChat(opts: {
  streamId: string;
  liveChatId: string;
  accessToken: string;
  shouldStop: () => boolean;
}): Promise<void> {
  const { streamId, liveChatId, accessToken, shouldStop } = opts;
  let pageToken: string | undefined;
  let windowStart = Math.floor(Date.now() / 1000 / 30) * 30; // 30s bucket start
  let windowMessageCount = 0;

  while (!shouldStop()) {
    try {
      const result = await fetchChatPage(liveChatId, accessToken, pageToken);
      pageToken = result.nextPageToken ?? undefined;

      if (result.messages.length > 0) {
        // Batch insert new messages
        for (const msg of result.messages) {
          const isSuperchat = msg.snippet.type === 'superChatEvent';
          const amountMicros = isSuperchat
            ? BigInt(msg.snippet.superChatDetails?.amountMicros ?? '0')
            : null;

          await query(
            `INSERT INTO chat_messages
               (stream_id, youtube_msg_id, author_name, message_text, published_at, is_superchat, superchat_amount_micros)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (youtube_msg_id) DO NOTHING`,
            [
              streamId,
              msg.id,
              msg.authorDetails.displayName,
              msg.snippet.displayMessage,
              msg.snippet.publishedAt,
              isSuperchat,
              amountMicros,
            ]
          );

          // Track messages per 30s window
          const msgTime = Math.floor(new Date(msg.snippet.publishedAt).getTime() / 1000);
          const msgWindow = Math.floor(msgTime / 30) * 30;
          if (msgWindow !== windowStart) {
            if (windowMessageCount > 0) {
              await recordChatActivity(streamId, windowStart, windowMessageCount);
            }
            windowStart = msgWindow;
            windowMessageCount = 0;
          }
          windowMessageCount++;
        }
      }

      await sleep(result.pollingIntervalMillis);
    } catch (err) {
      console.error('[pollLiveChat] error:', err);
      await sleep(5000);
    }
  }

  // Flush final window
  if (windowMessageCount > 0) {
    await recordChatActivity(streamId, windowStart, windowMessageCount);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
