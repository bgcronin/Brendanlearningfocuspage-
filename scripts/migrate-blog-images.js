import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const contentDir = path.join(__dirname, "../src/content/blog");
const assetsDir = path.join(__dirname, "../src/assets/images/blog");

const isDryRun = process.argv.includes("--dry-run");

if (isDryRun) {
  console.log("DRY RUN MODE - No files will be changed.\n");
}

function migrateImages() {
  if (!fs.existsSync(contentDir)) {
    console.error(`Content directory not found: ${contentDir}`);
    return;
  }

  const posts = fs
    .readdirSync(contentDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  for (const postSlug of posts) {
    const postDir = path.join(contentDir, postSlug);
    const postImagesDir = path.join(postDir, "images");
    const mdxPath = path.join(postDir, "index.mdx");

    // Check if post has images
    if (fs.existsSync(postImagesDir)) {
      const targetImagesDir = path.join(assetsDir, postSlug);

      if (!fs.existsSync(targetImagesDir)) {
        if (isDryRun) {
          console.log(`[DIR] Would create directory: ${targetImagesDir}`);
        } else {
          fs.mkdirSync(targetImagesDir, { recursive: true });
        }
      }

      const images = fs.readdirSync(postImagesDir);

      for (const image of images) {
        const sourcePath = path.join(postImagesDir, image);
        const targetPath = path.join(targetImagesDir, image);

        if (!fs.existsSync(targetPath)) {
          if (isDryRun) {
            console.log(`[COPY] Would copy: ${sourcePath} -> ${targetPath}`);
          } else {
            fs.copyFileSync(sourcePath, targetPath);
          }
        } else {
          if (isDryRun) {
            console.log(`[SKIP] Image already exists: ${targetPath}`);
          }
        }
      }
    }

    // Update MDX file
    if (fs.existsSync(mdxPath)) {
      let content = fs.readFileSync(mdxPath, "utf-8");
      let originalContent = content;

      // Update paths: ./images/ to ../../../assets/images/blog/<postSlug>/
      // Cover image in frontmatter
      content = content.replace(
        /coverImage:\s*(?:\.\/)?images\//g,
        `coverImage: ../../../assets/images/blog/${postSlug}/`,
      );

      // Inline images
      content = content.replace(
        /\]\((?:\.\/)?images\//g,
        `](../../../assets/images/blog/${postSlug}/`,
      );
      content = content.replace(
        /src=["'](?:\.\/)?images\//g,
        `src="../../../assets/images/blog/${postSlug}/`,
      );

      if (content !== originalContent) {
        if (isDryRun) {
          console.log(`[UPDATE] Would update image paths in: ${mdxPath}`);
        } else {
          fs.writeFileSync(mdxPath, content, "utf-8");
        }
      }
    }
  }
}

migrateImages();
if (isDryRun) {
  console.log("\nDry run complete.");
} else {
  console.log("\nMigration complete.");
}
