Here is the complete list of all schemas currently generated in your project and the specific pages they are injected on.

Interestingly, I can see that your current project _does_ have a partial implementation of a `@graph` array (using `src/data/schemaConfig.js` and `<SchemaGraph>`), but it's mixed with standalone component injections (`<FaqSchema>`, `<Seo>`).

### 1. The "@graph" Schemas (Using `src/data/schemaConfig.js` + `<SchemaGraph>`)

These pages manually assemble an array and pass it to `<SchemaGraph>`:

- **`src/pages/index.astro`** -> `WebSite`, `MedicalClinic`, `ContactPoint`
- **`src/pages/about-focus-vision.astro`** -> `MedicalClinic`, `WebPage` (AboutPage)
- **`src/pages/contact.astro`** -> `MedicalClinic`, `WebPage` (ContactPage)
- **`src/pages/costs.astro`** -> `WebPage`
- **`src/pages/cataract-surgery.astro`** -> `MedicalClinic`, `WebPage`, `MedicalProcedure`
- **`src/pages/implantable-contact-lens.astro`** -> `MedicalClinic`, `WebPage`, `MedicalProcedure`
- **`src/pages/laser-eye-surgery.astro`** -> `MedicalClinic`, `WebPage`, `MedicalProcedure`
- **`src/pages/laser-for-reading-glasses.astro`** -> `MedicalClinic`, `WebPage`, `MedicalProcedure`
- **`src/pages/pterygium-surgery.astro`** -> `MedicalClinic`, `WebPage`, `MedicalProcedure`
- **`src/pages/ray-tracing-lasik.astro`** -> `MedicalClinic`, `WebPage`, `MedicalProcedure`
- **`src/pages/refractive-lens-exchange.astro`** -> `MedicalClinic`, `WebPage`, `MedicalProcedure`
- **`src/pages/free-refractive-outcomes-analyzer.astro`** -> `MedicalClinic`, `WebPage`

### 2. Standalone Schemas (Injected via Components)

These schemas bypass the `@graph` array and output their own `<script>` tags:

- **`src/components/Seo.astro`**:
  - **Blog Posts (`/blog/[slug]`)** -> Generates `BlogPosting` and `Person` (Author) schemas.
  - **Author Profiles (`/blog/author/[slug]`)** -> Generates detailed `Person` (Identity) schema.
- **`src/components/Schema/FaqSchema.astro`**:
  - **`free-refractive-outcomes-analyzer.astro`** -> Generates `FAQPage` schema.

---

### What the refactor will do:

It will take this scattered structure and unify everything into a single `schema-dts` powered `@graph` payload generated dynamically from `src/utils/seo.ts`.

Are you ready to **toggle to Act mode** so I can install `schema-dts` and begin the refactor?

pre update
