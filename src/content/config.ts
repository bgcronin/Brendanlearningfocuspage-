import { defineCollection, z } from "astro:content";

const blogCollection = defineCollection({
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string().optional(),
      author: z.string().default("primary-slug"),
      category: z.string().optional(),
      datePublished: z.coerce.date(),
      dateModified: z.coerce.date().optional(),

      // This is the line you need to add
      tags: z.array(z.string()).optional(),

      // Revert to standard image schema to avoid path manipulation issues
      coverImage: image().optional(),

      faqs: z
        .array(
          z.object({
            question: z.string(),
            answer: z.string(),
          }),
        )
        .optional(),
    }),
});

const authorsCollection = defineCollection({
  schema: ({ image }) =>
    z.object({
      name: z.string(),
      bio: z.string().optional(),
      credentials: z.string().optional(),
      ahpraNumber: z.string().optional(),
      medicalSpecialty: z.string().optional(),
      avatar: z.string().or(image()).optional(),
      social: z
        .object({
          facebook: z.string().optional(),
          instagram: z.string().optional(),
          linkedin: z.string().optional(),
          youtube: z.string().optional(),
        })
        .optional()
        .default({}),
      affiliations: z
        .array(
          z.object({
            name: z.string(),
            url: z.string(),
          }),
        )
        .optional()
        .default([]),
      alumniOf: z
        .array(
          z.object({
            name: z.string(),
            url: z.string(),
          }),
        )
        .optional()
        .default([]),
    }),
});

export const collections = { blog: blogCollection, authors: authorsCollection };
