-- ==============================================================================
-- LEAF & KERNEL / UVEDIQ PRODUCTION SUPABASE DATABASE SYNC
-- Run this script in: https://supabase.com/dashboard/project/zqumclyhsgzjolbgfcwa/sql
-- ==============================================================================

BEGIN;

-- 1. Ensure Categories Exist
INSERT INTO public.categories (id, name, slug, description, image_url)
VALUES
  ('11111111-1111-1111-1111-111111111101', 'Ayurvedic Powders', 'ayurvedic-powders', 'Pure herbal single-origin powders for daily wellness', 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=600&q=80'),
  ('11111111-1111-1111-1111-111111111102', 'Herbal Capsules', 'herbal-capsules', 'Convenient standardized herbal extracts in vegetarian capsules', 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80'),
  ('11111111-1111-1111-1111-111111111103', 'Superfoods & Snacks', 'superfoods-snacks', 'Nutrient-dense Ayurvedic superfoods and healthy snacks', 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=600&q=80')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  description = EXCLUDED.description;

-- 2. Upsert the 4 Authentic UVEDIQ Products
INSERT INTO public.products (
  id, name, slug, short_description, description, ingredients, how_to_use, benefits,
  price, original_price, category_id, image_url, gallery_urls, badge, rating, review_count, stock_quantity, is_active, is_featured
) VALUES
(
  '44444444-4444-4444-4444-444444444401',
  'UVEDIQ Ashwagandha Powder Capsules',
  'uvediq-ashwagandha-powder-capsules',
  'UVEDIQ Ashwagandha Root Powder Capsules — a convenient way to include a traditional Ayurvedic herb in your wellness routine.',
  'Rooted in Ayurveda. Made for your everyday wellness. Discover UVEDIQ Ashwagandha Powder Capsules, made with Ashwagandha root powder in a convenient capsule format. Ashwagandha (Withania somnifera) is a traditional Ayurvedic herb, and these capsules are designed for convenient use as part of your daily routine. With a vegetarian capsule shell and 500 mg of Ashwagandha root powder per capsule, this supplement offers a simple and reliable way to make an ancient botanical a part of your modern wellness lifestyle.',
  'Ashwagandha Root Powder (Withania somnifera) — 500 mg per capsule. Vegetarian Capsule Shell.',
  '1 or 2 Capsules daily or As directed by your physician.',
  'Made with pure Ashwagandha root powder. Convenient capsule format for everyday use. Vegetarian capsule shell. Contains Ashwagandha, a traditional Ayurvedic herb revered for vitality, stress balance, and calm.',
  265.00,
  499.00,
  '11111111-1111-1111-1111-111111111102',
  '/images/products/uvediq-ashwagandha-capsules-hero.jpg',
  ARRAY[
    '/images/products/uvediq-ashwagandha-capsules-bottle.jpg',
    '/images/products/uvediq-ashwagandha-capsules-lifestyle-sleep.jpg',
    '/images/products/uvediq-ashwagandha-capsules-meditation-stress.jpg',
    '/images/products/uvediq-ashwagandha-capsules-nutrition-label.jpg'
  ],
  'Best Seller',
  4.9,
  86,
  150,
  true,
  true
),
(
  '44444444-4444-4444-4444-444444444402',
  'UVEDIQ Jumbo Phool Makhana 200g',
  'uvediq-jumbo-phool-makhana-200g',
  'Uvediq Jumbo Phool Makhana (Fox Nuts) 200g | 6+ Sutta Extra Large Handpicked Makhana | Premium Jumbo Lotus Seeds | Vacuum Packed | Healthy Crunchy Snack | Gluten Free',
  'Uvediq Jumbo Phool Makhana (Fox Nuts) 200g | 6+ Sutta Extra Large Handpicked Makhana | Premium Jumbo Lotus Seeds | Vacuum Packed | Healthy Crunchy Snack | Gluten Free. Handpicked for maximum size, natural crunch, and nutrient density. Perfect for guilt-free everyday snacking, fasting, or light roasting with pure desi ghee.',
  '100% Raw Phool Makhana (Fox Nuts)',
  'Ready to eat as a crunchy snack, roast lightly in ghee with rock salt and herbs, or add to wholesome curries and desserts.',
  '6+ Sutta Extra Large Handpicked Makhana. Vacuum packed for freshness and crisp texture. Rich in plant protein, dietary fiber, calcium, and natural antioxidants. Low glycemic index and naturally gluten free.',
  249.00,
  399.00,
  '11111111-1111-1111-1111-111111111103',
  '/images/products/uvediq-jumbo-makhana-pack.png',
  ARRAY[
    '/images/products/uvediq-jumbo-makhana-size-comparison.png',
    '/images/products/uvediq-jumbo-makhana-lifestyle.jpg',
    '/images/products/uvediq-jumbo-makhana-benefits.png'
  ],
  'Top Rated',
  4.95,
  112,
  120,
  true,
  true
),
(
  '44444444-4444-4444-4444-444444444403',
  'UVEDIQ Moringa Powder 200g',
  'uvediq-moringa-powder-200g',
  'Premium Moringa Leaf Powder — a versatile plant-based addition to your everyday nutrition routine.',
  'Nature’s Green Goodness. Packed with Plant-Based Nutrition. Bring the goodness of moringa leaves into your everyday routine with UVEDIQ Premium Moringa Powder. Made from moringa leaf powder, this versatile green powder is a convenient way to add a plant-based ingredient to your daily diet. Moringa leaves are naturally rich in various nutrients and contain plant compounds with antioxidant properties. Moringa powder can be included as part of a varied, balanced diet and a healthy lifestyle.',
  'Moringa Leaf Powder — 100%',
  '1. Mix the recommended serving of moringa powder into a glass of water. 2. Add it to your favourite smoothie or juice. 3. Mix into soups or other suitable recipes as part of a balanced diet.',
  '1. Naturally Occurring Nutrients – Moringa leaves contain naturally occurring vitamins, minerals and other plant compounds. 2. Antioxidant Properties – Moringa leaves contain plant compounds with antioxidant activity. 3. Plant-Based Nutrition – A convenient plant-based ingredient to include in a varied, balanced diet. 4. Everyday Wellness – Easily incorporated into your daily food and drink routine. 5. Versatile and Easy to Use – Suitable for mixing into drinks, smoothies and selected recipes.',
  225.00,
  350.00,
  '11111111-1111-1111-1111-111111111101',
  '/images/products/uvediq-moringa-powder-front.png',
  ARRAY[
    '/images/products/uvediq-moringa-powder-benefits.jpg',
    '/images/products/uvediq-moringa-powder-lifestyle.jpg',
    '/images/products/uvediq-moringa-powder-quality.jpg',
    '/images/products/uvediq-moringa-powder-nutrition.png'
  ],
  'New Launch',
  4.9,
  45,
  100,
  true,
  true
),
(
  '44444444-4444-4444-4444-444444444404',
  'UVEDIQ Wheatgrass Powder 200g',
  'uvediq-wheatgrass-powder-200g',
  'Premium Wheatgrass Powder — a convenient green addition to your everyday nutrition routine.',
  'Pure Green Goodness. Made for Your Everyday Wellness. Bring the goodness of wheatgrass into your daily routine with UVEDIQ Wheatgrass Powder. Made from wheatgrass and packed in a convenient pouch, it is easy to mix into water, juice or smoothies. Whether you enjoy it in the morning, blend it into your favourite drink, or include it in your daily nutrition routine, UVEDIQ Wheatgrass Powder offers a simple and versatile way to enjoy a plant-based ingredient.',
  'Wheatgrass Powder — 100%',
  '1. Mix the recommended serving of wheatgrass powder into a glass of water. 2. Add it to your favourite juice or smoothie. 3. Enjoy as part of your daily routine and a balanced diet.',
  '1. Contains Naturally Occurring Plant Compounds – Wheatgrass contains various naturally occurring plant nutrients and compounds. 2. Antioxidant Properties – Wheatgrass contains plant compounds that have shown antioxidant activity. 3. Supports Everyday Nutrition – Can be included in a varied and balanced diet. 4. Convenient Daily Nutrition – Easy to mix into water, juice or smoothies. 5. Versatile and Easy to Use – A simple way to add a green plant-based ingredient to your favourite drinks.',
  390.00,
  650.00,
  '11111111-1111-1111-1111-111111111101',
  '/images/products/uvediq-wheatgrass-powder-front.jpg',
  ARRAY[
    '/images/products/uvediq-wheatgrass-powder-benefits.jpg',
    '/images/products/uvediq-wheatgrass-powder-lifestyle.jpg',
    '/images/products/uvediq-wheatgrass-powder-quality.jpg',
    '/images/products/uvediq-wheatgrass-powder-nutrition.png'
  ],
  'Superfood Hero',
  4.92,
  58,
  100,
  true,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  description = EXCLUDED.description,
  ingredients = EXCLUDED.ingredients,
  how_to_use = EXCLUDED.how_to_use,
  benefits = EXCLUDED.benefits,
  price = EXCLUDED.price,
  original_price = EXCLUDED.original_price,
  category_id = EXCLUDED.category_id,
  image_url = EXCLUDED.image_url,
  gallery_urls = EXCLUDED.gallery_urls,
  badge = EXCLUDED.badge,
  stock_quantity = EXCLUDED.stock_quantity,
  is_active = true,
  is_featured = true;

-- 3. Deactivate all other dummy products so ONLY these 4 are shown in the Shop
UPDATE public.products
SET is_active = false
WHERE slug NOT IN (
  'uvediq-ashwagandha-powder-capsules',
  'uvediq-jumbo-phool-makhana-200g',
  'uvediq-moringa-powder-200g',
  'uvediq-wheatgrass-powder-200g'
);

COMMIT;
