import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const s3 = new S3Client({
  region: process.env.AWS_REGION ?? 'us-east-1',
  credentials:
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined,
});

const BUCKET = process.env.S3_BUCKET_NAME ?? 'clippr-media';

export function segmentS3Key(streamId: string, segmentIndex: number): string {
  return `segments/${streamId}/${String(segmentIndex).padStart(6, '0')}.ts`;
}

export function rawClipS3Key(clipId: string): string {
  return `clips/${clipId}/raw.mp4`;
}

export function convertedClipS3Key(clipId: string): string {
  return `clips/${clipId}/converted.mp4`;
}

export function thumbnailS3Key(clipId: string): string {
  return `clips/${clipId}/thumbnail.jpg`;
}

export async function uploadBuffer(
  key: string,
  data: Buffer,
  contentType = 'application/octet-stream'
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: data,
      ContentType: contentType,
    })
  );
  return key;
}

export async function getSignedDownloadUrl(
  key: string,
  expiresInSeconds = 3600
): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn: expiresInSeconds }
  );
}

export { BUCKET };
