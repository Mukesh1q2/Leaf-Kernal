const SITE_URL = "https://leafandkernel.com";
const BRAND_NAME = "Leaf & Kernel";

export const generateOrganizationSchema = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": BRAND_NAME,
  "url": SITE_URL,
  "logo": `${SITE_URL}/logo.png`,
  "sameAs": [
    "https://instagram.com/leafandkernel",
    "https://facebook.com/leafandkernel",
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+91-8796745590",
    "contactType": "customer service",
    "areaServed": "IN",
    "availableLanguage": ["English", "Hindi"],
  },
});

export const generateProductSchema = (product: any) => {
  if (!product) return null;
  const canonicalUrl = `${SITE_URL}/product/${product.slug}`;
  const images = [product.image_url, ...(product.gallery_urls || [])].filter(Boolean);
  const availabilityUrl = (product.stock_quantity ?? 0) > 0
    ? "https://schema.org/InStock"
    : "https://schema.org/OutOfStock";

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": product.name,
    "image": images.length > 0 ? images : [`${SITE_URL}/placeholder.svg`],
    "description": product.short_description || product.description || product.name,
    "sku": product.id,
    "mpn": product.slug,
    "productID": product.id,
    "url": canonicalUrl,
    "brand": {
      "@type": "Brand",
      "name": "UVEDIQ",
    },
    "offers": {
      "@type": "Offer",
      "url": canonicalUrl,
      "priceCurrency": "INR",
      "price": Number(product.price).toFixed(2),
      "priceValidUntil": "2027-12-31",
      "itemCondition": "https://schema.org/NewCondition",
      "availability": availabilityUrl,
      "seller": {
        "@type": "Organization",
        "name": "Leaf & Kernel",
      },
    },
    ...(product.rating ? {
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": product.rating,
        "reviewCount": product.review_count || 1,
      },
    } : {}),
  };
};

export const generateArticleSchema = (post: any) => {
  if (!post) return null;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title,
    "image": post.image_url ? [post.image_url] : [],
    "datePublished": post.published_at || post.created_at,
    "dateModified": post.updated_at || post.published_at || post.created_at,
    "author": {
      "@type": "Organization",
      "name": BRAND_NAME,
    },
    "publisher": {
      "@type": "Organization",
      "name": BRAND_NAME,
      "logo": {
        "@type": "ImageObject",
        "url": `${SITE_URL}/logo.png`,
      },
    },
    "description": post.excerpt || post.title,
  };
};

export const generateFAQSchema = (faqs: Array<{ question: string; answer: string }>) => {
  if (!faqs || faqs.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map((f) => ({
      "@type": "Question",
      "name": f.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": f.answer,
      },
    })),
  };
};

export const generateBreadcrumbSchema = (items: Array<{ name: string; url: string }>) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": items.map((item, index) => ({
    "@type": "ListItem",
    "position": index + 1,
    "name": item.name,
    "item": item.url.startsWith("http") ? item.url : `${SITE_URL}${item.url}`,
  })),
});
