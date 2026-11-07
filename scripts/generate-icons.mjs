#!/usr/bin/env node
/**
 * Generates every favicon / PWA icon from the single brand source
 * `public/brand/logo.png` (1536×1024, emblem centered on a black canvas):
 *
 *   src/app/icon.png             512×512 (Next app-icon convention)
 *   src/app/apple-icon.png       180×180 (iOS home screen)
 *   src/app/favicon.ico          true multi-size ICO (16/32/48, PNG-encoded)
 *   public/icons/icon-{192,512}.png           purpose "any"
 *   public/icons/icon-maskable-{192,512}.png  purpose "maskable"
 *
 * The emblem already sits well inside the maskable safe zone (central ~80%),
 * so one square crop serves every purpose. Outputs are committed; rerun via
 * `node scripts/generate-icons.mjs` only when the brand asset changes.
 */
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "public", "brand", "logo.png");

// Center square crop: the 1536×1024 source's emblem is centered at x≈768.
const CROP = { left: 256, top: 0, width: 1024, height: 1024 };

/** Classic ICO container wrapping PNG-encoded entries (all modern browsers). */
function buildIco(pngBuffers) {
  const headerSize = 6 + 16 * pngBuffers.length;
  let offset = headerSize;
  const chunks = [];
  let directory = Buffer.alloc(16 * pngBuffers.length);

  pngBuffers.forEach((entry, i) => {
    const size = entry.data.length;
    // width/height byte 0 == 256
    directory.writeUInt8(entry.size >= 256 ? 0 : entry.size, i * 16 + 0);
    directory.writeUInt8(entry.size >= 256 ? 0 : entry.size, i * 16 + 1);
    directory.writeUInt8(0, i * 16 + 2); // palette
    directory.writeUInt8(0, i * 16 + 3); // reserved
    directory.writeUInt16LE(1, i * 16 + 4); // color planes
    directory.writeUInt16LE(32, i * 16 + 6); // bits per pixel
    directory.writeUInt32LE(size, i * 16 + 8);
    directory.writeUInt32LE(offset, i * 16 + 12);
    offset += size;
    chunks.push(entry.data);
  });

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngBuffers.length, 4); // count
  return Buffer.concat([header, directory, ...chunks]);
}

async function squareOf(size) {
  return sharp(source)
    .extract(CROP)
    .resize(size, size, { kernel: "lanczos3" })
    .png()
    .toBuffer();
}

const [icon512, apple180, fav16, fav32, fav48, icon192, maskable192, maskable512] =
  await Promise.all([
    squareOf(512),
    squareOf(180),
    squareOf(16),
    squareOf(32),
    squareOf(48),
    squareOf(192),
    squareOf(192),
    squareOf(512),
  ]);

await mkdir(join(root, "public", "icons"), { recursive: true });
await writeFile(join(root, "src", "app", "icon.png"), icon512);
await writeFile(join(root, "src", "app", "apple-icon.png"), apple180);
await writeFile(
  join(root, "src", "app", "favicon.ico"),
  buildIco([
    { size: 16, data: fav16 },
    { size: 32, data: fav32 },
    { size: 48, data: fav48 },
  ]),
);
await writeFile(join(root, "public", "icons", "icon-192.png"), icon192);
await writeFile(join(root, "public", "icons", "icon-512.png"), icon512);
await writeFile(join(root, "public", "icons", "icon-maskable-192.png"), maskable192);
await writeFile(join(root, "public", "icons", "icon-maskable-512.png"), maskable512);

console.log("[generate-icons] 7 png assets + favicon.ico (16/32/48) written");
