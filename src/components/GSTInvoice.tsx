import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";

interface InvoiceItem {
  product_name: string;
  quantity: number;
  price: number;
  product_image?: string | null;
}

interface InvoiceProps {
  order: {
    id: string;
    created_at: string;
    subtotal: number;
    shipping: number;
    discount: number;
    total: number;
    status: string;
    address_snapshot?: any;
  };
  items: InvoiceItem[];
  onClose?: () => void;
}

const GST_RATE = 0.18; // 18% GST
const COMPANY_GSTIN = "29XXXXXXXXXXXXXXX"; // Placeholder
const COMPANY_NAME = "Leaf & Kernel Naturals Pvt. Ltd.";
const COMPANY_ADDRESS = "No. 42, Koramangala, Bengaluru, Karnataka - 560034";

const GSTInvoice = ({ order, items, onClose }: InvoiceProps) => {
  const invoiceRef = useRef<HTMLDivElement>(null);

  const taxableAmount = order.subtotal / (1 + GST_RATE);
  const cgst = (order.subtotal - taxableAmount) / 2;
  const sgst = cgst;
  const invoiceNumber = `LK-${order.id.slice(0, 8).toUpperCase()}`;
  const invoiceDate = new Date(order.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  const address = order.address_snapshot;

  const handlePrint = () => {
    const content = invoiceRef.current;
    if (!content) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Invoice ${invoiceNumber}</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 24px; color: #1a1a1a; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e5e5e5; }
        th { background: #f5f5f5; font-weight: 600; font-size: 12px; text-transform: uppercase; }
        .text-right { text-align: right; }
        .font-bold { font-weight: 700; }
        .text-sm { font-size: 12px; }
        .text-xs { font-size: 11px; }
        .mt-4 { margin-top: 16px; }
        .mb-2 { margin-bottom: 8px; }
        .border-t { border-top: 2px solid #1a1a1a; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        @media print { body { padding: 0; } }
      </style></head><body>
      ${content.innerHTML}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-bold text-lg text-foreground">GST Tax Invoice</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="mr-1.5 h-4 w-4" /> Print
          </Button>
          {onClose && <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>}
        </div>
      </div>

      <div ref={invoiceRef} className="bg-white text-gray-900 p-6 rounded-lg border border-border text-sm">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{COMPANY_NAME}</h2>
            <p className="text-xs text-gray-500 mt-1">{COMPANY_ADDRESS}</p>
            <p className="text-xs text-gray-500">GSTIN: {COMPANY_GSTIN}</p>
          </div>
          <div className="text-right">
            <p className="font-bold text-base">TAX INVOICE</p>
            <p className="text-xs text-gray-500 mt-1">Invoice: {invoiceNumber}</p>
            <p className="text-xs text-gray-500">Date: {invoiceDate}</p>
          </div>
        </div>

        <hr className="my-4 border-gray-300" />

        {/* Bill To / Ship To */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Bill To</p>
            {address ? (
              <>
                <p className="font-medium">{address.full_name}</p>
                <p className="text-xs text-gray-600">{address.address_line1}</p>
                {address.address_line2 && <p className="text-xs text-gray-600">{address.address_line2}</p>}
                <p className="text-xs text-gray-600">{address.city}, {address.state} - {address.pincode}</p>
                {address.phone && <p className="text-xs text-gray-600">Phone: {address.phone}</p>}
              </>
            ) : (
              <p className="text-xs text-gray-400">Address not available</p>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Order Details</p>
            <p className="text-xs text-gray-600">Order ID: {order.id.slice(0, 8)}...</p>
            <p className="text-xs text-gray-600">Status: <span className="capitalize font-medium">{order.status}</span></p>
            <p className="text-xs text-gray-600">Payment: Razorpay (Online)</p>
          </div>
        </div>

        {/* Items Table */}
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="py-2 px-3 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
              <th className="py-2 px-3 text-left text-xs font-semibold text-gray-500 uppercase">Item</th>
              <th className="py-2 px-3 text-left text-xs font-semibold text-gray-500 uppercase">HSN</th>
              <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 uppercase">Qty</th>
              <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 uppercase">Rate</th>
              <th className="py-2 px-3 text-right text-xs font-semibold text-gray-500 uppercase">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-2 px-3 text-gray-500">{i + 1}</td>
                <td className="py-2 px-3 font-medium">{item.product_name}</td>
                <td className="py-2 px-3 text-gray-500">2106</td>
                <td className="py-2 px-3 text-right">{item.quantity}</td>
                <td className="py-2 px-3 text-right">₹{Number(item.price).toFixed(2)}</td>
                <td className="py-2 px-3 text-right font-medium">₹{(Number(item.price) * item.quantity).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mt-4">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>₹{Number(order.subtotal).toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Taxable Amount</span><span>₹{taxableAmount.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">CGST (9%)</span><span>₹{cgst.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">SGST (9%)</span><span>₹{sgst.toFixed(2)}</span></div>
            {Number(order.shipping) > 0 && (
              <div className="flex justify-between"><span className="text-gray-500">Shipping</span><span>₹{Number(order.shipping).toFixed(2)}</span></div>
            )}
            {Number(order.discount) > 0 && (
              <div className="flex justify-between"><span className="text-gray-500">Discount</span><span className="text-green-600">-₹{Number(order.discount).toFixed(2)}</span></div>
            )}
            <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-300">
              <span>Total</span><span>₹{Number(order.total).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-200 text-xs text-gray-400 text-center">
          <p>This is a computer-generated invoice and does not require a signature.</p>
          <p className="mt-1">Thank you for shopping with Leaf & Kernel!</p>
        </div>
      </div>
    </div>
  );
};

export default GSTInvoice;
