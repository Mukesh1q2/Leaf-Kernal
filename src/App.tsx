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
import Index from "./pages/Index";
import Shop from "./pages/Shop";
import ProductDetail from "./pages/ProductDetail";
import Cart from "./pages/Cart";
import Auth from "./pages/Auth";
import OAuthConsent from "./pages/OAuthConsent";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Account from "./pages/Account";
import About from "./pages/About";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import FAQ from "./pages/FAQ";
import Contact from "./pages/Contact";
import CheckoutSuccess from "./pages/CheckoutSuccess";
import CheckoutCancel from "./pages/CheckoutCancel";
import AdminLayout from "./components/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminBlog from "./pages/admin/AdminBlog";
import AdminFAQs from "./pages/admin/AdminFAQs";
import AdminReviews from "./pages/admin/AdminReviews";
import AdminCoupons from "./pages/admin/AdminCoupons";
import AdminBanners from "./pages/admin/AdminBanners";
import AdminCustomers from "./pages/admin/AdminCustomers";
import AdminTestimonials from "./pages/admin/AdminTestimonials";
import AdminInventory from "./pages/admin/AdminInventory";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminActivity from "./pages/admin/AdminActivity";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminBundles from "./pages/admin/AdminBundles";
import AdminAbandonedCarts from "./pages/admin/AdminAbandonedCarts";
import AdminLoyalty from "./pages/admin/AdminLoyalty";
import AdminReferrals from "./pages/admin/AdminReferrals";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminHealthConcerns from "./pages/admin/AdminHealthConcerns";
import AdminPincodes from "./pages/admin/AdminPincodes";
import AdminInquiries from "./pages/admin/AdminInquiries";
import AdminDeliveries from "./pages/admin/AdminDeliveries";
import ReferralProgram from "./pages/ReferralProgram";
import LoyaltyPoints from "./pages/LoyaltyPoints";
import TrackOrder from "./pages/TrackOrder";
import Quiz from "./pages/Quiz";
import AdminSubscriptions from "./pages/admin/AdminSubscriptions";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/shop" element={<Shop />} />
                <Route path="/product/:slug" element={<ProductDetail />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
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
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
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
