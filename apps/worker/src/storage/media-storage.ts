import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'node:fs';

const s3 = new S3Client({
  region: process.env.S3_REGION,
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  credentials:
    process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
      ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY }
      : undefined,
});

export async function uploadMedia(localPath: string, objectKey: string): Promise<string> {
  const body = fs.createReadStream(localPath);
  const bucket = process.env.S3_BUCKET;
  if (!bucket) {
    throw new Error('Missing S3_BUCKET environment variable');
  }

  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: objectKey, Body: body, ContentType: 'video/mp4' }));

  const baseUrl = process.env.S3_PUBLIC_BASE_URL;
  return baseUrl ? `${baseUrl}/${objectKey}` : `s3://${bucket}/${objectKey}`;
}
