import React, { useState, useEffect } from "react";
import { getLocalFallbackImage, buildProductAltText } from "@/lib/productImages";

export interface ProductImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string | null;
  slug?: string | null;
  name?: string | null;
  category?: string | null;
  imageIndex?: number;
  containerClassName?: string;
}

/**
 * Resilient ProductImage Component
 * - Automatically falls back to high-res bundled superfood images if src fails or is null.
 * - Generates descriptive accessibility & SEO alt text.
 * - Prevents broken image icons in browser.
 */
export const ProductImage: React.FC<ProductImageProps> = ({
  src,
  slug,
  name,
  category,
  imageIndex,
  alt,
  className = "w-full h-full object-cover",
  loading = "lazy",
  ...props
}) => {
  const fallbackAsset = getLocalFallbackImage(slug || name);
  const [currentSrc, setCurrentSrc] = useState<string>(src || fallbackAsset);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (src && src.trim() !== "") {
      setCurrentSrc(src);
      setHasError(false);
    } else {
      setCurrentSrc(fallbackAsset);
    }
  }, [src, fallbackAsset]);

  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      setCurrentSrc(fallbackAsset);
    }
  };

  const computedAlt = alt || buildProductAltText(name, { category, index: imageIndex });

  return (
    <img
      src={currentSrc}
      alt={computedAlt}
      loading={loading}
      onError={handleError}
      className={className}
      {...props}
    />
  );
};

export default ProductImage;
