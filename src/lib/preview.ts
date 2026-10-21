export const isPreviewMode = (searchParams: URLSearchParams): boolean => {
  return searchParams.get("preview") === "true";
};

export const getPreviewUrl = (path: string): string => {
  return `${window.location.origin}${path}?preview=true`;
};
