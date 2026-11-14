import { MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useStoreSettings } from "@/hooks/useStoreSettings";

const DEFAULT_MESSAGE = "Hi! I have a question about UVEDIQ · Leaf & Kernel products.";

const WhatsAppButton = () => {
  const { settings } = useStoreSettings();
  const rawNumber = settings.whatsapp_number || "918796745590";
  const formattedNumber = rawNumber.replace(/\D/g, "");
  const url = `https://wa.me/${formattedNumber}?text=${encodeURIComponent(DEFAULT_MESSAGE)}`;
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => setChatOpen(!!(e as CustomEvent).detail?.open);
    window.addEventListener("leafy-chat-open", handler);
    return () => window.removeEventListener("leafy-chat-open", handler);
  }, []);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`fixed right-3 z-50 flex items-center gap-2 rounded-full bg-[#25D366] px-3.5 py-3 text-white shadow-lg transition-all duration-300 group hover:scale-105 hover:shadow-xl md:right-6 ${
        chatOpen ? "bottom-[78vh] lg:bottom-6" : "bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:bottom-6"
      }`}
      aria-label="Chat on WhatsApp"
    >
      <MessageCircle className="h-5 w-5" />
      <span className={`text-sm font-semibold hidden sm:inline ${chatOpen ? "sm:inline" : ""}`}>Chat with us</span>
    </a>
  );
};

export default WhatsAppButton;
