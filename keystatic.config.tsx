/** @jsxImportSource react */
import { config, fields, collection, singleton } from "@keystatic/core";
import { block, inline } from "@keystatic/core/content-components";
import tagsData from "./src/data/tags.json";
import categoriesData from "./src/data/categories.json";

const getArrayData = (data: any) => {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  return [];
};

const tags = getArrayData(tagsData);
const categories = getArrayData(categoriesData);

export default config({
  storage: {
    kind: "cloud",
  },
  cloud: {
    project: "focus-vision-team/focusvision",
  },
  ui: {
    navigation: {
      Blog: ["blog", "authors"],
      Taxonomy: ["categories", "tags"],
      Settings: ["site"],
    },
  },
  collections: {
    authors: collection({
      label: "Authors",
      slugField: "name",
      path: "src/content/authors/*",
      format: { contentField: "fullBio" },
      schema: {
        name: fields.slug({ name: { label: "Name" } }),
        bio: fields.text({ label: "Short Bio (Footer)", multiline: true }),
        credentials: fields.text({
          label: "Credentials (e.g. MBBS, FRANZCO)",
        }),
        ahpraNumber: fields.text({ label: "AHPRA Registration Number" }),
        medicalSpecialty: fields.text({
          label: "Medical Specialty",
          defaultValue: "Ophthalmology",
        }),
        avatar: fields.image({
          label: "Avatar",
          directory: "src/assets/images/authors/",
          publicPath: "../../assets/images/authors/",
        }),
        social: fields.object({
          facebook: fields.text({ label: "Facebook URL" }),
          instagram: fields.text({ label: "Instagram URL" }),
          linkedin: fields.text({ label: "LinkedIn URL" }),
          youtube: fields.text({ label: "YouTube URL" }),
        }),
        affiliations: fields.array(
          fields.object({
            name: fields.text({ label: "Affiliation Name" }),
            url: fields.text({ label: "Affiliation URL" }),
          }),
          {
            label: "Affiliations",
            itemLabel: (props) => props.fields.name.value || "New Affiliation",
          },
        ),
        alumniOf: fields.array(
          fields.object({
            name: fields.text({ label: "Organization Name" }),
            url: fields.text({ label: "Organization URL" }),
          }),
          {
            label: "Alumni Of",
            itemLabel: (props) => props.fields.name.value || "New Alumni",
          },
        ),
        fullBio: fields.mdx({
          label: "Full Bio (Profile Page)",
          options: {
            image: {
              directory: "src/assets/images/authors/",
              publicPath: "../../assets/images/authors/",
            },
          },
        }),
      },
    }),
    blog: collection({
      label: "Blog Posts",
      slugField: "slug",
      path: "src/content/blog/*",
      format: { contentField: "content" },
      entryLayout: "content",
      schema: {
        title: fields.text({
          label: "Title",
          validation: { isRequired: true },
        }),
        slug: fields.slug({
          name: {
            label: "Slug (lowercase, hyphens only)",
            description: "URL-friendly identifier, e.g., 'my-blog-post'",
          },
        }),
        description: fields.text({
          label: "Description",
          multiline: true,
          validation: { isRequired: true },
        }),
        author: fields.relationship({
          label: "Author",
          collection: "authors",
        }),
        category: fields.select({
          label: "Category",
          options: categories.map((c: any) => ({
            label: c.label,
            value: c.value,
          })),
          defaultValue: "laser-eye-surgery",
        }),
        coverImage: fields.image({
          label: "Cover Image",
          directory: "src/assets/images/blog/",
          publicPath: "../../assets/images/blog/",
          validation: { isRequired: true },
        }),
        datePublished: fields.date({
          label: "Published Date",
          validation: { isRequired: true },
        }),
        dateModified: fields.date({
          label: "Modified Date",
          description:
            "Optional. Update this when you make significant content changes to signal Google to recrawl.",
        }),
        tags: fields.array(
          fields.select({
            label: "Tag",
            options: tags.map((t: any) => ({ label: t.label, value: t.value })),
            defaultValue: "laser-eye-surgery",
          }),
          {
            label: "Tags",
            itemLabel: (props) =>
              tags.find((t: any) => t.value === props.value)?.label ??
              props.value,
          },
        ),
        faqs: fields.array(
          fields.object({
            question: fields.text({ label: "Question" }),
            answer: fields.text({
              label: "Answer",
              multiline: true,
            }),
          }),
          {
            label: "FAQs (Appears at the bottom of the post)",
            itemLabel: (props) => props.fields.question.value || "FAQ",
          },
        ),
        content: fields.mdx({
          label: "Content",
          options: {
            image: {
              directory: "src/assets/images/blog/",
              publicPath: "../../assets/images/blog/",
            },
          },
          components: {
            BlogCtaButton: block({
              label: "Blog CTA Button",
              schema: {
                href: fields.text({
                  label: "Link URL",
                  defaultValue: "/contact",
                }),
                buttonText: fields.text({
                  label: "Button Text",
                  defaultValue: "Book Appointment",
                }),
              },
            }),
            TreatmentPrice: inline({
              label: "Treatment Price",
              schema: {
                treatmentName: fields.select({
                  label: "Treatment",
                  options: [
                    { label: "TransPRK", value: "TransPRK" },
                    { label: "LASIK", value: "LASIK" },
                    { label: "CLEAR / KLex", value: "CLEAR" },
                    {
                      label: "Implantable Contact Lens (ICL)",
                      value: "Implantable",
                    },
                    {
                      label: "Refractive Lens Exchange (RLE)",
                      value: "Refractive",
                    },
                  ],
                  defaultValue: "TransPRK",
                }),
              },
            }),
          },
        }),
      },
    }),
  },
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
          { itemLabel: (props) => props.fields.label.value },
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
          { itemLabel: (props) => props.fields.label.value },
        ),
      },
    }),
    site: singleton({
      label: "Site Settings",
      path: "src/data/site",
      format: { data: "json" },
      schema: {
        name: fields.text({ label: "Name" }),
        description: fields.text({ label: "Description", multiline: true }),
        author: fields.text({ label: "Author" }),
        phoneNumberText: fields.text({ label: "Phone Number (Display)" }),
        phoneNumber: fields.text({ label: "Phone Number (Link)" }),
        faxNumberText: fields.text({ label: "Fax Number" }),
        email: fields.text({ label: "Email" }),
        ahpraNumber: fields.text({ label: "AHPRA Registration Number" }),
        facebookUrl: fields.text({ label: "Facebook URL" }),
        instagramUrl: fields.text({ label: "Instagram URL" }),
        linkedinUrl: fields.text({ label: "LinkedIn URL" }),
        youtubeUrl: fields.text({ label: "YouTube URL" }),
        tiktokUrl: fields.text({ label: "TikTok URL" }),
        whatsappUrl: fields.text({ label: "WhatsApp URL" }),
        location: fields.object(
          {
            latitude: fields.text({ label: "Latitude" }),
            longitude: fields.text({ label: "Longitude" }),
            streetAddress: fields.text({ label: "Street Address" }),
            locality: fields.text({ label: "Locality" }),
            region: fields.text({ label: "Region" }),
            postalCode: fields.text({ label: "Postal Code" }),
            countryName: fields.text({ label: "Country Name" }),
          },
          {
            label: "Location",
          },
        ),
        treatments: fields.array(
          fields.object({
            name: fields.text({ label: "Treatment Name" }),
            price: fields.text({ label: "Price" }),
          }),
          {
            label: "Treatments & Pricing",
            itemLabel: (props) => props.fields.name.value || "New Treatment",
          },
        ),
      },
    }),
  },
});
