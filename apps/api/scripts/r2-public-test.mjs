// Verify R2 PUBLIC read access end-to-end: upload via S3, fetch over the public
// r2.dev URL, then clean up. Run: node apps/api/scripts/r2-public-test.mjs
import { readFileSync } from "node:fs";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}

const bucket = env.S3_BUCKET || "moracat-media";
const publicBase = (env.S3_PUBLIC_URL || "").replace(/\/$/, "");
const s3 = new S3Client({
  region: env.S3_REGION || "auto",
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
});

const key = "cats/_healthcheck/public-ping.txt";
const marker = "moracat public ok";

async function main() {
  await s3.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: marker, ContentType: "text/plain" })
  );
  const url = `${publicBase}/${key}`;
  console.log("Uploaded, fetching public URL:", url);

  // r2.dev can take a moment to propagate a brand-new object; retry briefly.
  let ok = false;
  for (let i = 0; i < 5; i++) {
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) {
      const body = (await res.text()).trim();
      console.log(`✓ HTTP ${res.status}, body: ${JSON.stringify(body)}`);
      ok = body === marker;
      break;
    }
    console.log(`• attempt ${i + 1}: HTTP ${res.status} — retrying…`);
    await new Promise((r) => setTimeout(r, 1500));
  }

  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  console.log("✓ Cleaned up test object.");
  console.log(ok ? "\nR2 PUBLIC ACCESS OK ✅" : "\nPUBLIC FETCH FAILED ❌");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error("PUBLIC TEST ERROR ❌", e.name, "-", e.message);
  process.exit(1);
});
