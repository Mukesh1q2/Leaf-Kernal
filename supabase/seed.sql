-- ==============================================================================
-- Leaf & Kernel (UVEDIQ) Seed Data for Local Development & Testing
-- ==============================================================================

-- 1. Master Admin User in auth.users
DO $$
DECLARE
  v_user_id uuid := 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'mukesh1q2@gmail.com') THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      email_change_token_current,
      reauthentication_token,
      phone_change,
      phone_change_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      'mukesh1q2@gmail.com',
      crypt('TestPass123!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Mukesh Admin"}',
      now(),
      now(),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      ''
    );
  ELSE
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'mukesh1q2@gmail.com';
    UPDATE auth.users
    SET 
      encrypted_password = crypt('TestPass123!', gen_salt('bf')),
      email_confirmed_at = now(),
      confirmation_token = '',
      recovery_token = '',
      email_change_token_new = '',
      email_change = '',
      email_change_token_current = '',
      reauthentication_token = ''
    WHERE id = v_user_id;
  END IF;

  -- Ensure auth identity exists for password login
  INSERT INTO auth.identities (
    id,
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    v_user_id,
    v_user_id::text,
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', 'mukesh1q2@gmail.com', 'email_verified', true),
    'email',
    now(),
    now(),
    now()
  )
  ON CONFLICT (provider_id, provider) DO NOTHING;

  -- Ensure profile exists
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (v_user_id, 'Mukesh Admin')
  ON CONFLICT (user_id) DO UPDATE SET full_name = 'Mukesh Admin';

  -- Grant Master Admin role
  INSERT INTO public.user_roles (user_id, role, is_master)
  VALUES (v_user_id, 'admin', true)
  ON CONFLICT (user_id, role) DO UPDATE SET is_master = true;
END $$;


-- 2. Product Categories
INSERT INTO public.categories (id, name, slug, description, sort_order) VALUES
  ('11111111-1111-1111-1111-111111111101', 'Ayurvedic Powders', 'ayurvedic-powders', '100% natural, single-origin botanical herbs and root powders.', 1),
  ('11111111-1111-1111-1111-111111111102', 'Herbal Capsules', 'herbal-capsules', 'Standardized extracts for potent, convenient daily wellness.', 2),
  ('11111111-1111-1111-1111-111111111103', 'Wellness Teas', 'wellness-teas', 'Handcrafted loose-leaf infusions blended with therapeutic herbs.', 3),
  ('11111111-1111-1111-1111-111111111104', 'Therapeutic Oils', 'therapeutic-oils', 'Cold-pressed classical oils for vitality and nourishing self-care.', 4),
  ('11111111-1111-1111-1111-111111111105', 'Superfood Blends', 'superfood-blends', 'Synergistic adaptogenic formulas for sustained clean energy.', 5),
  ('11111111-1111-1111-1111-111111111106', 'Ghee & Rasayanas', 'ghee-rasayanas', 'Cultured A2 cow ghee infused with potent Ayurvedic botanicals.', 6)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

-- 3. Health Concerns
INSERT INTO public.health_concerns (id, name, slug, description, icon, sort_order) VALUES
  ('22222222-2222-2222-2222-222222222201', 'Digestion & Gut Health', 'digestion-gut-health', 'Support metabolic fire (Agni) and healthy gut microbiome.', 'Activity', 1),
  ('22222222-2222-2222-2222-222222222202', 'Immunity Boost', 'immunity-boost', 'Strengthen natural defenses and seasonal vitality.', 'Shield', 2),
  ('22222222-2222-2222-2222-222222222203', 'Stress & Deep Sleep', 'stress-sleep', 'Soothe the nervous system with calming adaptogens.', 'Moon', 3),
  ('22222222-2222-2222-2222-222222222204', 'Energy & Stamina', 'energy-stamina', 'Sustained endurance without caffeine crashes.', 'Zap', 4),
  ('22222222-2222-2222-2222-222222222205', 'Joint & Muscle Care', 'joint-muscle-care', 'Herbal comfort for joints, flexibility, and physical ease.', 'Heart', 5),
  ('22222222-2222-2222-2222-222222222206', 'Radiant Skin & Hair', 'radiant-skin-hair', 'Detoxify from within for vibrant skin and healthy hair.', 'Sparkles', 6)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

-- 4. Products
INSERT INTO public.products (
  id, name, slug, short_description, description, ingredients, how_to_use, benefits,
  price, original_price, category_id, image_url, badge, rating, review_count, stock_quantity, is_active, is_featured
) VALUES
  (
    '33333333-3333-3333-3333-333333333301',
    'Organic Ashwagandha KSM-66 Root Powder',
    'organic-ashwagandha-ksm66',
    'Premium full-spectrum root extract for stress relief, calm focus, and restorative sleep.',
    'Harvested sustainably from organic roots in Rajasthan. Standardized to 5% withanolides.',
    '100% Organic Ashwagandha (Withania somnifera) Root Powder',
    'Mix 1/2 tsp with warm milk, plant milk, or water before bedtime.',
    'Reduces cortisol levels, promotes calm nervous system, enhances muscle recovery.',
    649.00, 799.00,
    '11111111-1111-1111-1111-111111111101',
    'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?auto=format&fit=crop&w=600&q=80',
    'Best Seller', 4.9, 128, 85, false, false
  ),
  (
    '33333333-3333-3333-3333-333333333302',
    'Wildcrafted Himalayan Shilajit Gold Resin',
    'wildcrafted-himalayan-shilajit-resin',
    'Pure Himalayan grade shilajit rich in fulvic acid, minerals, and cellular revitalizers.',
    'Sourced from 16,000+ ft altitudes in the pristine Himalayas, traditionally purified with Triphala.',
    'Purified Asphaltum Punjabianum (82+ ionic trace minerals, 70% fulvic acid)',
    'Dissolve a pea-sized portion (300-500mg) in warm water or green tea every morning.',
    'Boosts ATP energy, supports cellular stamina, aids nutrient absorption.',
    1299.00, 1599.00,
    '11111111-1111-1111-1111-111111111105',
    'https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&w=600&q=80',
    'Premium', 4.8, 94, 42, false, false
  ),
  (
    '33333333-3333-3333-3333-333333333303',
    'Triphala Bio-Fermented Gut Cleanse Capsules',
    'triphala-gut-cleanse-capsules',
    'Time-tested three-fruit blend (Amla, Haritaki, Bibhitaki) for gentle daily detox and digestion.',
    'Balanced formula that cleanses the digestive tract without disturbing the microbiome.',
    'Amla (Emblica officinalis), Haritaki (Terminalia chebula), Bibhitaki (Terminalia bellirica)',
    'Take 2 capsules with warm water 30 minutes before sleep.',
    'Supports regular bowel movements, cleanses colon, relieves gas and bloating.',
    499.00, 599.00,
    '11111111-1111-1111-1111-111111111102',
    'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80',
    'Popular', 4.7, 76, 120, false, false
  ),
  (
    '33333333-3333-3333-3333-333333333304',
    'Holy Basil Tulsi Sleep & Rest Elixir Tea',
    'tulsi-sleep-rest-tea',
    'Caffeine-free infusion of Krishna, Rama, and Vana Tulsi blended with Chamomile and Cardamom.',
    'Calms mental chatter and prepares mind and body for uninterrupted, deep sleep.',
    'Organic Rama Tulsi, Krishna Tulsi, Vana Tulsi, Chamomile flowers, Green Cardamom',
    'Steep 1 tsp in boiling water for 5 minutes. Enjoy warm in the evening.',
    'Soothes tension headaches, eases restlessness, non-habit forming relaxation.',
    399.00, 499.00,
    '11111111-1111-1111-1111-111111111103',
    'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&w=600&q=80',
    'New', 4.9, 43, 65, false, false
  ),
  (
    '33333333-3333-3333-3333-333333333305',
    'Moringa Supergreen Daily Immunity Tablets',
    'moringa-daily-immunity-tablets',
    'Nature’s complete multivitamin with 92 nutrients, 46 antioxidants, and essential amino acids.',
    'Cold-dehydrated shade-dried organic Moringa Oleifera leaves.',
    '100% Certified Organic Moringa Leaf Extract (Moringa oleifera)',
    'Take 2 tablets twice daily with meals.',
    'Builds immune defense, nourishes skin and eyes, enhances mental clarity.',
    449.00, 549.00,
    '11111111-1111-1111-1111-111111111102',
    'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80',
    NULL, 4.6, 52, 90, false, false
  ),
  (
    '33333333-3333-3333-3333-333333333306',
    'Pure Brahmi Gotu Kola Brain & Focus Tonic',
    'pure-brahmi-focus-tonic',
    'Traditional medhya rasayana to enhance memory, concentration, and calm analytical focus.',
    'Hydro-ethanolic extract of whole Bacopa Monnieri plant with 20% bacosides.',
    'Brahmi (Bacopa monnieri) Whole Plant Extract',
    'Take 1 capsule twice daily with warm water or ghee.',
    'Improves cognitive speed, reduces brain fog, supports cerebral microcirculation.',
    599.00, 749.00,
    '11111111-1111-1111-1111-111111111102',
    'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=600&q=80',
    'Staff Pick', 4.8, 61, 38, false, false
  ),
  (
    '33333333-3333-3333-3333-333333333307',
    'Artisanal A2 Desi Cow Bilona Ghee',
    'a2-desi-cow-bilona-ghee',
    'Crafted from grass-fed Gir cow milk using the ancient wooden churn bilona process.',
    'Golden, aromatic, granular texture rich in butyric acid, omega-3s, and fat-soluble vitamins.',
    '100% Cultured A2 Gir Cow Milk Ghee',
    'Add 1 tsp to warm dal, rotis, or consume empty-stomach with warm water.',
    'Kindles digestive fire (Deepana), lubricates joints, carries nutrients to deep tissues.',
    899.00, 1099.00,
    '11111111-1111-1111-1111-111111111106',
    'https://images.unsplash.com/photo-1628088062854-d1870b4553da?auto=format&fit=crop&w=600&q=80',
    'Heritage', 4.9, 115, 50, false, false
  ),
  (
    '33333333-3333-3333-3333-333333333308',
    'Mahanarayan Joint & Muscle Relief Massage Oil',
    'mahanarayan-joint-relief-oil',
    'Classical taila infused with 54 Ayurvedic herbs to ease stiff joints and sore muscles.',
    'Simmered for 72 hours in pure black sesame oil according to Sahasrayogam scriptures.',
    'Dashamoola, Shatavari, Ashwagandha, Bala, Rasna in pure cold-pressed Til Taila',
    'Warm the oil slightly and massage gently into affected joints in circular motions.',
    'Relieves muscular tension, improves joint mobility, pacifies aggravated Vata dosha.',
    699.00, 849.00,
    '11111111-1111-1111-1111-111111111104',
    'https://images.unsplash.com/photo-1608248597359-22a46587c699?auto=format&fit=crop&w=600&q=80',
    'Therapeutic', 4.7, 88, 25, false, false
  ),
  (
    '77777777-7777-7777-7777-777777777701',
    'UVEDIQ Ashwagandha Powder Capsules',
    'uvediq-ashwagandha-powder-capsules',
    'UVEDIQ Ashwagandha Root Powder Capsules — a convenient way to include a traditional Ayurvedic herb in your wellness routine.',
    'Rooted in Ayurveda. Made for your everyday wellness.

Discover UVEDIQ Ashwagandha Powder Capsules, made with Ashwagandha root powder in a convenient capsule format. Ashwagandha (Withania somnifera) is a traditional Ayurvedic herb, and these capsules are designed for convenient use as part of your daily routine.

With a vegetarian capsule shell, UVEDIQ Ashwagandha Capsules offer a simple and convenient format for those who prefer capsules over loose herbal powders.

Follow the recommended usage instructions on the product label and store the pack in a cool, dry place, away from direct sunlight. Keep out of reach of children.',
    'Ashwagandha Root Powder (Withania somnifera) — 500 mg per capsule
Vegetarian Capsule Shell',
    '1 or 2 Capsules daily or As directed by your physician.',
    '1. Made with Ashwagandha root powder
2. Convenient capsule format for everyday use
3. Vegetarian capsule shell
4. Contains Ashwagandha, a traditional Ayurvedic herb',
    265.00, 499.00,
    '11111111-1111-1111-1111-111111111102',
    '/images/products/uvediq-ashwagandha-capsules-hero.jpg',
    '100% Pure Root Powder', 5.0, 28, 150, true, true
  ),
  (
    '77777777-7777-7777-7777-777777777702',
    'UVEDIQ Jumbo Phool Makhana 200g',
    'uvediq-jumbo-phool-makhana-200g',
    'UVEDIQ Jumbo Phool Makhana (Fox Nuts) 200g | 6+ Sutta Extra Large Handpicked Makhana | Premium Jumbo Lotus Seeds | Vacuum Packed | Healthy Crunchy Snack | Gluten Free',
    'Rooted in Ayurveda. Made for you.

Discover the power of wholesome superfood packed with nature''s goodness. Sourced from the finest lotus seeds and handpicked to 6+ Sutta extra large size, UVEDIQ Jumbo Makhana offers a visibly bigger puff, superior crunch, and dense nutritional value.

Whether it is work breaks, movie nights, evening tea, or family time — every moment deserves a crunch. Low in calories, rich in dietary fiber, and naturally gluten-free, UVEDIQ Jumbo Makhana keeps you feeling light, nourished, and energized throughout the day.

Product Specifications:
• Net Weight: 200g (200.0 Grams)
• Grade: 6+ Sutta Extra Large Handpicked
• Processing: Vacuum Packed Freshness
• Generic Name: Extra Large Fox Nuts / Lotus Seeds
• Manufacturer: Leaf and Kernel Superfoods Co.
• Packer: Uvediq
• Country of Origin: India

Legal Disclaimer:
Actual product packaging and materials may contain more and different information than what is shown on our app or website. We recommend that you do not rely solely on the information presented here and that you always read labels, warnings, and directions before using or consuming a product.',
    '100% Raw Phool Makhana (Fox Nuts)',
    'Ready to eat as a nutritious roasted snack. Lightly roast in A2 cow ghee with a pinch of rock salt, turmeric, or black pepper for an authentic crunchy superfood treat. Ideal for work breaks, movie nights, evening tea, and family snacking.',
    '1. Rich in Nutrients: Provides essential vitamins & minerals like magnesium, potassium, and iron.
2. Supports Heart Health: Helps maintain healthy cholesterol levels and good heart function.
3. Aids Weight Management: Low in calories, high in dietary fibre — keeps you full for longer.
4. Good for Digestion: Rich in fibre, supports a healthy gut and smooth digestion.
5. Boosts Immunity: Contains natural antioxidants that help fight free radicals.
6. 6+ Sutta Extra Large: Bigger size, better crunch, vacuum packed freshness.',
    249.00, 399.00,
    '11111111-1111-1111-1111-111111111105',
    '/images/products/uvediq-jumbo-makhana-pack.png',
    '6+ Sutta Extra Large', 4.9, 36, 120, true, true
  ),
  (
    '77777777-7777-7777-7777-777777777703',
    'UVEDIQ Wheatgrass Powder 200g',
    'uvediq-wheatgrass-powder-200g',
    'Premium Wheatgrass Powder — a convenient green addition to your everyday nutrition routine.',
    'Pure Green Goodness. Made for Your Everyday Wellness.

Bring the goodness of wheatgrass into your daily routine with UVEDIQ Wheatgrass Powder. Made from wheatgrass and packed in a convenient pouch, it is easy to mix into water, juice or smoothies.

Whether you enjoy it in the morning, blend it into your favourite drink, or include it in your daily nutrition routine, UVEDIQ Wheatgrass Powder offers a simple and versatile way to enjoy a plant-based ingredient.

Product Specifications:
• Net Weight: 200g (200.0 Grams)
• Manufacturer: Leaf and Kernel Superfoods Co.
• Packer: Uvediq
• Country of Origin: India
• Storage: Store in a cool & dry place. Keep away from moisture & direct sunlight. Once opened, reseal the pouch or store in an airtight container. Consume within three months after opening.
• FSSAI Lic No: 13326998000385 (Brand) / 10721039000051 (Mfg)',
    'Wheatgrass Powder — 100%',
    '1. Mix the recommended serving of wheatgrass powder into a glass of water.
2. Add it to your favourite juice or smoothie.
3. Enjoy as part of your daily routine and a balanced diet.',
    '1. Contains Naturally Occurring Plant Compounds – Wheatgrass contains various naturally occurring plant nutrients and compounds.
2. Antioxidant Properties – Wheatgrass contains plant compounds that have shown antioxidant activity.
3. Supports Everyday Nutrition – Can be included in a varied and balanced diet.
4. Convenient Daily Nutrition – Easy to mix into water, juice or smoothies.
5. Versatile and Easy to Use – A simple way to add a green plant-based ingredient to your favourite drinks.',
    390.00, 650.00,
    '11111111-1111-1111-1111-111111111101',
    '/images/products/uvediq-wheatgrass-powder-front.jpg',
    '100% Pure Green', 4.9, 31, 100, true, true
  ),
  (
    '77777777-7777-7777-7777-777777777704',
    'UVEDIQ Moringa Powder 200g',
    'uvediq-moringa-powder-200g',
    'Premium Moringa Leaf Powder — a versatile plant-based addition to your everyday nutrition routine.',
    'Nature’s Green Goodness. Packed with Plant-Based Nutrition.

Bring the goodness of moringa leaves into your everyday routine with UVEDIQ Premium Moringa Powder. Made from moringa leaf powder, this versatile green powder is a convenient way to add a plant-based ingredient to your daily diet.

Moringa leaves are naturally rich in various nutrients and contain plant compounds with antioxidant properties. Moringa powder can be included as part of a varied, balanced diet and a healthy lifestyle.

Product Specifications:
• Net Weight: 200g (200.0 Grams)
• Manufacturer: Leaf and Kernel Superfoods Co.
• Packer: Uvediq
• Country of Origin: India
• Storage: Store in a cool & dry place. Keep away from moisture & direct sunlight. Once opened, reseal the pouch or store in an airtight container. Consume within three months after opening.
• FSSAI Lic No: 13326998000385 (Brand) / 10721039000051 (Mfg)',
    'Moringa Leaf Powder — 100%',
    '1. Mix the recommended serving of moringa powder into a glass of water.
2. Add it to your favourite smoothie or juice.
3. Mix into soups or other suitable recipes as part of a balanced diet.',
    '1. Naturally Occurring Nutrients – Moringa leaves contain naturally occurring vitamins, minerals and other plant compounds.
2. Antioxidant Properties – Moringa leaves contain plant compounds with antioxidant activity.
3. Plant-Based Nutrition – A convenient plant-based ingredient to include in a varied, balanced diet.
4. Everyday Wellness – Easily incorporated into your daily food and drink routine.
5. Versatile and Easy to Use – Suitable for mixing into drinks, smoothies and selected recipes.',
    225.00, 350.00,
    '11111111-1111-1111-1111-111111111101',
    '/images/products/uvediq-moringa-powder-front.png',
    'Miracle Superfood', 4.9, 27, 100, true, true
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_description = EXCLUDED.short_description,
  price = EXCLUDED.price,
  original_price = EXCLUDED.original_price,
  category_id = EXCLUDED.category_id,
  image_url = EXCLUDED.image_url,
  badge = EXCLUDED.badge,
  rating = EXCLUDED.rating,
  review_count = EXCLUDED.review_count,
  stock_quantity = EXCLUDED.stock_quantity,
  is_active = EXCLUDED.is_active,
  is_featured = EXCLUDED.is_featured;

-- 5. Product Health Concerns Junction
INSERT INTO public.product_health_concerns (product_id, concern_id) VALUES
  ('33333333-3333-3333-3333-333333333301', '22222222-2222-2222-2222-222222222203'), -- Ashwagandha -> Stress
  ('33333333-3333-3333-3333-333333333301', '22222222-2222-2222-2222-222222222204'), -- Ashwagandha -> Energy
  ('33333333-3333-3333-3333-333333333302', '22222222-2222-2222-2222-222222222204'), -- Shilajit -> Energy
  ('33333333-3333-3333-3333-333333333302', '22222222-2222-2222-2222-222222222202'), -- Shilajit -> Immunity
  ('33333333-3333-3333-3333-333333333303', '22222222-2222-2222-2222-222222222201'), -- Triphala -> Digestion
  ('33333333-3333-3333-3333-333333333304', '22222222-2222-2222-2222-222222222203'), -- Tulsi -> Sleep
  ('33333333-3333-3333-3333-333333333305', '22222222-2222-2222-2222-222222222202'), -- Moringa -> Immunity
  ('33333333-3333-3333-3333-333333333305', '22222222-2222-2222-2222-222222222206'), -- Moringa -> Skin
  ('33333333-3333-3333-3333-333333333306', '22222222-2222-2222-2222-222222222203'), -- Brahmi -> Stress
  ('33333333-3333-3333-3333-333333333307', '22222222-2222-2222-2222-222222222201'), -- Ghee -> Digestion
  ('33333333-3333-3333-3333-333333333307', '22222222-2222-2222-2222-222222222205'), -- Ghee -> Joint
  ('33333333-3333-3333-3333-333333333308', '22222222-2222-2222-2222-222222222205'), -- Oil -> Joint
  ('77777777-7777-7777-7777-777777777701', '22222222-2222-2222-2222-222222222203'), -- UVEDIQ Ashwagandha -> Stress
  ('77777777-7777-7777-7777-777777777701', '22222222-2222-2222-2222-222222222204'), -- UVEDIQ Ashwagandha -> Energy
  ('77777777-7777-7777-7777-777777777701', '22222222-2222-2222-2222-222222222202'), -- UVEDIQ Ashwagandha -> Immunity
  ('77777777-7777-7777-7777-777777777702', '22222222-2222-2222-2222-222222222201'), -- UVEDIQ Makhana -> Digestion
  ('77777777-7777-7777-7777-777777777702', '22222222-2222-2222-2222-222222222202'), -- UVEDIQ Makhana -> Immunity
  ('77777777-7777-7777-7777-777777777702', '22222222-2222-2222-2222-222222222204'), -- UVEDIQ Makhana -> Energy
  ('77777777-7777-7777-7777-777777777703', '22222222-2222-2222-2222-222222222201'), -- UVEDIQ Wheatgrass -> Digestion
  ('77777777-7777-7777-7777-777777777703', '22222222-2222-2222-2222-222222222202'), -- UVEDIQ Wheatgrass -> Immunity
  ('77777777-7777-7777-7777-777777777703', '22222222-2222-2222-2222-222222222204'), -- UVEDIQ Wheatgrass -> Energy
  ('77777777-7777-7777-7777-777777777704', '22222222-2222-2222-2222-222222222202'), -- UVEDIQ Moringa -> Immunity
  ('77777777-7777-7777-7777-777777777704', '22222222-2222-2222-2222-222222222204'), -- UVEDIQ Moringa -> Energy
  ('77777777-7777-7777-7777-777777777704', '22222222-2222-2222-2222-222222222206')  -- UVEDIQ Moringa -> Skin
ON CONFLICT (product_id, concern_id) DO NOTHING;

-- 6. Coupons
INSERT INTO public.coupons (
  id, code, discount_type, discount_value, min_order_value, max_discount,
  is_active, show_on_storefront, display_title, display_message, valid_from, valid_to, display_from, display_to
) VALUES (
  '44444444-4444-4444-4444-444444444401',
  'LEAF20',
  'percentage',
  20,
  999.00,
  500.00,
  true,
  true,
  'Launch Special: 20% OFF',
  'Get 20% off on your wellness order above ₹999 (Max ₹500 discount)',
  now() - interval '1 day',
  now() + interval '90 days',
  now() - interval '1 day',
  now() + interval '90 days'
)
ON CONFLICT (code) DO UPDATE SET
  discount_type = EXCLUDED.discount_type,
  discount_value = EXCLUDED.discount_value,
  min_order_value = EXCLUDED.min_order_value,
  max_discount = EXCLUDED.max_discount,
  is_active = EXCLUDED.is_active,
  show_on_storefront = EXCLUDED.show_on_storefront,
  display_title = EXCLUDED.display_title,
  display_message = EXCLUDED.display_message;

-- 7. Announcements
INSERT INTO public.announcements (
  id, name, is_enabled, status, priority, free_shipping_threshold,
  announcement_copy, coupon_link_mode, selected_coupon_id, coupon_template
) VALUES (
  '55555555-5555-5555-5555-555555555501',
  'Storefront Launch Bar',
  true,
  'published',
  10,
  999,
  'Free shipping on orders above ₹{threshold} 🌿 Pure, Plant-Powered Ayurvedic Superfoods',
  'manual',
  '44444444-4444-4444-4444-444444444401',
  'Use code {code} for {discount} off'
)
ON CONFLICT (id) DO UPDATE SET
  is_enabled = EXCLUDED.is_enabled,
  status = EXCLUDED.status,
  free_shipping_threshold = EXCLUDED.free_shipping_threshold,
  announcement_copy = EXCLUDED.announcement_copy,
  coupon_link_mode = EXCLUDED.coupon_link_mode,
  selected_coupon_id = EXCLUDED.selected_coupon_id,
  coupon_template = EXCLUDED.coupon_template;

-- 8. Serviceable Pincodes
INSERT INTO public.serviceable_pincodes (pincode, city, state, cod_available, estimated_days) VALUES
  ('560001', 'Bengaluru', 'Karnataka', true, 2),
  ('110001', 'New Delhi', 'Delhi', true, 3),
  ('400001', 'Mumbai', 'Maharashtra', true, 3),
  ('600001', 'Chennai', 'Tamil Nadu', true, 3),
  ('500001', 'Hyderabad', 'Telangana', true, 3),
  ('700001', 'Kolkata', 'West Bengal', true, 4)
ON CONFLICT (pincode) DO UPDATE SET
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  cod_available = EXCLUDED.cod_available,
  estimated_days = EXCLUDED.estimated_days;

-- 9. Site Settings
INSERT INTO public.site_settings (key, value) VALUES
  ('store_name', 'Leaf & Kernel · UVEDIQ'),
  ('store_tagline', 'Plant-Powered Superfoods & Ayurvedic Wellness'),
  ('free_shipping_threshold', '999'),
  ('cod_enabled', 'true'),
  ('cod_fee', '49'),
  ('contact_email', 'care@leafandkernel.com'),
  ('support_phone', '+91 98765 43210'),
  ('whatsapp_number', '+919876543210'),
  ('maintenance_mode', 'false')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- 10. Sample Test Orders for Dashboard Metrics
DO $$
DECLARE
  v_user_id uuid := 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
  v_order1_id uuid := '66666666-6666-6666-6666-666666666601';
  v_order2_id uuid := '66666666-6666-6666-6666-666666666602';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = v_order1_id) THEN
    INSERT INTO public.orders (
      id, user_id, status, subtotal, total, created_at, stripe_session_id
    ) VALUES (
      v_order1_id, v_user_id, 'confirmed', 1299.00, 1299.00, now() - interval '2 days', 'pay_test_001'
    );
    INSERT INTO public.order_items (order_id, product_id, product_name, price, quantity) VALUES
      (v_order1_id, '33333333-3333-3333-3333-333333333302', 'Wildcrafted Himalayan Shilajit Gold Resin', 1299.00, 1);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = v_order2_id) THEN
    INSERT INTO public.orders (
      id, user_id, status, subtotal, total, created_at, stripe_session_id
    ) VALUES (
      v_order2_id, v_user_id, 'shipped', 1148.00, 1148.00, now() - interval '1 day', 'pay_test_002'
    );
    INSERT INTO public.order_items (order_id, product_id, product_name, price, quantity) VALUES
      (v_order2_id, '33333333-3333-3333-3333-333333333301', 'Organic Ashwagandha KSM-66 Root Powder', 649.00, 1),
      (v_order2_id, '33333333-3333-3333-3333-333333333303', 'Triphala Bio-Fermented Gut Cleanse Capsules', 499.00, 1);
  END IF;
END $$;
