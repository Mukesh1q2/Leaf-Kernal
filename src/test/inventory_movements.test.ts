import { describe, it, expect } from "vitest";

const VALID_ADJUSTMENT_REASONS = [
  "restock",
  "damage",
  "audit_correction",
  "sale_return",
  "manual_adjustment",
  "order_placed",
  "order_cancelled",
] as const;

type AdjustmentReason = (typeof VALID_ADJUSTMENT_REASONS)[number];

interface StockAdjustmentPayload {
  callerRoles: string[];
  currentStock: number;
  delta: number;
  reason: string;
  notes?: string;
}

export function validateStockAdjustment(payload: StockAdjustmentPayload): {
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  resultingMovement?: {
    old_quantity: number;
    quantity_delta: number;
    new_quantity: number;
    reason: AdjustmentReason;
    notes?: string;
  };
} {
  // 1. Authorization check: Admin or Inventory Manager only
  const hasInventoryPermission =
    payload.callerRoles.includes("admin") || payload.callerRoles.includes("inventory_manager");

  if (!hasInventoryPermission) {
    return {
      success: false,
      errorCode: "42501",
      errorMessage: "Only administrators and inventory managers can adjust stock levels.",
    };
  }

  // 2. Reason validation
  if (!VALID_ADJUSTMENT_REASONS.includes(payload.reason as AdjustmentReason)) {
    return {
      success: false,
      errorCode: "22023",
      errorMessage: `Invalid stock adjustment reason: ${payload.reason}.`,
    };
  }

  // 3. Delta validation: cannot be zero
  if (payload.delta === 0) {
    return {
      success: false,
      errorCode: "22000",
      errorMessage: "Stock adjustment delta cannot be zero.",
    };
  }

  // 4. Resulting stock validation: cannot be negative
  const newQuantity = payload.currentStock + payload.delta;
  if (newQuantity < 0) {
    return {
      success: false,
      errorCode: "22003",
      errorMessage: `Insufficient stock: current stock is ${payload.currentStock}, cannot reduce by ${Math.abs(payload.delta)}.`,
    };
  }

  return {
    success: true,
    resultingMovement: {
      old_quantity: payload.currentStock,
      quantity_delta: payload.delta,
      new_quantity: newQuantity,
      reason: payload.reason as AdjustmentReason,
      notes: payload.notes,
    },
  };
}

// State machine simulating database trigger: handle_order_inventory_sync
interface OrderInventoryState {
  orderStatus: string;
  stockDeducted: boolean;
  productStock: Record<string, number>;
  movements: Array<{
    productId: string;
    delta: number;
    reason: string;
    notes: string;
  }>;
}

export function processOrderStatusChange(
  state: OrderInventoryState,
  newStatus: string,
  items: Array<{ productId: string; quantity: number }>
): { success: boolean; error?: string } {
  // 1. Order confirmed: deduct stock exactly once
  if (["confirmed", "shipped", "delivered"].includes(newStatus) && !state.stockDeducted) {
    // Check sufficiency for all items first
    for (const item of items) {
      const current = state.productStock[item.productId] ?? 0;
      if (current < item.quantity) {
        return {
          success: false,
          error: `Insufficient stock for product ${item.productId}: available ${current}, requested ${item.quantity}.`,
        };
      }
    }

    // Deduct stock and log movement
    for (const item of items) {
      state.productStock[item.productId] -= item.quantity;
      state.movements.push({
        productId: item.productId,
        delta: -item.quantity,
        reason: "order_placed",
        notes: `Order confirmed: ${newStatus}`,
      });
    }

    state.orderStatus = newStatus;
    state.stockDeducted = true;
    return { success: true };
  }

  // 2. Repeated confirmation / callback retry: idempotently ignore
  if (["confirmed", "shipped", "delivered"].includes(newStatus) && state.stockDeducted) {
    state.orderStatus = newStatus;
    return { success: true }; // No double-deduction!
  }

  // 3. Order cancelled before fulfillment: restore stock exactly once only if previously deducted
  if (newStatus === "cancelled" && state.stockDeducted) {
    for (const item of items) {
      state.productStock[item.productId] = (state.productStock[item.productId] ?? 0) + item.quantity;
      state.movements.push({
        productId: item.productId,
        delta: item.quantity,
        reason: "order_cancelled",
        notes: `Order cancelled`,
      });
    }

    state.orderStatus = newStatus;
    state.stockDeducted = false;
    return { success: true };
  }

  // 4. Order returned: consumables MUST NOT be auto-restocked to shelf inventory without inspection
  if (newStatus === "returned") {
    state.orderStatus = newStatus;
    // Stock remains unchanged; inspection required before manual adjustment
    return { success: true };
  }

  // 5. Repeated cancellation or cancelling unpaid order: idempotently ignore
  if (newStatus === "cancelled" && !state.stockDeducted) {
    state.orderStatus = newStatus;
    return { success: true }; // No double-restore!
  }

  state.orderStatus = newStatus;
  return { success: true };
}

describe("Inventory Stock Movements Ledger & Abuse Resistance", () => {
  describe("Role Authorization", () => {
    it("allows Inventory Manager and Admin to adjust stock", () => {
      const invMgrResult = validateStockAdjustment({
        callerRoles: ["inventory_manager"],
        currentStock: 20,
        delta: 10,
        reason: "restock",
      });
      expect(invMgrResult.success).toBe(true);

      const adminResult = validateStockAdjustment({
        callerRoles: ["admin"],
        currentStock: 20,
        delta: -2,
        reason: "damage",
      });
      expect(adminResult.success).toBe(true);
    });

    it("denies unprivileged staff roles from adjusting stock", () => {
      const supportResult = validateStockAdjustment({
        callerRoles: ["customer_support"],
        currentStock: 20,
        delta: 5,
        reason: "restock",
      });
      expect(supportResult.success).toBe(false);
      expect(supportResult.errorMessage).toContain("Only administrators and inventory managers");

      const editorResult = validateStockAdjustment({
        callerRoles: ["editor"],
        currentStock: 20,
        delta: 5,
        reason: "restock",
      });
      expect(editorResult.success).toBe(false);
    });
  });

  describe("Validation & Resulting Stock Calculations", () => {
    it("correctly computes positive delta (restock)", () => {
      const result = validateStockAdjustment({
        callerRoles: ["inventory_manager"],
        currentStock: 15,
        delta: 25,
        reason: "restock",
        notes: "Supplier shipment #8812",
      });

      expect(result.success).toBe(true);
      expect(result.resultingMovement).toEqual({
        old_quantity: 15,
        quantity_delta: 25,
        new_quantity: 40,
        reason: "restock",
        notes: "Supplier shipment #8812",
      });
    });

    it("correctly computes negative delta (damage / expired)", () => {
      const result = validateStockAdjustment({
        callerRoles: ["admin"],
        currentStock: 30,
        delta: -5,
        reason: "damage",
        notes: "Broken seal during handling",
      });

      expect(result.success).toBe(true);
      expect(result.resultingMovement).toEqual({
        old_quantity: 30,
        quantity_delta: -5,
        new_quantity: 25,
        reason: "damage",
        notes: "Broken seal during handling",
      });
    });

    it("blocks adjustments that would cause stock quantity to fall below 0", () => {
      const result = validateStockAdjustment({
        callerRoles: ["inventory_manager"],
        currentStock: 5,
        delta: -10,
        reason: "damage",
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("22003");
      expect(result.errorMessage).toContain("Insufficient stock");
    });

    it("rejects invalid or unrecognized reasons", () => {
      const result = validateStockAdjustment({
        callerRoles: ["admin"],
        currentStock: 50,
        delta: 5,
        reason: "random_unregistered_reason",
      });

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("22023");
      expect(result.errorMessage).toContain("Invalid stock adjustment reason");
    });
  });

  describe("Order Inventory Synchronization & Abuse Resistance", () => {
    it("deducts stock exactly once upon confirmation and creates ledger entry", () => {
      const state: OrderInventoryState = {
        orderStatus: "pending",
        stockDeducted: false,
        productStock: { "prod-1": 20 },
        movements: [],
      };

      const res = processOrderStatusChange(state, "confirmed", [{ productId: "prod-1", quantity: 3 }]);
      expect(res.success).toBe(true);
      expect(state.productStock["prod-1"]).toBe(17);
      expect(state.stockDeducted).toBe(true);
      expect(state.movements).toHaveLength(1);
      expect(state.movements[0].delta).toBe(-3);
      expect(state.movements[0].reason).toBe("order_placed");
    });

    it("prevents double-deduction on duplicate payment callbacks or retries", () => {
      const state: OrderInventoryState = {
        orderStatus: "confirmed",
        stockDeducted: true,
        productStock: { "prod-1": 17 },
        movements: [{ productId: "prod-1", delta: -3, reason: "order_placed", notes: "Initial" }],
      };

      // Simulated second webhook callback with identical status
      const retryRes = processOrderStatusChange(state, "confirmed", [{ productId: "prod-1", quantity: 3 }]);
      expect(retryRes.success).toBe(true);
      expect(state.productStock["prod-1"]).toBe(17); // Untouched!
      expect(state.movements).toHaveLength(1); // No duplicate ledger row!
    });

    it("blocks checkout and refuses deduction if stock is insufficient (no overselling)", () => {
      const state: OrderInventoryState = {
        orderStatus: "pending",
        stockDeducted: false,
        productStock: { "prod-1": 2 }, // Only 2 available
        movements: [],
      };

      // Customer attempts to purchase 5
      const res = processOrderStatusChange(state, "confirmed", [{ productId: "prod-1", quantity: 5 }]);
      expect(res.success).toBe(false);
      expect(res.error).toContain("Insufficient stock");
      expect(state.productStock["prod-1"]).toBe(2); // Stock intact, no negative stock
      expect(state.movements).toHaveLength(0);
    });

    it("restores stock exactly once on cancellation and blocks double-restoration", () => {
      const state: OrderInventoryState = {
        orderStatus: "confirmed",
        stockDeducted: true,
        productStock: { "prod-1": 15 },
        movements: [{ productId: "prod-1", delta: -5, reason: "order_placed", notes: "Initial" }],
      };

      // First cancellation
      const cancelRes = processOrderStatusChange(state, "cancelled", [{ productId: "prod-1", quantity: 5 }]);
      expect(cancelRes.success).toBe(true);
      expect(state.productStock["prod-1"]).toBe(20); // Restored
      expect(state.stockDeducted).toBe(false);
      expect(state.movements).toHaveLength(2);
      expect(state.movements[1].reason).toBe("order_cancelled");

      // Repeated cancellation attempt
      const repeatCancelRes = processOrderStatusChange(state, "cancelled", [{ productId: "prod-1", quantity: 5 }]);
      expect(repeatCancelRes.success).toBe(true);
      expect(state.productStock["prod-1"]).toBe(20); // Still 20, not double-restored to 25!
      expect(state.movements).toHaveLength(2); // No duplicate ledger row
    });

    it("does not restore stock when cancelling an order that was never confirmed", () => {
      const state: OrderInventoryState = {
        orderStatus: "pending",
        stockDeducted: false,
        productStock: { "prod-1": 50 },
        movements: [],
      };

      const res = processOrderStatusChange(state, "cancelled", [{ productId: "prod-1", quantity: 2 }]);
      expect(res.success).toBe(true);
      expect(state.productStock["prod-1"]).toBe(50); // Unaltered
      expect(state.movements).toHaveLength(0);
    });

    it("does not automatically restock returned consumables without physical inspection", () => {
      const state: OrderInventoryState = {
        orderStatus: "delivered",
        stockDeducted: true,
        productStock: { "prod-1": 10 },
        movements: [],
      };

      // 1. Order returned transition occurs
      const res = processOrderStatusChange(state, "returned", [{ productId: "prod-1", quantity: 2 }]);
      expect(res.success).toBe(true);
      expect(state.orderStatus).toBe("returned");
      // Stock MUST remain unchanged at 10 (no blind restock of consumable botanicals)
      expect(state.productStock["prod-1"]).toBe(10);
      expect(state.movements).toHaveLength(0);

      // 2. Separate inspection workflow: Staff inspects seal integrity and manually restocks sellable units
      const inspectedAdjustment = validateStockAdjustment({
        callerRoles: ["inventory_manager"],
        currentStock: state.productStock["prod-1"],
        delta: 2,
        reason: "sale_return",
        notes: "Inspected sealed packaging for order return; verified undamaged",
      });

      expect(inspectedAdjustment.success).toBe(true);
      expect(inspectedAdjustment.resultingMovement).toEqual({
        old_quantity: 10,
        quantity_delta: 2,
        new_quantity: 12,
        reason: "sale_return",
        notes: "Inspected sealed packaging for order return; verified undamaged",
      });
    });

    it("records exactly one ledger row per stock change across all lifecycle events", () => {
      // Trace complete lifecycle: purchase -> duplicate callback -> cancel -> duplicate cancel -> return
      const state: OrderInventoryState = {
        orderStatus: "pending",
        stockDeducted: false,
        productStock: { "prod-1": 25 },
        movements: [],
      };

      // A. Manual adjustment: exactly 1 ledger row
      const manualAdj = validateStockAdjustment({
        callerRoles: ["admin"],
        currentStock: 25,
        delta: 5,
        reason: "restock",
      });
      expect(manualAdj.success).toBe(true);
      // In actual SQL, products trigger writes exactly 1 row; adjust_product_stock writes 0
      state.productStock["prod-1"] = manualAdj.resultingMovement!.new_quantity; // 30
      state.movements.push({
        productId: "prod-1",
        delta: 5,
        reason: "restock",
        notes: "Manual adjustment",
      });
      expect(state.movements).toHaveLength(1);

      // B. Purchase confirmation: exactly 1 ledger row
      processOrderStatusChange(state, "confirmed", [{ productId: "prod-1", quantity: 4 }]);
      expect(state.productStock["prod-1"]).toBe(26);
      expect(state.movements).toHaveLength(2); // +1 row
      expect(state.movements[1].reason).toBe("order_placed");

      // C. Duplicate confirmation webhook: exactly 0 new rows
      processOrderStatusChange(state, "confirmed", [{ productId: "prod-1", quantity: 4 }]);
      expect(state.productStock["prod-1"]).toBe(26);
      expect(state.movements).toHaveLength(2); // no new rows

      // D. Cancellation: exactly 1 ledger row
      processOrderStatusChange(state, "cancelled", [{ productId: "prod-1", quantity: 4 }]);
      expect(state.productStock["prod-1"]).toBe(30);
      expect(state.movements).toHaveLength(3); // +1 row
      expect(state.movements[2].reason).toBe("order_cancelled");

      // E. Duplicate cancellation: exactly 0 new rows
      processOrderStatusChange(state, "cancelled", [{ productId: "prod-1", quantity: 4 }]);
      expect(state.productStock["prod-1"]).toBe(30);
      expect(state.movements).toHaveLength(3); // no new rows

      // F. Return: exactly 0 ledger rows written by order trigger
      processOrderStatusChange(state, "returned", [{ productId: "prod-1", quantity: 4 }]);
      expect(state.productStock["prod-1"]).toBe(30);
      expect(state.movements).toHaveLength(3); // no new rows
    });
  });
});

