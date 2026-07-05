// One-off R2 connectivity + upload smoke test. Reads creds from the repo-root
// .env.local. Run: node apps/api/scripts/r2-test.mjs
import { readFileSync } from "node:fs";
import {
  S3Client,
  ListBucketsCommand,
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

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

async function main() {
  console.log("Endpoint:", env.S3_ENDPOINT);
  console.log("Bucket  :", bucket);

  // 1) Auth — list buckets (some scoped tokens can't; fall through if so).
  try {
    const list = await s3.send(new ListBucketsCommand({}));
    console.log("✓ Auth OK. Buckets:", (list.Buckets || []).map((b) => b.Name).join(", ") || "(none)");
  } catch (e) {
    console.log("• ListBuckets not permitted by token scope:", e.name);
  }

  // 2) Ensure the bucket exists.
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log("✓ Bucket exists.");
  } catch {
    console.log("• Bucket missing — creating…");
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log("✓ Created bucket:", bucket);
  }

  // 3) Upload a tiny object.
  const key = "cats/_healthcheck/ping.txt";
  await s3.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: "moracat r2 ok", ContentType: "text/plain" })
  );
  console.log("✓ Uploaded:", key);

  // 4) Read it back.
  const got = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = await got.Body.transformToString();
  console.log("✓ Read back:", JSON.stringify(body));

  // 5) Clean up.
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  console.log("✓ Deleted test object.");
  console.log("\nR2 STORAGE OK ✅");
}

main().catch((e) => {
  console.error("R2 TEST FAILED ❌", e.name, "-", e.message);
  process.exit(1);
});
