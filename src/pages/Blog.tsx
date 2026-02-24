import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, ArrowRight } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const Blog = () => {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("blog_posts").select("*").order("published_at", { ascending: false }).then(({ data }) => {
      setPosts(data || []);
      setLoading(false);
    });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <div className="bg-primary py-12 text-center">
          <h1 className="text-3xl md:text-4xl font-heading font-bold text-primary-foreground">Learn & Explore</h1>
          <p className="text-primary-foreground/70 mt-2">Wellness tips, recipes, and Ayurvedic wisdom</p>
        </div>
        <div className="container py-12">
          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => <div key={i} className="h-80 bg-muted rounded-xl animate-pulse" />)}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map(post => (
                <Link key={post.id} to={`/blog/${post.slug}`} className="group bg-background border border-border rounded-xl overflow-hidden hover:shadow-lg transition-all">
                  <div className="aspect-video bg-cream-dark overflow-hidden">
                    <img src={post.image_url || "/placeholder.svg"} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                  <div className="p-5">
                    {post.category && <span className="text-xs font-semibold text-secondary uppercase tracking-wide">{post.category}</span>}
                    <h2 className="font-heading font-semibold text-foreground mt-2 group-hover:text-secondary transition-colors">{post.title}</h2>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{post.excerpt}</p>
                    <div className="flex items-center justify-between mt-4">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar size={12} />
                        {post.published_at ? new Date(post.published_at).toLocaleDateString() : ""}
                      </div>
                      <span className="text-secondary text-sm font-medium flex items-center gap-1">Read <ArrowRight size={14} /></span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Blog;
