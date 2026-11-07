// Cuts the photographic artwork out of the approved homepage mockup (design/mockup-home.png)
// so the live site uses exactly the same imagery. Text, buttons and forms stay real HTML.
// Run: node scripts/extract-mockup-assets.mjs
import sharp from "sharp";

const SRC = "design/mockup-home.png";
const OUT = "src/assets/img/home/";
const SCALE = 2; // upscale for sharper rendering on large / HiDPI screens

const crop = (left, top, width, height) => sharp(SRC).extract({ left, top, width, height });

async function save(pipeline, name, w, h) {
  await pipeline
    .resize(w * SCALE, h * SCALE, { kernel: "lanczos3" })
    .sharpen({ sigma: 0.8, m1: 0.6, m2: 1.2 })
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(OUT + name);
  console.log("✓", name);
}

// Replace the top band (where the header UI is baked in) with the mirrored strip beneath it,
// feathered at the bottom so there is no visible seam. The live header sits on top anyway.
async function patchTopBand(buf, width, height, feather = 18) {
  const strip = await sharp(buf).extract({ left: 0, top: height, width, height }).flip().blur(1.5).toBuffer();
  const mask = Buffer.from(
    `<svg width="${width}" height="${height}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="${1 - feather / height}" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient></defs>` +
      `<rect width="100%" height="100%" fill="url(#g)"/></svg>`,
  );
  const withAlpha = await sharp(strip).joinChannel(await sharp(mask).greyscale().raw().toBuffer(), { raw: { width, height, channels: 1 } }).png().toBuffer();
  return sharp(buf).composite([{ input: withAlpha, left: 0, top: 0 }]).toBuffer();
}

import { mkdirSync } from "node:fs";
mkdirSync(OUT, { recursive: true });

// 1) Hero photo — left part of the hero, without the header button/search/nav baked into it
let hero = await crop(0, 0, 745, 428).png().toBuffer();
hero = await patchTopBand(hero, 745, 70); // CTA pill, search box and nav tail
await save(sharp(hero), "hero-pipes.jpg", 745, 428);

// 2) Product orbit — platform, rings and product renders (labels are overlaid in HTML)
await save(crop(320, 430, 860, 298), "orbit-art.jpg", 860, 298);

// 3) Projects tile image (includes the play badge from the design)
await save(crop(50, 748, 327, 129), "projects.jpg", 327, 129);

// 4) News tile thumbnail
await save(crop(1371, 788, 104, 92), "news.jpg", 104, 92);
