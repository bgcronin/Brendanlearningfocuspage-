- focusvision.com.au Add ImageObject for logo

Schema Checks

Home:

- no ImageObject

Treatments

- Two faq pages (the same)
- Now has MedicalWebPage with lastReviewed
- Has SurgicalProcedure in MedicalWebPage and it's the same.

Cost: - Now has breadcrumbs - Now has MedicalWebPage instead of WebPage - Two faq pages (the same)

    About Page
      - has about page with extra data
      - has breadcrumb
      - doesn't have CreativeWork


      about-dr-david-gunn
        Now has Profile Page and wrong link "https://www.focusvision.com.au/blog/author/david-gunn.mdx"

        /about-dr-brendan-cronin/

        Same



        /free-refractive-outcomes-analyzer/
        Mediacal webpage crumbs, faq


        /contact/
        has ContactPage and MedicalClinic
        Doesn't have ContactPoint or CreativeWork

        Blog

blog index schema https://gemini.google.com/u/1/app/0e36b6d72c6fefa8?pageId=none

Show tags on blog posts.

Prompt:

We have some tags in some blog posts but Id like to add a better system for this! including having both tags and catoroiges in keystatic the blog post index and at the bottom of each blog post here is how it is set up on another system similar to this: Understood. Here is the comprehensive information about your Categories, Tags, and Keystatic/Astro setup for use on another project.

---

# Website Taxonomy & Keystatic Setup Blueprint

## 1. Categories and Tags (Current Data)

### Categories (`src/data/categories.json`)

These represent the broad topics of the blog.

- **Cataract Surgery** (`cataract-surgery`)
- **Corneal Diseases** (`corneal-diseases`)
- **Innovation & Research** (`innovation-research`)
- **Keratoconus** (`keratoconus`)
- **Laser Eye Surgery** (`laser-eye-surgery`)
- **Patient Information** (`patient-information`)

### Tags (`src/data/tags.json`)

These are granular labels used to group specific technical topics or equipment.

- **Advanced Technology**, **Alcon**, **CAIRS**, **CLEAR**, **Comparison**, **Complex Cataract**, **Conference**, **Corneal Allogenic Rings**, **Corneal Cross-linking**, **Corneal Specialist**, **Digital Tools**, **EDOF Lenses**, **Eye Surface**, **FAQ**, **High Myopia**, **ICL Surgery**, **Implantable Contact Lens**, **Innovation**, **Intraocular Lenses (IOL)**, **IOL Calculations**, **LASIK**, **Lens Replacement**, **Monovision**, **Multifocal Lenses**, **PanOptix**, **Patient Education**, **Patient Guide**, **Patient Logistics**, **Phorcides**, **Post-LASIK**, **Premium IOL**, **Presbyopia**, **PRK**, **Pterygium**, **Ray Tracing**, **Rayner**, **Refractive Surgery**, **Research**, **Reversible Surgery**, **Science of Vision**, **Surgical Innovation**, **Surgical Planning**, **Surgical Procedure**, **Topography Guided**, **Travel**, **Vision Correction**, **Wavelight Plus**.

---

## 2. Keystatic Configuration (`keystatic.config.tsx`)

The system uses Keystatic **Singletons** to manage the list of available categories and tags, and a **Collection** for the blog posts that references them.

### Data Management Logic

Keystatic reads the JSON files at startup to populate dropdown menus:

```typescript
import tagsData from "./src/data/tags.json";
import categoriesData from "./src/data/categories.json";

const getArrayData = (data: any) => {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  return [];
};

const tags = getArrayData(tagsData);
const categories = getArrayData(categoriesData);
```

### Singleton Setup

These allow you to add/edit the list of tags/categories in the Keystatic Admin UI.

```typescript
singletons: {
  categories: singleton({
    label: "Categories",
    path: "src/data/categories",
    format: { data: "json" },
    schema: {
      items: fields.array(
        fields.object({
          label: fields.text({ label: "Label" }),
          value: fields.text({ label: "Value (Slug)" }),
        }),
        { itemLabel: (props) => props.fields.label.value }
      ),
    },
  }),
  tags: singleton({
    label: "Tags",
    path: "src/data/tags",
    format: { data: "json" },
    schema: {
      items: fields.array(
        fields.object({
          label: fields.text({ label: "Label" }),
          value: fields.text({ label: "Value (Slug)" }),
        }),
        { itemLabel: (props) => props.fields.label.value }
      ),
    },
  }),
}
```

### Blog Collection Setup

The blog schema uses `fields.select` for Categories (single choice) and `fields.array(fields.select(...))` for Tags (multiple choice).

```typescript
blog: collection({
  label: "Blog",
  slugField: "slug",
  path: "src/content/blog/*",
  schema: {
    // ... other fields
    category: fields.select({
      label: "Category",
      options: categories.map((c) => ({ label: c.label, value: c.label })),
    }),
    tags: fields.array(
      fields.select({
        label: "Tag",
        options: tags.map((t) => ({ label: t.label, value: t.label })),
      }),
      { label: "Tags", itemLabel: (props) => props.value },
    ),
  },
});
```

---

## 3. Astro Page Implementation (Dynamic Routing)

Astro generates unique pages for every tag and category using dynamic parameters.

### Category Pages (`src/pages/blog/category/[category].astro`)

- **Path**: `/blog/category/[category-slug]/`
- **Logic**: It loads all categories from `categories.json`, then filters the blog collection for posts where `post.data.category` matches the category label.

### Tag Pages (`src/pages/blog/tag/[tag].astro`)

- **Path**: `/blog/tag/[tag-slug]/`
- **Logic**:

```typescript
export const getStaticPaths: GetStaticPaths = async () => {
  const allPosts = await getCollection("blog");
  const sortedPosts = allPosts.sort(...);

  return tagsDataRaw.items.map((t) => {
    const matchingPosts = sortedPosts.filter(
      (post) => post.data.tags && post.data.tags.includes(t.label)
    );
    return {
      params: { tag: t.value }, // The URL slug (e.g. 'cairs')
      props: { tagData: t, posts: matchingPosts },
    };
  });
};
```

## Summary for Implementation on New Site

1.  **Define JSON Schemas**: Create `src/data/tags.json` and `categories.json` with an `items` array of `{ label, value }`.
2.  **Keystatic UI**: Set up singletons in `keystatic.config.tsx` to manage those JSON files.
3.  **Blog Schema**: In the blog collection, import the JSON data and use it to populate `fields.select` options.
4.  **Dynamic Routes**: Use `getStaticPaths` in Astro to iterate over the JSON data items, creating a page for each and filtering the blog collection by the item's label.

Test
