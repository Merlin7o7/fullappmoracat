import { readFileSync } from "node:fs";
import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const bucket = env.S3_BUCKET;
const clean = env.S3_ENDPOINT.replace(/\/+$/, "");
const creds = { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY };
const mk = (endpoint) => new S3Client({ region: "auto", endpoint, forcePathStyle: true, credentials: creds });

const key = "_repro/endpoint-test.txt";

async function tryVariant(label, endpoint) {
  console.log(`\n--- writing with endpoint: ${JSON.stringify(endpoint)} (${label}) ---`);
  try {
    await mk(endpoint).send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: "repro", ContentType: "text/plain" }));
    console.log("  put: OK");
  } catch (e) {
    console.log("  put FAILED:", e.name);
    return;
  }
  // read back with the CLEAN endpoint
  try {
    await mk(clean).send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    console.log("  clean-endpoint HeadObject: FOUND");
  } catch (e) {
    console.log("  clean-endpoint HeadObject: NOT FOUND (" + e.name + ")");
  }
  // public URL
  const url = `${env.S3_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
  const r = await fetch(url).catch(() => ({ status: "err" }));
  console.log("  public fetch:", r.status);
}

await tryVariant("clean (control)", clean);
await tryVariant("trailing slash", clean + "/");
