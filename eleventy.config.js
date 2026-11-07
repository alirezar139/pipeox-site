// Eleventy build config — source in src/, deployable output in dist/
//
// Pages are built as .php files: Eleventy supplies the design (layouts, partials, CSS, icons)
// and PHP fills in the content from the SQLite database at request time, so edits made in
// the admin panel go live immediately without a rebuild. See README-FA.md.
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";
import { exportSeed } from "./scripts/export-seed.mjs";

export default function (eleventyConfig) {
  // ---- Static files copied verbatim ----
  eleventyConfig.addPassthroughCopy("src/assets/fonts");
  eleventyConfig.addPassthroughCopy("src/assets/js");
  eleventyConfig.addPassthroughCopy("src/assets/img");
  eleventyConfig.addPassthroughCopy("src/favicon.svg");
  eleventyConfig.addPassthroughCopy("src/.htaccess");
  eleventyConfig.addPassthroughCopy("src/api"); // PHP backend (includes config.php if present)

  eleventyConfig.addWatchTarget("src/_includes/styles/");
  eleventyConfig.addWatchTarget("seed/");

  eleventyConfig.on("eleventy.before", async () => {
    // Starter content for a fresh database (api/seed/seed.json)
    exportSeed();
    // Social share image (1200×630), generated once from the hero photo
    const out = "dist/assets/img/og.jpg";
    if (fs.existsSync(out)) return;
    fs.mkdirSync("dist/assets/img", { recursive: true });
    await sharp("src/assets/img/home/hero-pipes.jpg").resize(1200, 630, { fit: "cover", position: "left" }).jpeg({ quality: 80 }).toFile(out);
  });

  // ---- Filters ----
  // PHP expression for the web root, relative to the built file: __DIR__ . '/..'
  eleventyConfig.addFilter("phpRoot", (outputPath = "") => {
    const rel = path.relative(path.dirname(outputPath), "dist").replace(/\\/g, "/");
    return rel ? `__DIR__ . '/${rel}'` : "__DIR__";
  });
  // "/about/index.php" → "/about/"
  eleventyConfig.addFilter("cleanUrl", (url = "") => url.replace(/index\.php$/, ""));

  return {
    dir: { input: "src", output: "dist", includes: "_includes", data: "_data" },
    templateFormats: ["njk"],
    htmlTemplateEngine: "njk",
  };
}
