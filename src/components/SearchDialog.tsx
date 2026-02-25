import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { ShoppingBag, FileText } from "lucide-react";

interface SearchProduct {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  price: number;
}

interface SearchBlogPost {
  id: string;
  title: string;
  slug: string;
}

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SearchDialog = ({ open, onOpenChange }: SearchDialogProps) => {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<SearchProduct[]>([]);
  const [posts, setPosts] = useState<SearchBlogPost[]>([]);
  const navigate = useNavigate();

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setProducts([]);
      setPosts([]);
      return;
    }
    const [{ data: prods }, { data: blogs }] = await Promise.all([
      supabase
        .from("products")
        .select("id, name, slug, image_url, price")
        .ilike("name", `%${q}%`)
        .limit(6),
      supabase
        .from("blog_posts")
        .select("id, title, slug")
        .ilike("title", `%${q}%`)
        .eq("is_published", true)
        .limit(4),
    ]);
    setProducts(prods || []);
    setPosts(blogs || []);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setProducts([]);
      setPosts([]);
    }
  }, [open]);

  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search products, blog posts..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {products.length > 0 && (
          <CommandGroup heading="Products">
            {products.map((p) => (
              <CommandItem
                key={p.id}
                value={p.name}
                onSelect={() => go(`/product/${p.slug}`)}
                className="cursor-pointer"
              >
                <div className="flex items-center gap-3 w-full">
                  <div className="w-8 h-8 rounded bg-muted overflow-hidden shrink-0">
                    <img
                      src={p.image_url || "/placeholder.svg"}
                      alt={p.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium truncate">{p.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-muted-foreground">₹{p.price}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {posts.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Blog Posts">
              {posts.map((post) => (
                <CommandItem
                  key={post.id}
                  value={post.title}
                  onSelect={() => go(`/blog/${post.slug}`)}
                  className="cursor-pointer"
                >
                  <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{post.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {query.length >= 2 && (
          <>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                onSelect={() => go(`/shop?search=${encodeURIComponent(query)}`)}
                className="cursor-pointer"
              >
                <ShoppingBag className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  View all results for "<strong>{query}</strong>"
                </span>
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
};

export default SearchDialog;
