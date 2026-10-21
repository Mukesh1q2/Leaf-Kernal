import { Eye, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";

export const DraftPreviewBanner = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  if (searchParams.get("preview") !== "true") return null;

  const exitPreview = () => {
    searchParams.delete("preview");
    setSearchParams(searchParams);
  };

  return (
    <div className="bg-amber-600 text-white px-4 py-2 text-xs md:text-sm font-medium flex items-center justify-between shadow-md sticky top-0 z-[60]">
      <div className="flex items-center gap-2">
        <Eye className="h-4 w-4 animate-pulse" />
        <span>
          <strong>DRAFT PREVIEW MODE:</strong> You are viewing unpublished content. Changes are not live to public customers.
        </span>
      </div>
      <button
        onClick={exitPreview}
        className="flex items-center gap-1 bg-black/20 hover:bg-black/40 text-white px-2.5 py-1 rounded transition-colors"
      >
        <X className="h-3.5 w-3.5" /> Exit Preview
      </button>
    </div>
  );
};
