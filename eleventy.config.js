// Eleventy build config — source in src/, deployable output in dist/
export default function (eleventyConfig) {
  // Copied verbatim to dist/
  eleventyConfig.addPassthroughCopy("src/assets/img");
  eleventyConfig.addPassthroughCopy("src/assets/fonts");
  eleventyConfig.addPassthroughCopy("src/assets/js");
  eleventyConfig.addPassthroughCopy("src/.htaccess");

  // Rebuild when CSS partials change (they live in _includes, which is watched for templates only)
  eleventyConfig.addWatchTarget("src/_includes/styles/");

  eleventyConfig.addFilter("year", () => new Date().getFullYear());

  // tel: links need digits only (keeps a leading +)
  eleventyConfig.addFilter("telHref", (value = "") => value.replace(/[^\d+]/g, ""));

  return {
    dir: { input: "src", output: "dist", includes: "_includes", data: "_data" },
    templateFormats: ["njk", "md", "html"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
}
