import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchProducts from "./tools/search-products";
import listMyOrders from "./tools/list-my-orders";
import getOrder from "./tools/get-order";
import getMyLoyalty from "./tools/get-my-loyalty";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "leaf-and-kernel-mcp",
  title: "Leaf & Kernel",
  version: "0.1.0",
  instructions:
    "Tools for Leaf & Kernel Superfoods. Use `search_products` to look up the live catalog. Use `list_my_orders`, `get_order`, and `get_my_loyalty` for the signed-in user's own account data.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchProducts, listMyOrders, getOrder, getMyLoyalty],
});