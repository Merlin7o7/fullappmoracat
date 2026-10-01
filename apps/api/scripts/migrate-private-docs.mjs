#!/usr/bin/env node
/**
 * Move health documents that were stored as PUBLIC objects into private storage.
 *
 * Before the private-document rule, an owner's photographed vaccine card was
 * uploaded through /uploads/image and kept as a public URL in cat_documents.url
 * (and a few early clinic attachments in entry_attachments.file_url). Anyone with
 * the URL could open them. This script:
 *
 *   1. finds rows whose URL points at OUR public storage (S3_PUBLIC_URL or the
 *      API's /uploads route) — third-party links are left untouched,
 *   2. downloads the bytes, content-sniffs them (PDF / JPEG / PNG / WebP),
 *   3. writes them under private/… (S3_PRIVATE_BUCKET when set),
 *   4. rewrites the row to `private:<key>`,
 *   5. deletes the public object ONLY after the private copy reads back intact.
 *
 * Idempotent: rows already `private:` are skipped, so it can be re-run.
 * Dry run by default — pass --apply to write.
 *
 *   DATABASE_URL=… S3_ENDPOINT=… S3_ACCESS_KEY=… S3_SECRET_KEY=… \
 *   S3_BUCKET=moracat-media S3_PRIVATE_BUCKET=moracat-private \
 *   S3_PUBLIC_URL=https://… node apps/api/scripts/migrate-private-docs.mjs --apply
 */
import { randomBytes } from "node:crypto";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { PrismaClient } from "@moraqat/db";

const APPLY = process.argv.includes("--apply");
const env = process.env;
for (const k of ["DATABASE_URL", "S3_ENDPOINT", "S3_ACCESS_KEY", "S3_SECRET_KEY"]) {
  if (!env[k]) {
    console.error(`FATAL: ${k} is not set.`);
    process.exit(1);
  }
}
if (!env.S3_PRIVATE_BUCKET) {
  console.error("FATAL: S3_PRIVATE_BUCKET is not set — create the private bucket first; moving files");
  console.error("       into the public bucket under a new key would protect nothing.");
  process.exit(1);
}

const BUCKET = env.S3_BUCKET || "moracat-media";
const PRIVATE = env.S3_PRIVATE_BUCKET;
const publicBases = [env.S3_PUBLIC_URL, env.API_BASE_URL && `${env.API_BASE_URL.replace(/\/$/, "")}/uploads`]
  .filter(Boolean)
  .map((b) => b.replace(/\/$/, "") + "/");

const endpoint = (() => {
  const u = new URL(env.S3_ENDPOINT.trim());
  return `${u.protocol}//${u.host}`;
})();
const s3 = new S3Client({
  region: env.S3_REGION || "auto",
  endpoint,
  forcePathStyle: true,
  credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
});
const prisma = new PrismaClient();

function sniff(buf) {
  if (buf.subarray(0, 5).toString("ascii") === "%PDF-") return { ext: "pdf", mime: "application/pdf" };
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: "png", mime: "image/png" };
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return { ext: "webp", mime: "image/webp" };
  return null;
}

function publicKey(url) {
  for (const base of publicBases) if (url.startsWith(base)) return url.slice(base.length);
  return null;
}

async function move(url, namespace) {
  const oldKey = publicKey(url);
  if (!oldKey) return { skipped: "not our storage" };
  const res = await fetch(url);
  if (!res.ok) return { skipped: `download ${res.status}` };
  const buf = Buffer.from(await res.arrayBuffer());
  const type = sniff(buf);
  if (!type) return { skipped: "unrecognised file type" };
  const key = `private/${namespace}/${randomBytes(32).toString("hex")}.${type.ext}`;
  if (!APPLY) return { key, oldKey, dry: true };
  await s3.send(new PutObjectCommand({ Bucket: PRIVATE, Key: key, Body: buf, ContentType: type.mime, CacheControl: "private, no-store" }));
  const back = await s3.send(new GetObjectCommand({ Bucket: PRIVATE, Key: key }));
  const bytes = Buffer.from(await back.Body.transformToByteArray());
  if (!bytes.equals(buf)) throw new Error(`read-back mismatch for ${key}`);
  return { key, oldKey };
}

let moved = 0;
let skipped = 0;

const docs = await prisma.catDocument.findMany({ where: { NOT: { url: { startsWith: "private:" } } } });
for (const d of docs) {
  const r = await move(d.url, `cats/${d.catId}/docs`).catch((e) => ({ skipped: e.message }));
  if (r.skipped) { skipped++; console.log(`skip  cat_document ${d.id}: ${r.skipped}`); continue; }
  if (APPLY) {
    await prisma.catDocument.update({ where: { id: d.id }, data: { url: `private:${r.key}` } });
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: r.oldKey })).catch(() => undefined);
  }
  moved++;
  console.log(`${APPLY ? "moved" : "would move"} cat_document ${d.id}`);
}

const atts = await prisma.entryAttachment.findMany({
  where: { NOT: { fileUrl: { startsWith: "private:" } } },
  select: { id: true, fileUrl: true, entry: { select: { orgId: true } } },
});
for (const a of atts) {
  const r = await move(a.fileUrl, `vet/${a.entry.orgId}/entries/legacy`).catch((e) => ({ skipped: e.message }));
  if (r.skipped) { skipped++; console.log(`skip  entry_attachment ${a.id}: ${r.skipped}`); continue; }
  if (APPLY) {
    await prisma.entryAttachment.update({ where: { id: a.id }, data: { fileUrl: `private:${r.key}` } });
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: r.oldKey })).catch(() => undefined);
  }
  moved++;
  console.log(`${APPLY ? "moved" : "would move"} entry_attachment ${a.id}`);
}

console.log(`\n${APPLY ? "Done" : "Dry run"}: ${moved} ${APPLY ? "moved" : "to move"}, ${skipped} skipped.`);
if (!APPLY) console.log("Re-run with --apply to write.");
await prisma.$disconnect();
