import { MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";

const WHATSAPP_NUMBER = "918796745590";
const DEFAULT_MESSAGE = "Hi! I have a question about UVEDIQ · Leaf & Kernel products.";

const WhatsAppButton = () => {
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(DEFAULT_MESSAGE)}`;
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
      className={`fixed right-6 z-50 flex items-center gap-2 bg-[#25D366] text-white pl-4 pr-5 py-3 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 group ${
        chatOpen ? "bottom-[78vh] sm:bottom-6" : "bottom-6"
      }`}
      aria-label="Chat on WhatsApp"
    >
      <MessageCircle className="h-5 w-5" />
      <span className={`text-sm font-semibold hidden sm:inline ${chatOpen ? "sm:inline" : ""}`}>Chat with us</span>
    </a>
  );
};

export default WhatsAppButton;
