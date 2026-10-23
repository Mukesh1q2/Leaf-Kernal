import { useEffect } from "react";

interface SEOHeadProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  canonicalUrl?: string;
  type?: string;
  jsonLd?: object | null;
}

const DEFAULT_TITLE = "UVEDIQ | Plant-Powered Ayurvedic Superfoods by Leaf & Kernel";
const DEFAULT_DESC = "Discover premium plant-powered nutrition, Ayurvedic supplements, superfood powders, and wellness blends crafted for holistic health.";
const DEFAULT_IMAGE = "https://leafandkernel.com/logo.png";
const SITE_ORIGIN = "https://leafandkernel.com";

export const SEOHead = ({
  title,
  description = DEFAULT_DESC,
  image = DEFAULT_IMAGE,
  url,
  canonicalUrl,
  type = "website",
  jsonLd,
}: SEOHeadProps) => {
  const fullTitle = title ? `${title} | UVEDIQ · Leaf & Kernel` : DEFAULT_TITLE;
  const currentPath = typeof window !== "undefined" ? window.location.pathname : "/";
  const effectiveCanonical = canonicalUrl || `${SITE_ORIGIN}${currentPath}`;
  const effectiveUrl = url || effectiveCanonical;

  useEffect(() => {
    // 1. Update Title
    document.title = fullTitle;

    // 2. Update Meta Description & OpenGraph
    const setMeta = (name: string, content: string, isProperty = false) => {
      const selector = isProperty ? `meta[property="${name}"]` : `meta[name="${name}"]`;
      let element = document.head.querySelector(selector) as HTMLMetaElement;
      if (!element) {
        element = document.createElement("meta");
        if (isProperty) element.setAttribute("property", name);
        else element.setAttribute("name", name);
        document.head.appendChild(element);
      }
      element.setAttribute("content", content);
    };

    setMeta("description", description);
    setMeta("og:title", fullTitle, true);
    setMeta("og:description", description, true);
    setMeta("og:image", image, true);
    setMeta("og:url", effectiveUrl, true);
    setMeta("og:type", type, true);
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", fullTitle);
    setMeta("twitter:description", description);
    setMeta("twitter:image", image);

    // 3. Inject / Update Canonical URL
    let canonicalLink = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonicalLink) {
      canonicalLink = document.createElement("link");
      canonicalLink.setAttribute("rel", "canonical");
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute("href", effectiveCanonical);

    // 4. Inject JSON-LD Schema
    const scriptId = "json-ld-seo-schema";
    let scriptTag = document.getElementById(scriptId) as HTMLScriptElement;
    if (jsonLd) {
      if (!scriptTag) {
        scriptTag = document.createElement("script");
        scriptTag.id = scriptId;
        scriptTag.type = "application/ld+json";
        document.head.appendChild(scriptTag);
      }
      scriptTag.textContent = JSON.stringify(jsonLd);
    } else if (scriptTag) {
      scriptTag.remove();
    }

    return () => {
      const existing = document.getElementById(scriptId);
      if (existing) existing.remove();
    };
  }, [fullTitle, description, image, effectiveUrl, effectiveCanonical, type, jsonLd]);

  return null;
};
