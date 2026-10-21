import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { WishlistProvider } from "@/contexts/WishlistContext";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import ChatWidget from "@/components/ChatWidget";
import RouteTracker from "@/components/RouteTracker";

// Eager import for home landing page
import Index from "./pages/Index";

// Lazy imports for pages
const Shop = lazy(() => import("./pages/Shop"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Cart = lazy(() => import("./pages/Cart"));
const Auth = lazy(() => import("./pages/Auth"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Account = lazy(() => import("./pages/Account"));
const About = lazy(() => import("./pages/About"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const FAQ = lazy(() => import("./pages/FAQ"));
const Contact = lazy(() => import("./pages/Contact"));
const Wishlist = lazy(() => import("./pages/Wishlist"));
const CheckoutSuccess = lazy(() => import("./pages/CheckoutSuccess"));
const CheckoutCancel = lazy(() => import("./pages/CheckoutCancel"));
const ReferralProgram = lazy(() => import("./pages/ReferralProgram"));
const LoyaltyPoints = lazy(() => import("./pages/LoyaltyPoints"));
const TrackOrder = lazy(() => import("./pages/TrackOrder"));
const Quiz = lazy(() => import("./pages/Quiz"));
const ShippingPolicy = lazy(() => import("./pages/ShippingPolicy"));
const ReturnRefundPolicy = lazy(() => import("./pages/ReturnRefundPolicy"));
const TermsConditions = lazy(() => import("./pages/TermsConditions"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Lazy imports for admin pages
const AdminLayout = lazy(() => import("./components/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminBlog = lazy(() => import("./pages/admin/AdminBlog"));
const AdminFAQs = lazy(() => import("./pages/admin/AdminFAQs"));
const AdminReviews = lazy(() => import("./pages/admin/AdminReviews"));
const AdminCoupons = lazy(() => import("./pages/admin/AdminCoupons"));
const AdminBanners = lazy(() => import("./pages/admin/AdminBanners"));
const AdminCustomers = lazy(() => import("./pages/admin/AdminCustomers"));
const AdminTestimonials = lazy(() => import("./pages/admin/AdminTestimonials"));
const AdminInventory = lazy(() => import("./pages/admin/AdminInventory"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminActivity = lazy(() => import("./pages/admin/AdminActivity"));
const AdminAnalytics = lazy(() => import("./pages/admin/AdminAnalytics"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminBundles = lazy(() => import("./pages/admin/AdminBundles"));
const AdminAbandonedCarts = lazy(() => import("./pages/admin/AdminAbandonedCarts"));
const AdminLoyalty = lazy(() => import("./pages/admin/AdminLoyalty"));
const AdminReferrals = lazy(() => import("./pages/admin/AdminReferrals"));
const AdminCategories = lazy(() => import("./pages/admin/AdminCategories"));
const AdminHealthConcerns = lazy(() => import("./pages/admin/AdminHealthConcerns"));
const AdminPincodes = lazy(() => import("./pages/admin/AdminPincodes"));
const AdminInquiries = lazy(() => import("./pages/admin/AdminInquiries"));
const AdminDeliveries = lazy(() => import("./pages/admin/AdminDeliveries"));
const AdminSubscriptions = lazy(() => import("./pages/admin/AdminSubscriptions"));
const AdminMedia = lazy(() => import("./pages/admin/AdminMedia"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-[60vh] flex items-center justify-center bg-background">
    <div className="animate-pulse text-muted-foreground font-medium text-sm">Loading...</div>
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CartProvider>
        <WishlistProvider>
          <NotificationsProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <RouteTracker />
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/shop" element={<Shop />} />
                    <Route path="/product/:slug" element={<ProductDetail />} />
                    <Route path="/cart" element={<Cart />} />
                    <Route path="/wishlist" element={<Wishlist />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/account" element={<Account />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/blog" element={<Blog />} />
                    <Route path="/blog/:slug" element={<BlogPost />} />
                    <Route path="/faq" element={<FAQ />} />
                    <Route path="/contact" element={<Contact />} />
                    <Route path="/checkout/success" element={<CheckoutSuccess />} />
                    <Route path="/checkout/cancel" element={<CheckoutCancel />} />
                    <Route path="/referral" element={<ReferralProgram />} />
                    <Route path="/loyalty" element={<LoyaltyPoints />} />
                    <Route path="/track/:orderId" element={<TrackOrder />} />
                    <Route path="/quiz" element={<Quiz />} />
                    <Route path="/shipping-policy" element={<ShippingPolicy />} />
                    <Route path="/return-policy" element={<ReturnRefundPolicy />} />
                    <Route path="/terms-conditions" element={<TermsConditions />} />
                    <Route path="/admin/login" element={<AdminLogin />} />
                    <Route path="/admin" element={<AdminLayout />}>
                      <Route index element={<AdminDashboard />} />
                      <Route path="products" element={<AdminProducts />} />
                      <Route path="orders" element={<AdminOrders />} />
                      <Route path="deliveries" element={<AdminDeliveries />} />
                      <Route path="blog" element={<AdminBlog />} />
                      <Route path="faqs" element={<AdminFAQs />} />
                      <Route path="reviews" element={<AdminReviews />} />
                      <Route path="coupons" element={<AdminCoupons />} />
                      <Route path="banners" element={<AdminBanners />} />
                      <Route path="customers" element={<AdminCustomers />} />
                      <Route path="testimonials" element={<AdminTestimonials />} />
                      <Route path="inventory" element={<AdminInventory />} />
                      <Route path="settings" element={<AdminSettings />} />
                      <Route path="activity" element={<AdminActivity />} />
                      <Route path="analytics" element={<AdminAnalytics />} />
                      <Route path="users" element={<AdminUsers />} />
                      <Route path="bundles" element={<AdminBundles />} />
                      <Route path="abandoned-carts" element={<AdminAbandonedCarts />} />
                      <Route path="loyalty" element={<AdminLoyalty />} />
                      <Route path="referrals" element={<AdminReferrals />} />
                      <Route path="categories" element={<AdminCategories />} />
                      <Route path="health-concerns" element={<AdminHealthConcerns />} />
                      <Route path="pincodes" element={<AdminPincodes />} />
                      <Route path="inquiries" element={<AdminInquiries />} />
                      <Route path="subscriptions" element={<AdminSubscriptions />} />
                      <Route path="media" element={<AdminMedia />} />
                    </Route>
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
                <ChatWidget />
              </BrowserRouter>
            </TooltipProvider>
          </NotificationsProvider>
        </WishlistProvider>
      </CartProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
