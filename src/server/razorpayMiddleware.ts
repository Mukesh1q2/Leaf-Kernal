import type { Plugin, Connect } from "vite";
import Razorpay from "razorpay";
import crypto from "node:crypto";

export interface RazorpayPluginOptions {
  keyId?: string;
  keySecret?: string;
}

/**
 * Vite Dev Server middleware plugin providing standard Razorpay backend endpoints:
 * - POST /api/create-order
 * - POST /api/verify-payment
 */
export function razorpayApiPlugin(options?: RazorpayPluginOptions): Plugin {
  return {
    name: "razorpay-api-plugin",
    configureServer(server) {
      server.middlewares.use(async (req: Connect.IncomingMessage, res, next) => {
        const url = req.url?.split("?")[0];
        const keyId =
          options?.keyId ||
          process.env.RAZORPAY_KEY_ID ||
          process.env.VITE_RAZORPAY_KEY_ID;
        const keySecret =
          options?.keySecret ||
          process.env.RAZORPAY_KEY_SECRET;

        // Endpoint: POST /api/create-order
        if (url === "/api/create-order") {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Method not allowed. Use POST." }));
            return;
          }

          let body = "";
          req.on("data", (chunk: Buffer) => {
            body += chunk.toString();
          });

          req.on("end", async () => {
            try {
              if (!keyId || !keySecret) {
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(
                  JSON.stringify({
                    error: "Razorpay credentials are not configured on the server.",
                  })
                );
                return;
              }

              const parsed = body ? JSON.parse(body) : {};
              const amount = Number(parsed.amount);

              // Validate amount >= 100 paise
              if (!amount || isNaN(amount) || amount < 100) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(
                  JSON.stringify({
                    error: "Amount must be at least 100 paise (₹1.00).",
                  })
                );
                return;
              }

              const currency = parsed.currency || "INR";
              const receipt = parsed.receipt || `rcpt_${Date.now()}`;
              const notes = parsed.notes || {};

              const rzp = new Razorpay({
                key_id: keyId,
                key_secret: keySecret,
              });

              const order = await rzp.orders.create({
                amount: Math.round(amount),
                currency,
                receipt,
                notes,
              });

              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  order_id: order.id,
                  amount: order.amount,
                  currency: order.currency,
                  razorpay_key_id: keyId,
                  receipt: order.receipt,
                })
              );
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  error:
                    err?.error?.description ||
                    err?.message ||
                    "Failed to create Razorpay order.",
                })
              );
            }
          });
          return;
        }

        // Endpoint: POST /api/verify-payment
        if (url === "/api/verify-payment") {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Method not allowed. Use POST." }));
            return;
          }

          let body = "";
          req.on("data", (chunk: Buffer) => {
            body += chunk.toString();
          });

          req.on("end", async () => {
            try {
              if (!keySecret) {
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(
                  JSON.stringify({
                    error: "Razorpay secret key is not configured on the server.",
                  })
                );
                return;
              }

              const parsed = body ? JSON.parse(body) : {};
              const orderId = parsed.razorpay_order_id || parsed.order_id;
              const paymentId = parsed.razorpay_payment_id || parsed.payment_id;
              const signature = parsed.razorpay_signature || parsed.signature;

              // Validate required fields
              if (!orderId || !paymentId || !signature) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(
                  JSON.stringify({
                    error:
                      "Missing required fields: order_id, payment_id, and signature are required.",
                  })
                );
                return;
              }

              // Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
              const expectedSignature = crypto
                .createHmac("sha256", keySecret)
                .update(`${orderId}|${paymentId}`)
                .digest("hex");

              if (expectedSignature !== signature) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(
                  JSON.stringify({
                    success: false,
                    error: "Payment verification failed: signature mismatch.",
                  })
                );
                return;
              }

              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  success: true,
                  message: "Payment verified successfully.",
                  order_id: orderId,
                  payment_id: paymentId,
                })
              );
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(
                JSON.stringify({
                  error:
                    err?.message ||
                    "An unexpected error occurred during verification.",
                })
              );
            }
          });
          return;
        }

        next();
      });
    },
  };
}
