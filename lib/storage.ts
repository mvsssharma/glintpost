import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomBytes } from "crypto";
import path from "path";

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.S3_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

export async function uploadToStorage(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  const ext = path.extname(filename) || ".bin";
  const key = `uploads/${randomBytes(16).toString("hex")}${ext}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000",
    })
  );

  return `${process.env.S3_PUBLIC_URL}/${key}`;
}
