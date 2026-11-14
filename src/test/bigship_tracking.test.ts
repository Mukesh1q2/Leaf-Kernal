import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mapBigshipStatus,
  fetchBigshipTracking,
  syncBigshipToDelivery,
} from "@/services/bigshipTracking";

describe("Bigship Logistics Tracking Unit Tests", () => {
  describe("mapBigshipStatus", () => {
    it("maps delivery statuses correctly", () => {
      expect(mapBigshipStatus("Delivered")).toBe("delivered");
      expect(mapBigshipStatus("DELIVERED")).toBe("delivered");
      expect(mapBigshipStatus("Order status updated to Delivered -M")).toBe("delivered");
    });

    it("maps out for delivery statuses correctly", () => {
      expect(mapBigshipStatus("Out for Delivery")).toBe("out_for_delivery");
      expect(mapBigshipStatus("OUT FOR DELIVERY")).toBe("out_for_delivery");
      expect(mapBigshipStatus("out_for_delivery")).toBe("out_for_delivery");
    });

    it("maps in-transit and shipped statuses correctly", () => {
      expect(mapBigshipStatus("IN-TRANSIT")).toBe("shipped");
      expect(mapBigshipStatus("In-Transit")).toBe("shipped");
      expect(mapBigshipStatus("In Transit")).toBe("shipped");
      expect(mapBigshipStatus("Shipped")).toBe("shipped");
      expect(mapBigshipStatus("Received at hub Successfully")).toBe("shipped");
      expect(mapBigshipStatus("Picked Successfully")).toBe("shipped");
    });

    it("maps pickup and packaging statuses correctly", () => {
      expect(mapBigshipStatus("Pickup Scheduled")).toBe("packed");
      expect(mapBigshipStatus("Manifested")).toBe("packed");
      expect(mapBigshipStatus("Item Ready")).toBe("packed");
    });

    it("maps RTO and undelivered statuses to returned", () => {
      expect(mapBigshipStatus("RTO DELIVERED")).toBe("returned");
      expect(mapBigshipStatus("RTO In-Transit")).toBe("returned");
      expect(mapBigshipStatus("Undelivered")).toBe("returned");
      expect(mapBigshipStatus("Lost")).toBe("returned");
    });

    it("defaults to placed for null, undefined, or empty statuses", () => {
      expect(mapBigshipStatus(null)).toBe("placed");
      expect(mapBigshipStatus(undefined)).toBe("placed");
      expect(mapBigshipStatus("")).toBe("placed");
      expect(mapBigshipStatus("Unknown Status")).toBe("placed");
    });
  });

  describe("fetchBigshipTracking", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("rejects empty tracking ID without network call", async () => {
      const res = await fetchBigshipTracking("");
      expect(res.success).toBe(false);
      expect(res.error).toContain("empty");
      expect(res.checkpoints).toEqual([]);
    });

    it("parses valid Bigship tracking API response correctly", async () => {
      const mockApiResponse = {
        success: true,
        data: {
          CustomGlobalOrderId: "526665382",
          order_place_time: "2026-11-12T00:15:49.964000Z",
          tracking_number: "SF4384997017BIH",
          courier_name: "Shadowfax 2kg",
          courier_image: "https://storage.bigship.direct/files/1764331978_66.svg",
          tag: "IN-TRANSIT",
          order_status: "IN-TRANSIT",
          latest_checkpoint_time: "2026-11-12T11:23:46.000000Z",
          date_expected_delivery: "",
          date_promised_delivery: "11-11-2026 18:30:00",
          last_scan: "14-11-2026 18:16:06",
          checkpoints: [
            {
              location: "OneNCR DC",
              tag: "In-Transit",
              order_status: "In-Transit",
              checkpoint_time: "2026-11-12T11:23:46.000000Z",
              message: "Item Received at dc at OneNCR DC",
            },
            {
              location: "DEL_RohiniNew_FM",
              tag: "Pickup Scheduled",
              order_status: "Pickup Scheduled",
              checkpoint_time: "2026-11-12T00:55:52.000000Z",
              message: "Item Out For Pickup",
            },
          ],
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockApiResponse,
      } as any);

      const res = await fetchBigshipTracking("SF4384997017BIH");

      expect(res.success).toBe(true);
      expect(res.carrier).toBe("Shadowfax 2kg");
      expect(res.rawStatus).toBe("IN-TRANSIT");
      expect(res.mappedStatus).toBe("shipped");
      expect(res.trackingNumber).toBe("SF4384997017BIH");
      expect(res.currentLocation).toBe("OneNCR DC");
      expect(res.estimatedDelivery).toBe("11-11-2026 18:30:00");
      expect(res.checkpoints.length).toBe(2);
      expect(res.checkpoints[0].location).toBe("OneNCR DC");
    });

    it("handles 404 not found cleanly", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ status: "Failed", message: "Order not found." }),
      } as any);

      const res = await fetchBigshipTracking("INVALID_AWB_999");
      expect(res.success).toBe(false);
      expect(res.error).toContain("INVALID_AWB_999");
    });

    it("handles network failure gracefully", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network connection lost"));

      const res = await fetchBigshipTracking("SF4384997017BIH");
      expect(res.success).toBe(false);
      expect(res.error).toBe("Network connection lost");
    });
  });
});

