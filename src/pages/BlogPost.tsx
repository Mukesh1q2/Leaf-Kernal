import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight, Calendar } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { DraftPreviewBanner } from "@/components/DraftPreviewBanner";
import { SEOHead } from "@/components/SEOHead";
import { generateArticleSchema } from "@/lib/seo";

const BlogPost = () => {
  const { slug } = useParams();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("blog_posts").select("*").eq("slug", slug).single().then(({ data }) => {
      setPost(data);
      setLoading(false);
    });
  }, [slug]);

  if (loading) return <div className="min-h-screen bg-background"><Header /><div className="container py-16"><div className="h-96 bg-muted rounded-xl animate-pulse" /></div><Footer /></div>;
  if (!post) return <div className="min-h-screen bg-background"><Header /><div className="container py-16 text-center"><h1 className="text-2xl font-heading font-bold">Post not found</h1><Link to="/blog" className="text-secondary hover:underline mt-4 inline-block">Back to Blog</Link></div><Footer /></div>;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={post.title}
        description={post.excerpt || post.title}
        image={post.image_url}
        type="article"
        jsonLd={generateArticleSchema(post)}
      />
      <DraftPreviewBanner />
      <Header />
      <main className="container py-8">
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link to="/" className="hover:text-secondary">Home</Link><ChevronRight size={14} />
          <Link to="/blog" className="hover:text-secondary">Blog</Link><ChevronRight size={14} />
          <span className="text-foreground line-clamp-1">{post.title}</span>
        </nav>
        <article className="max-w-3xl mx-auto">
          {post.image_url && <img src={post.image_url} alt={post.title} className="w-full rounded-2xl mb-8 aspect-video object-cover" />}
          <div className="flex items-center gap-3 mb-4">
            {post.category && <span className="text-xs font-semibold text-secondary uppercase tracking-wide bg-leaf/10 px-2 py-1 rounded">{post.category}</span>}
            {post.published_at && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Calendar size={12} />{new Date(post.published_at).toLocaleDateString()}</span>}
          </div>
          <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-6">{post.title}</h1>
          <div className="prose text-foreground leading-relaxed whitespace-pre-line">{post.content}</div>
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-border">
              {post.tags.map((tag: string) => <span key={tag} className="text-xs bg-muted text-muted-foreground px-3 py-1 rounded-full">#{tag}</span>)}
            </div>
          )}
        </article>
      </main>
      <Footer />
    </div>
  );
};

export default BlogPost;
