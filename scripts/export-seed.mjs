// Builds src/api/seed/seed.json — the content a fresh database starts with.
// After the first run on the server, the database (edited in the admin panel) is the source of truth.
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import markdownIt from "markdown-it";

const read = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const md = markdownIt({ html: true });
const img = (name) => (!name ? "" : name.startsWith("/") ? name : `/assets/img/${name}`);

export function exportSeed() {
  const site = read("src/_data/site.json");
  const { _note, ...home } = read("seed/home.json");
  const products = read("seed/products.json").map((p) => ({ ...p, image: img(p.image) }));
  const projects = read("seed/projects.json").map((p) => ({ ...p, image: img(p.image) }));
  const dir = "seed/insights";
  const articles = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const { data, content } = matter(fs.readFileSync(path.join(dir, f), "utf8"));
      return {
        slug: f.replace(/\.md$/, ""),
        title: data.title,
        description: data.description || "",
        category: data.category || "",
        image: img(data.image),
        imageAlt: data.imageAlt || "",
        cover: data.cover !== false,
        date: new Date(data.date).toISOString().slice(0, 10),
        body: md.render(content),
      };
    });
  const settings = {
    site: { name: site.name, nameFa: site.nameFa, url: site.url, title: site.title, description: site.description },
    contact: site.contact,
    ...home,
  };
  fs.mkdirSync("src/api/seed", { recursive: true });
  fs.writeFileSync("src/api/seed/seed.json", JSON.stringify({ settings, products, articles, projects }, null, 1));
  fs.writeFileSync("src/api/seed/.htaccess", "Require all denied\n");
}

if (process.argv[1]?.endsWith("export-seed.mjs")) exportSeed();
