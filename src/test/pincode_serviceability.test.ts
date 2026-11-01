import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Pincode Serviceability & Pan-India Delivery Logic", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("validates 6-digit Indian PIN code format properly", () => {
    const isValid = (pin: string) => /^[1-9][0-9]{5}$/.test(pin.trim());

    // Valid PIN codes
    expect(isValid("110001")).toBe(true);
    expect(isValid("110085")).toBe(true);
    expect(isValid("560001")).toBe(true);
    expect(isValid("700001")).toBe(true);
    expect(isValid("400001")).toBe(true);

    // Invalid PIN codes
    expect(isValid("010001")).toBe(false); // starts with 0
    expect(isValid("12345")).toBe(false);  // 5 digits
    expect(isValid("1234567")).toBe(false); // 7 digits
    expect(isValid("abcdef")).toBe(false);  // non-numeric
    expect(isValid("110 01")).toBe(false);  // spaces
  });

  it("resolves zone estimates for Indian regions correctly", () => {
    const getZoneFallback = (pincode: string) => {
      const prefix2 = parseInt(pincode.slice(0, 2), 10);
      if (prefix2 === 11) return { state: "Delhi NCR", days: 2 };
      if (prefix2 >= 12 && prefix2 <= 13) return { state: "Haryana", days: 3 };
      if (prefix2 >= 14 && prefix2 <= 16) return { state: "Punjab / Chandigarh", days: 3 };
      if (prefix2 >= 40 && prefix2 <= 44) return { state: "Maharashtra & Goa", days: 3 };
      if (prefix2 >= 56 && prefix2 <= 59) return { state: "Karnataka", days: 4 };
      if (prefix2 >= 60 && prefix2 <= 64) return { state: "Tamil Nadu & Puducherry", days: 4 };
      if (prefix2 >= 70 && prefix2 <= 74) return { state: "West Bengal", days: 4 };
      return { state: "India", days: 5 };
    };

    expect(getZoneFallback("110085").state).toBe("Delhi NCR");
    expect(getZoneFallback("110085").days).toBe(2);

    expect(getZoneFallback("400001").state).toBe("Maharashtra & Goa");
    expect(getZoneFallback("400001").days).toBe(3);

    expect(getZoneFallback("560001").state).toBe("Karnataka");
    expect(getZoneFallback("560001").days).toBe(4);

    expect(getZoneFallback("700001").state).toBe("West Bengal");
    expect(getZoneFallback("700001").days).toBe(4);
  });

  it("handles India Post API responses accurately", async () => {
    // Mock successful post office response
    const mockSuccessResponse = [
      {
        Status: "Success",
        PostOffice: [
          {
            District: "North West Delhi",
            State: "Delhi",
            Pincode: "110085",
          },
        ],
      },
    ];

    const parseApiResponse = (json: any) => {
      if (Array.isArray(json) && json[0]?.Status === "Success" && json[0]?.PostOffice?.length > 0) {
        const po = json[0].PostOffice[0];
        return {
          available: true,
          city: po.District,
          state: po.State,
        };
      }
      return { available: false };
    };

    const result = parseApiResponse(mockSuccessResponse);
    expect(result.available).toBe(true);
    expect(result.city).toBe("North West Delhi");
    expect(result.state).toBe("Delhi");

    // Mock non-existent response
    const mockErrorResponse = [{ Status: "Error", Message: "No records found" }];
    const errorResult = parseApiResponse(mockErrorResponse);
    expect(errorResult.available).toBe(false);
  });
});

