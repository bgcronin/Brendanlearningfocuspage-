import type {
  WithContext,
  Physician,
  MedicalProcedure,
  MedicalCondition,
  FAQPage,
  BlogPosting,
  Blog,
  BreadcrumbList,
  ContactPage,
  AboutPage,
  Organization,
  MedicalWebPage,
  ProfilePage,
  Person,
  MedicalClinic,
  WebSite,
} from "schema-dts";
import siteData from "../data/site.json";

export const SITE_URL = "https://www.focusvision.com.au";
export const ORG_ID = `${SITE_URL}/#org`;
export const WEB_ID = `${SITE_URL}/#website`;
export const LOGO_ID = `${SITE_URL}/#logo`;

// Address + geo
const address = {
  "@type": "PostalAddress",
  streetAddress: siteData.location?.streetAddress,
  addressLocality: siteData.location?.locality,
  addressRegion: siteData.location?.region,
  postalCode: siteData.location?.postalCode,
  addressCountry: "AU",
};

const geo =
  siteData.location?.latitude && siteData.location?.longitude
    ? {
        "@type": "GeoCoordinates",
        latitude: Number(siteData.location.latitude),
        longitude: Number(siteData.location.longitude),
      }
    : undefined;

const sameAs = [
  siteData.facebookUrl,
  siteData.instagramUrl,
  siteData.linkedinUrl,
  siteData.youtubeUrl,
].filter(Boolean) as string[];

const whatsappContact: any = siteData.whatsappUrl
  ? {
      "@type": "ContactPoint",
      contactType: "whatsapp",
      url: siteData.whatsappUrl,
    }
  : undefined;

const employees = [
  {
    "@type": ["Person", "Physician"],
    "@id": `${SITE_URL}/about-dr-brendan-cronin#person`,
    name: "Dr Brendan Cronin",
    url: `${SITE_URL}/about-dr-brendan-cronin`,
  },
  {
    "@type": ["Person", "Physician"],
    "@id": `${SITE_URL}/about-dr-david-gunn#person`,
    name: "Dr David Gunn",
    url: `${SITE_URL}/about-dr-david-gunn`,
  },
];

export const contactPoint: WithContext<any> = {
  "@context": "https://schema.org",
  "@type": "ContactPoint",
  contactType: "customer support",
  telephone: siteData.phoneNumberText,
  email: siteData.email,
  areaServed: "AU",
  availableLanguage: ["en"],
};

// ==========================================
// 1. GLOBAL IDENTITY (Medical Clinic & Organization)
// ==========================================
export const getMedicalClinicSchema = (): WithContext<MedicalClinic> => ({
  "@context": "https://schema.org",
  "@type": "MedicalClinic",
  "@id": ORG_ID,
  name: siteData.name,
  description: siteData.description,
  url: SITE_URL,
  logo: `${SITE_URL}/favicon.png`,
  image: `${SITE_URL}/favicon.png`,
  telephone: siteData.phoneNumberText,
  faxNumber: siteData.faxNumberText,
  email: siteData.email,
  address: address as any,
  priceRange: "$$$",
  geo: geo as any,
  sameAs: sameAs,
  medicalSpecialty: "https://schema.org/Surgical" as any,
  openingHours: "Mo-Fr 09:00-17:00",
  employee: employees as any,
  contactPoint: [contactPoint, whatsappContact].filter(Boolean) as any,
  availableService: [
    {
      "@id":
        "https://www.focusvision.com.au/vision-correction/laser-eye-surgery#procedure",
    },
    {
      "@id":
        "https://www.focusvision.com.au/vision-correction/ray-tracing-lasik#procedure",
    },
    {
      "@id":
        "https://www.focusvision.com.au/vision-correction/implantable-contact-lens#procedure",
    },
    {
      "@id":
        "https://www.focusvision.com.au/vision-correction/laser-for-reading-glasses#procedure",
    },
    {
      "@id":
        "https://www.focusvision.com.au/vision-correction/refractive-lens-exchange#procedure",
    },
    {
      "@id":
        "https://www.focusvision.com.au/vision-correction/cataract-surgery#procedure",
    },
    {
      "@id":
        "https://www.focusvision.com.au/vision-correction/pterygium-surgery#procedure",
    },
  ] as any,
});

export const getWebSiteSchema = (): WithContext<WebSite> => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": WEB_ID,
  url: SITE_URL,
  name: siteData.name,
  alternateName: ["FocusVision"],
  publisher: { "@id": ORG_ID } as any,
});

// ==========================================
// 2. PROCEDURES
// ==========================================
export const getProcedureSchema = (
  name: string,
  description: string,
  url: string,
  imageUrl?: string,
  type: "Surgical" | "NonSurgical" = "Surgical",
): WithContext<any> => ({
  "@context": "https://schema.org",
  "@type": type === "Surgical" ? "SurgicalProcedure" : "MedicalProcedure",
  "@id": `${new URL(url, SITE_URL).href}#procedure`,
  name: name,
  description: description,
  image: imageUrl ? new URL(imageUrl, SITE_URL).href : undefined,
  bodyLocation: "Eye",
  mainEntityOfPage: new URL(url, SITE_URL).href,
  procedureType:
    type === "Surgical"
      ? "https://schema.org/PercutaneousProcedure"
      : "https://schema.org/NoninvasiveProcedure",
});

// ==========================================
// 3. CONDITIONS
// ==========================================
export const getConditionSchema = (
  name: string,
  description: string,
  symptoms: string[] = [],
  treatments: string[] = [],
): WithContext<MedicalCondition> => ({
  "@context": "https://schema.org",
  "@type": "MedicalCondition",
  name: name,
  description: description,
  signOrSymptom: symptoms.map((s) => ({
    "@type": "MedicalSymptom",
    name: s,
  })) as any,
  possibleTreatment: treatments.map((t) => ({
    "@type": "MedicalTherapy",
    name: t,
  })) as any,
});

// ==========================================
// 4. FAQ PAGES
// ==========================================
export const getFAQSchema = (
  faqs: { question: string; answer: string }[],
): WithContext<FAQPage> => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })) as any,
});

// ==========================================
// 5. BREADCRUMBS
// ==========================================
export const getBreadcrumbSchema = (
  items: { name: string; item: string }[],
): WithContext<BreadcrumbList> => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: SITE_URL,
    },
    ...items.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 2,
      name: crumb.name,
      item: new URL(crumb.item, SITE_URL).href,
    })),
  ] as any,
});

// ==========================================
// 6. BLOG POSTS
// ==========================================
export const getBlogSchema = (
  post: any,
  url: string,
  imageUrl?: string,
  authorData?: any,
): WithContext<BlogPosting> => {
  const publishedDate = post.data.datePublished
    ? new Date(post.data.datePublished).toISOString()
    : undefined;
  const modifiedDate = post.data.dateModified
    ? new Date(post.data.dateModified).toISOString()
    : publishedDate;

  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": new URL(url, SITE_URL).href,
    } as any,
    headline: post.data.title,
    description: post.data.description,
    image: imageUrl ? new URL(imageUrl, SITE_URL).href : undefined,
    datePublished: publishedDate,
    dateModified: modifiedDate,
    author: authorData
      ? {
          "@type": "Person",
          "@id": `${SITE_URL}/blog/author/${authorData.id.replace(/\.[^/.]+$/, "")}#person`,
          name: authorData.data.name,
          url: `${SITE_URL}/blog/author/${authorData.id.replace(/\.[^/.]+$/, "")}`,
        }
      : {
          "@type": "Person",
          name: siteData.author,
          url: SITE_URL,
        },
    publisher: {
      "@type": "Organization",
      "@id": ORG_ID,
      name: siteData.name,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/favicon.png`,
      },
    } as any,
    inLanguage: "en-AU",
    articleSection: "Eye Care Blog",
  };
};

export const getBlogIndexSchema = (
  url: string,
  posts: any[],
  authors: any[],
): WithContext<Blog> => ({
  "@context": "https://schema.org",
  "@type": "Blog",
  name: "Focus Vision Blog",
  url: new URL(url, SITE_URL).href,
  description:
    "Educational articles regarding modern surgical procedures and patient recovery.",
  publisher: {
    "@type": "MedicalOrganization",
    name: siteData.name,
    "@id": ORG_ID,
  } as any,
  blogPost: posts.map((post) => {
    const publishedDate = post.data.datePublished
      ? new Date(post.data.datePublished).toISOString()
      : undefined;

    const authorData = authors.find((a) => a.id === post.data.author);

    return {
      "@type": "BlogPosting",
      headline: post.data.title,
      url: new URL(`/blog/${post.id.replace(/\.[^/.]+$/, "")}/`, SITE_URL).href,
      datePublished: publishedDate,
      author: {
        "@type": "Person",
        name: authorData ? authorData.data.name : siteData.author,
        ...(authorData && {
          url: new URL(
            `/blog/author/${authorData.id.replace(/\.[^/.]+$/, "")}`,
            SITE_URL,
          ).href,
        }),
      },
      description: post.data.description,
    };
  }) as any[],
});

// ==========================================
// 7. MEDICAL WEB PAGE (The Glue)
// ==========================================
export const getMedicalWebPageSchema = (
  url: string,
  name: string,
  description: string,
  publishDate?: string,
  modifiedDate?: string,
  lastReviewed?: string,
  author?: string,
  authorUrl?: string,
): WithContext<MedicalWebPage> => ({
  "@context": "https://schema.org",
  "@type": "MedicalWebPage",
  "@id": new URL(url, SITE_URL).href,
  url: new URL(url, SITE_URL).href,
  name: name,
  description: description,
  datePublished: publishDate,
  dateModified: modifiedDate,
  lastReviewed: lastReviewed,
  author: author
    ? ({
        "@type": "Person",
        name: author,
        url: authorUrl ? new URL(authorUrl, SITE_URL).href : undefined,
      } as any)
    : undefined,
  publisher: { "@id": ORG_ID } as any,
});

// ==========================================
// 8. CONTACT PAGE
// ==========================================
export const getContactPageSchema = (
  url: string,
  name: string,
  description: string,
): WithContext<ContactPage> => ({
  "@context": "https://schema.org",
  "@type": "ContactPage",
  "@id": new URL(url, SITE_URL).href,
  url: new URL(url, SITE_URL).href,
  name: name,
  description: description,
  mainEntity: { "@id": ORG_ID } as any,
});

// ==========================================
// 9. ABOUT PAGE
// ==========================================
export const getAboutPageSchema = (
  url: string,
  name: string,
  description: string,
): WithContext<AboutPage> => ({
  "@context": "https://schema.org",
  "@type": "AboutPage",
  "@id": new URL(url, SITE_URL).href,
  url: new URL(url, SITE_URL).href,
  name: name,
  description: description,
  mainEntity: { "@id": ORG_ID } as any,
});

// ==========================================
// 10. PROFILE PAGE & PERSON ENRICHMENT
// ==========================================
export const getPersonSchema = (author: any): Person | Physician => {
  const cleanId = author.id.replace(/\.[^/.]+$/, "");
  const personId =
    author.id === "brendan-cronin"
      ? `${SITE_URL}/about-dr-brendan-cronin#person`
      : author.id === "david-gunn"
        ? `${SITE_URL}/about-dr-david-gunn#person`
        : `${SITE_URL}/blog/author/${cleanId}#person`;

  const personUrl =
    author.id === "brendan-cronin"
      ? `${SITE_URL}/about-dr-brendan-cronin`
      : author.id === "david-gunn"
        ? `${SITE_URL}/about-dr-david-gunn`
        : `${SITE_URL}/blog/author/${cleanId}`;

  const base: any = {
    "@type": author.data.ahpraNumber ? ["Person", "Physician"] : "Person",
    "@id": personId,
    name: author.data.name,
    description: author.data.fullBio || author.data.bio,
    jobTitle: author.data.credentials || "Medical Author",
    url: personUrl,
    image: author.data.avatar
      ? new URL(author.data.avatar.src, SITE_URL).href
      : undefined,
    sameAs: author.data.social
      ? (Object.values(author.data.social).filter(Boolean) as string[])
      : [],
    affiliation: author.data.affiliations
      ? author.data.affiliations.map((aff: any) => ({
          "@type": "Organization",
          name: aff.name,
          url: aff.url,
        }))
      : [],
  };

  if (author.data.ahpraNumber) {
    base.identifier = author.data.ahpraNumber;
    // medicalSpecialty as a plain string can cause validation issues for some Physician subtypes,
    // so we provide it correctly via knowsAbout and MedicalSpecialty type
    base.knowsAbout = [
      {
        "@type": "MedicalSpecialty",
        name: author.data.medicalSpecialty || "Ophthalmology",
      },
    ];
  }

  if (author.data.alumniOf && author.data.alumniOf.length > 0) {
    base.alumniOf = author.data.alumniOf.map((al: any) => ({
      "@type": "EducationalOrganization",
      name: al.name,
      url: al.url,
    }));
  }

  return base;
};

export const getProfilePageSchema = (
  url: string,
  author: any,
): WithContext<ProfilePage> => ({
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  "@id": new URL(url, SITE_URL).href,
  url: new URL(url, SITE_URL).href,
  mainEntity: getPersonSchema(author) as any,
});
