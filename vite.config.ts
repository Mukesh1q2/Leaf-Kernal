import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { razorpayApiPlugin } from "./src/server/razorpayMiddleware";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
      proxy: {
        "/supabase": {
          target: "http://127.0.0.1:54321",
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/supabase/, ""),
        },
      },
    },
    plugins: [
      react(),
      razorpayApiPlugin({
        keyId: env.RAZORPAY_KEY_ID || env.VITE_RAZORPAY_KEY_ID,
        keySecret: env.RAZORPAY_KEY_SECRET,
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
