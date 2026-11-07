// Eleventy build config — source in src/, deployable output in dist/
import { eleventyImageTransformPlugin } from "@11ty/eleventy-img";
import sharp from "sharp";
import fs from "node:fs";

export default function (eleventyConfig) {
  // ---- Static files copied verbatim ----
  eleventyConfig.addPassthroughCopy("src/assets/fonts");
  eleventyConfig.addPassthroughCopy("src/assets/js");
  eleventyConfig.addPassthroughCopy("src/assets/img/industrial-hero.webp"); // CSS background, not an <img>
  eleventyConfig.addPassthroughCopy("src/favicon.svg");
  eleventyConfig.addPassthroughCopy("src/.htaccess");
  eleventyConfig.addPassthroughCopy("src/api"); // PHP backend (includes config.php if present)

  eleventyConfig.addWatchTarget("src/_includes/styles/");

  // ---- Images: every <img> becomes a responsive <picture> (WebP + JPEG) with width/height ----
  eleventyConfig.addPlugin(eleventyImageTransformPlugin, {
    formats: ["webp", "jpeg"],
    widths: [480, 960, 1600],
    urlPath: "/assets/img/opt/",
    outputDir: "./dist/assets/img/opt/",
    htmlOptions: {
      imgAttributes: { loading: "lazy", decoding: "async", sizes: "(max-width: 700px) 100vw, 50vw" },
    },
    sharpJpegOptions: { quality: 78, mozjpeg: true },
    sharpWebpOptions: { quality: 75 },
  });

  // ---- Social share image (1200×630), generated once from the hero photo ----
  eleventyConfig.on("eleventy.before", async () => {
    const out = "dist/assets/img/og.jpg";
    if (fs.existsSync(out)) return;
    fs.mkdirSync("dist/assets/img", { recursive: true });
    await sharp("src/assets/img/industrial-hero.webp").resize(1200, 630, { fit: "cover", position: "left" }).jpeg({ quality: 80 }).toFile(out);
  });

  // ---- Filters ----
  eleventyConfig.addFilter("year", () => new Date().getFullYear());
  eleventyConfig.addFilter("telHref", (value = "") => value.replace(/[^\d+]/g, ""));
  eleventyConfig.addFilter("head", (arr = [], n) => arr.slice(0, n));
  eleventyConfig.addFilter("isoDate", (d) => new Date(d).toISOString().slice(0, 10));
  // Solar Hijri date with Persian digits, e.g. «۲۱ مهر ۱۴۰۵»
  eleventyConfig.addFilter("faDate", (d) =>
    new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Tehran" }).format(new Date(d)),
  );
  eleventyConfig.addFilter("faNum", (n) => new Intl.NumberFormat("fa-IR").format(n));
  eleventyConfig.addFilter("readingTime", (html = "") => {
    const words = html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    return new Intl.NumberFormat("fa-IR").format(Math.max(1, Math.round(words / 200)));
  });
  eleventyConfig.addFilter("breadcrumbJsonLd", (crumbs, base) => ({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.label, item: base + c.url })),
  }));

  return {
    dir: { input: "src", output: "dist", includes: "_includes", data: "_data" },
    templateFormats: ["njk", "md", "html"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
}
