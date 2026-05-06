import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import type { Readable } from 'stream';

export const s3 = new S3Client({
  region: process.env.AWS_REGION ?? 'us-east-1',
});

const BUCKET = process.env.S3_BUCKET_NAME ?? 'clippr-media';

export async function uploadBuffer(
  key: string,
  data: Buffer,
  contentType = 'application/octet-stream'
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: data,
      ContentType: contentType,
    })
  );
}

export async function downloadToBuffer(key: string): Promise<Buffer> {
  const response = await s3.send(
    new GetObjectCommand({ Bucket: BUCKET, Key: key })
  );
  const stream = response.Body as Readable;
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

export function segmentS3Key(streamId: string, segmentIndex: number): string {
  return `segments/${streamId}/${String(segmentIndex).padStart(6, '0')}.ts`;
}

export { BUCKET };
