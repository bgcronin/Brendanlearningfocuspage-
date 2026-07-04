// @ts-check
import { defineConfig, fontProviders } from "astro/config";
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

import sitemap from "@astrojs/sitemap";

import mdx from "@astrojs/mdx";
import rehypeFigureTitle from "rehype-figure-title";

import netlify from "@astrojs/netlify";

import react from "@astrojs/react";
import markdoc from "@astrojs/markdoc";
import keystatic from "@keystatic/astro";

// import markdoc from "@astrojs/markdoc";

// https://astro.build/config
export default defineConfig({
  markdown: {
    rehypePlugins: [rehypeFigureTitle],
  },

  build: {
    // Inline styles generated from .astro components into the HTML
    inlineStylesheets: "always", // 'auto' | 'always' | 'never'
  },

  experimental: {
    fonts: [
      {
        provider: fontProviders.google(),
        name: "Poppins",
        cssVariable: "--font-poppins",
        display: "swap",
        weights: [300, 400, 500, 600, 700],
        styles: ["normal", "italic"],
      },
    ],
  },

  site: "https://www.focusvision.com.au",

  integrations: [
    sitemap({
      filter: (page) => !page.includes("/blog/tag/"),
      // Static tool served from public/ — not an Astro route, so it must be
      // added to the sitemap explicitly.
      customPages: [
        "https://www.focusvision.com.au/refractive-outcomes-analyzer/",
      ],
      serialize(item) {
        if (item.url.includes("/blog/")) {
          // Extract slug from URL - handles trailing slashes
          const slug = item.url.split("/blog/")[1].split("/")[0];
          if (slug) {
            try {
              let filePath = `./src/content/blog/${slug}.mdx`;
              if (!fs.existsSync(filePath)) {
                filePath = `./src/content/blog/${slug}/index.mdx`;
              }
              const fileContent = fs.readFileSync(filePath, "utf8");
              // Robust regex to match both datePublished and dateModified
              const modMatch = fileContent.match(
                /dateModified:\s*["']?([^"'\n]+)["']?/,
              );
              const pubMatch = fileContent.match(
                /datePublished:\s*["']?([^"'\n]+)["']?/,
              );

              const dateStr = modMatch?.[1] || pubMatch?.[1];
              if (dateStr) {
                item.lastmod = new Date(dateStr).toISOString();
              }
            } catch (e) {
              // Fallback to Git if file read fails
            }
          }
        }

        // Git Fallback for all pages if lastmod is not set
        if (!item.lastmod) {
          try {
            const { execSync } = require("child_process");
            // Map URL path to file path (rough estimation for static pages)
            let relativePath = item.url.replace(
              "https://www.focusvision.com.au/",
              "",
            );
            // Remove trailing slash if present
            relativePath = relativePath.replace(/\/$/, "");
            if (!relativePath || relativePath === "") relativePath = "index";

            // Check potential .astro or .mdx locations
            const pathsToTry = [
              `src/pages/${relativePath}.astro`,
              `src/pages/${relativePath}/index.astro`,
              `src/content/${relativePath}.mdx`,
              `src/content/${relativePath}/index.mdx`,
            ];

            for (const p of pathsToTry) {
              if (fs.existsSync(p)) {
                const gitDate = execSync(`git log -1 --format=%aI -- "${p}"`)
                  .toString()
                  .trim();
                if (gitDate) {
                  item.lastmod = gitDate;
                  break;
                }
              }
            }
          } catch (e) {
            // Silence git errors
          }
        }
        return item;
      },
    }),
    mdx({
      rehypePlugins: [rehypeFigureTitle],
    }),
    react(),
    markdoc(),
    keystatic(),
  ],
  output: "static",

  adapter: netlify({ imageCDN: true }),
  image: {
    domains: ["i.ytimg.com"],
    // Set global defaults
    service: {
      entrypoint: "astro/assets/services/sharp", // default, uses Sharp
      config: {
        format: "webp", // 👈 All non-SVG images output as WebP
        quality: 70, // Compression level
      },
    },
  },
  vite: {
    optimizeDeps: {
      exclude: ["@keystatic/astro"],
    },
    server: {
      fs: {
        // Allow serving files from one level up to the project root
        allow: [".."],
      },
    },
  },
});
