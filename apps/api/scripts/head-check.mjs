import { readFileSync } from "node:fs";
import { S3Client, HeadObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const bucket = env.S3_BUCKET || "moracat-media";
const s3 = new S3Client({
  region: env.S3_REGION || "auto",
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
});

const key = process.argv[2];
console.log("bucket:", bucket, "\nendpoint:", env.S3_ENDPOINT, "\nkey:", key);
try {
  const h = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  console.log("✓ HeadObject OK — object EXISTS in", bucket, "size:", h.ContentLength);
} catch (e) {
  console.log("✗ HeadObject:", e.name, "-", e.$metadata?.httpStatusCode);
}
// Also list the user's prefix to see what's actually there.
try {
  const prefix = key.split("/").slice(0, 2).join("/") + "/";
  const l = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, MaxKeys: 10 }));
  console.log(`listing ${prefix}:`, (l.Contents || []).map((o) => o.Key));
} catch (e) {
  console.log("list err:", e.name);
}
