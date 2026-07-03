import fs from "fs";
import path from "path";
import matter from "gray-matter";

const BLOG_DIR = "src/content/blog";
const AUTHORS_JSON = "src/data/authors.json";

// Normalize names to match duplicates like "david gunn" and "Dr david gun"
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .replace(/dr\.?\s+/g, "") // remove Dr or Dr.
    .trim()
    .replace(/\s+/g, "-") // replace spaces with -
    .replace(/[^\w-]+/g, "") // remove non-word chars
    .replace(/--+/g, "-"); // replace multiple - with single -
}

function normalizeName(name) {
  let clean = name.replace(/dr\.?\s+/gi, "").trim();
  // Capitalize words
  return clean
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

const authorsMap = new Map();
const postFiles = [];

// 1. Scan all MDX posts
function scanPosts(dir) {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      scanPosts(filePath);
    } else if (file.endsWith(".mdx")) {
      const content = fs.readFileSync(filePath, "utf8");
      const { data } = matter(content);
      if (data.author) {
        const rawAuthor = data.author;
        const slug = slugify(rawAuthor);
        const normalizedName = normalizeName(rawAuthor);

        if (!authorsMap.has(slug)) {
          authorsMap.set(slug, {
            id: slug,
            name: normalizedName,
            bio: "Expert ophthalmologist at Focus Vision.",
            fullBio: "Full biography coming soon.",
            credentials:
              normalizedName.includes("Gunn") ||
              normalizedName.includes("Cronin")
                ? "MBBS, FRANZCO"
                : "",
            avatar: "",
            social: { facebook: "", instagram: "", linkedin: "", youtube: "" },
            affiliations: [],
          });
        }
        postFiles.push({ filePath, slug });
      }
    }
  });
}

console.log("Scanning posts...");
scanPosts(BLOG_DIR);

// 2. Seed initial authors.json
const authorsList = Array.from(authorsMap.values());
const authorsData = { authors: authorsList };

console.log(`Found ${authorsList.length} unique authors.`);
fs.writeFileSync(AUTHORS_JSON, JSON.stringify(authorsData, null, 2));
console.log(`Seeded ${AUTHORS_JSON}`);

// 3. Update MDX files
console.log("Updating MDX frontmatter...");
postFiles.forEach(({ filePath, slug }) => {
  const content = fs.readFileSync(filePath, "utf8");
  const file = matter(content);
  file.data.author = slug;
  const newContent = matter.stringify(file.content, file.data);
  fs.writeFileSync(filePath, newContent);
});

console.log("Migration complete!");
