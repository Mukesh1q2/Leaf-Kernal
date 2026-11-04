export interface TestimonialItem {
  id: string;
  name: string;
  city: string | null;
  product: string | null;
  quote: string;
  rating: number;
  photo_url: string | null;
  sort_order: number;
  is_verified?: boolean | null;
}

export const CURATED_FALLBACK_TESTIMONIALS: TestimonialItem[] = [
  {
    id: "curated-1",
    name: "Dr. Ananya Sen",
    city: "Bengaluru, KA",
    product: "Organic Moringa Leaf Powder",
    quote: "Integrating Leaf & Kernel moringa into my morning smoothies has become a non-negotiable ritual. Clean, vibrant, and visibly potent without fillers.",
    rating: 5,
    photo_url: null,
    sort_order: 1,
    is_verified: true,
  },
  {
    id: "curated-2",
    name: "Vikram Malhotra",
    city: "Mumbai, MH",
    product: "Ashwagandha KSM-66 Root",
    quote: "Noticeable improvement in sleep depth and recovery after evening workouts. Excellent lab testing transparency and sustainable amber packaging.",
    rating: 5,
    photo_url: null,
    sort_order: 2,
    is_verified: true,
  },
  {
    id: "curated-3",
    name: "Ritika Sharma",
    city: "Delhi NCR",
    product: "Cold-Pressed Flaxseed Oil",
    quote: "Pure earthy aroma and no rancidity. You can genuinely taste the fresh artisanal kernel press compared to supermarket shelf alternatives.",
    rating: 5,
    photo_url: null,
    sort_order: 3,
    is_verified: false,
  },
];
