import { Client } from 'pg';

const DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/sena';

async function seedQAProperties() {
  const isRemote = DB_URL.includes('ondigitalocean.com') || DB_URL.includes('sslmode=require');
  const client = new Client({
    connectionString: DB_URL.replace('?sslmode=require', ''),
    ssl: isRemote ? { rejectUnauthorized: false } : false,
  });

  await client.connect();
  console.log('Connected to PostgreSQL database.');

  try {
    // 1. Get or create primary organization
    let orgRes = await client.query("SELECT id FROM organizations WHERE slug = 'sena-hospitality-group'");
    let orgId: string;
    if (orgRes.rows.length === 0) {
      const newOrg = await client.query(`
        INSERT INTO organizations (name, slug)
        VALUES ('Sena Hospitality Group', 'sena-hospitality-group')
        RETURNING id
      `);
      orgId = newOrg.rows[0].id;
    } else {
      orgId = orgRes.rows[0].id;
    }
    console.log(`Using organization ID: ${orgId}`);

    // =========================================================================
    // PROPERTY 1: SENA GRAND HOTEL (slug: sena-grand)
    // =========================================================================
    console.log('\n--- Seeding Property 1: Sena Grand Hotel (sena-grand) ---');
    let grandRes = await client.query("SELECT id FROM properties WHERE slug = 'sena-grand'");
    let grandId: string;

    if (grandRes.rows.length === 0) {
      const newGrand = await client.query(`
        INSERT INTO properties (
          organization_id, name, slug, code, property_type,
          country, address, phone, email, currency,
          check_in_time, check_out_time
        ) VALUES (
          $1, 'Sena Grand Hotel', 'sena-grand', 'SGH', 'boutique_hotel',
          'Nigeria', 'Plot 102 Ahmadu Bello Way, Victoria Island, Lagos',
          '+234 802 999 0001', 'concierge@senagrand.ng', 'NGN',
          '14:00', '11:00'
        ) RETURNING id
      `, [orgId]);
      grandId = newGrand.rows[0].id;
    } else {
      grandId = grandRes.rows[0].id;
      await client.query(`
        UPDATE properties SET
          name = 'Sena Grand Hotel',
          property_type = 'boutique_hotel',
          country = 'Nigeria',
          address = 'Plot 102 Ahmadu Bello Way, Victoria Island, Lagos',
          phone = '+234 802 999 0001',
          email = 'concierge@senagrand.ng'
        WHERE id = $1
      `, [grandId]);
    }
    console.log(`Sena Grand Hotel ID: ${grandId}`);

    // Website Config for Sena Grand
    await client.query(`
      INSERT INTO website_configs (
        property_id, theme, brand_colors, typography, button_style,
        hero_headline, hero_subheading, hero_image_url, hero_cta_label,
        welcome_eyebrow, welcome_title, welcome_body, welcome_image_url,
        about_story, about_image_url, highlights, gallery_images, nearby_places,
        amenities, policies, contact_phone, contact_email, contact_whatsapp,
        whatsapp_enabled, is_published, published_at, seo_title, seo_description
      ) VALUES (
        $1, 'sena_one',
        $2, $3, 'square',
        'An Editorial Sanctuary of Quiet Luxury',
        'Experience bespoke hospitality in the heart of Victoria Island. Guaranteed 24/7 uninterrupted power, private fiber-optic Wi-Fi, and personalized concierge care.',
        'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1800&q=85',
        'Reserve Your Suite',
        'A Sanctuary in Victoria Island',
        'Quiet Comfort, Thoughtfully Delivered',
        'Sena Grand Hotel was conceived as a private retreat from the vibrant tempo of Lagos. Every suite is insulated with acoustic double-glazing, furnished with handcrafted walnut furniture, and supported by enterprise-grade infrastructure.',
        'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80',
        'From our tranquil rooftop terrace overlooking Kuramo Waters to our discreet boardroom, Sena Grand caters to discerning executives and international travelers requiring absolute reliability.',
        'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
        $4, $5, $6, $7, $8,
        '+234 802 999 0001', 'reservations@senagrand.ng', '+2348029990001',
        true, true, NOW(),
        'Sena Grand Hotel | Luxury Boutique Hotel in Victoria Island, Lagos',
        'Book direct with Sena Grand Hotel for exclusive guaranteed rates, complimentary breakfast, and seamless check-in in Victoria Island.'
      )
      ON CONFLICT (property_id) DO UPDATE SET
        theme = 'sena_one',
        brand_colors = EXCLUDED.brand_colors,
        typography = EXCLUDED.typography,
        button_style = EXCLUDED.button_style,
        hero_headline = EXCLUDED.hero_headline,
        hero_subheading = EXCLUDED.hero_subheading,
        hero_image_url = EXCLUDED.hero_image_url,
        hero_cta_label = EXCLUDED.hero_cta_label,
        welcome_eyebrow = EXCLUDED.welcome_eyebrow,
        welcome_title = EXCLUDED.welcome_title,
        welcome_body = EXCLUDED.welcome_body,
        welcome_image_url = EXCLUDED.welcome_image_url,
        about_story = EXCLUDED.about_story,
        about_image_url = EXCLUDED.about_image_url,
        highlights = EXCLUDED.highlights,
        gallery_images = EXCLUDED.gallery_images,
        nearby_places = EXCLUDED.nearby_places,
        amenities = EXCLUDED.amenities,
        policies = EXCLUDED.policies,
        contact_phone = EXCLUDED.contact_phone,
        contact_email = EXCLUDED.contact_email,
        contact_whatsapp = EXCLUDED.contact_whatsapp,
        whatsapp_enabled = true,
        is_published = true,
        published_at = NOW(),
        seo_title = EXCLUDED.seo_title,
        seo_description = EXCLUDED.seo_description
    `, [
      grandId,
      JSON.stringify({ primaryColor: '#1B2A4A', accentColor: '#D4AF37', navStyle: 'transparent' }),
      JSON.stringify({ headingFont: 'Playfair Display', bodyFont: 'Inter' }),
      JSON.stringify([
        { title: '24/7 Guaranteed Power', description: 'Dual redundant industrial generators ensure zero power cuts.', icon: 'Zap' },
        { title: 'Dedicated Fiber Internet', description: 'Up to 300 Mbps symmetric low-latency Wi-Fi in every room.', icon: 'Wifi' },
        { title: 'Artisan Dining', description: 'Complimentary farm-to-table breakfast served daily until 11:00 AM.', icon: 'Utensils' },
        { title: 'Private Valet & Security', description: 'Armed 24-hour guarded perimeter with secure underground parking.', icon: 'ShieldCheck' }
      ]),
      JSON.stringify([
        { url: 'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&q=80', caption: 'Grand Facade & Portico', category: 'Exterior' },
        { url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80', caption: 'Executive Suite Living Room', category: 'Suites' },
        { url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80', caption: 'Deluxe King Bedroom', category: 'Suites' },
        { url: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=80', caption: 'Courtyard Pool & Cabanas', category: 'Amenities' },
        { url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=80', caption: 'The Atrium Bistro', category: 'Dining' }
      ]),
      JSON.stringify([
        { place: 'Eko Atlantic City', distance: '5 mins drive', category: 'Business' },
        { place: 'Landmark Beach & Centre', distance: '8 mins drive', category: 'Leisure' },
        { place: 'Victoria Island Financial Hub', distance: '3 mins walk', category: 'Business' },
        { place: 'Murtala Muhammed International Airport', distance: '45 mins', category: 'Transport' }
      ]),
      JSON.stringify([
        { name: 'Dual Generator Backup', category: 'Infrastructure', featured: true },
        { name: 'Ultra-High-Speed Wi-Fi', category: 'Technology', featured: true },
        { name: 'Rooftop Infinity Pool', category: 'Wellness', featured: true },
        { name: 'Fitness & Cardio Suite', category: 'Wellness', featured: true },
        { name: '24/7 In-Room Dining', category: 'Dining', featured: true },
        { name: 'Executive Meeting Room', category: 'Business', featured: true }
      ]),
      JSON.stringify({
        checkInTime: '14:00',
        checkOutTime: '11:00',
        cancellation: 'Free cancellation up to 48 hours before check-in. Non-refundable within 48 hours.',
        children: 'Children of all ages are welcome. Cribs available on request.',
        pets: 'No pets allowed.',
        smoking: '100% non-smoking property. Designated outdoor smoking area available.',
        payment: 'We accept all major debit/credit cards (Visa, Mastercard, Verve) and bank transfers.'
      })
    ]);

    // Subdomain entry for sena-grand
    await client.query(`
      INSERT INTO website_domains (property_id, domain, type, status, is_primary)
      VALUES ($1, 'sena-grand.sena.ng', 'subdomain', 'active', true)
      ON CONFLICT (domain) DO UPDATE SET status = 'active', is_primary = true
    `, [grandId]);

    // Sena Grand Room Categories & Physical Rooms
    // 1. Deluxe Room
    let delRes = await client.query("SELECT id FROM room_types WHERE property_id = $1 AND name = 'Deluxe King Room'", [grandId]);
    let delId: string;
    if (delRes.rows.length === 0) {
      const ins = await client.query(`
        INSERT INTO room_types (
          property_id, name, description, capacity, bed_type,
          base_price_minor_units, total_inventory, amenities, images,
          website_visibility, booking_visibility
        ) VALUES (
          $1, 'Deluxe King Room',
          'Spacious 38 sqm sanctuary featuring an ultra-comfortable king bed, Italian rain shower, work desk with ergonomic chair, and floor-to-ceiling windows.',
          2, 'King Bed', 6500000, 5,
          $2, $3, true, true
        ) RETURNING id
      `, [
        grandId,
        JSON.stringify(['King Bed', 'Rain Shower', 'High-Speed Wi-Fi', 'Smart TV', 'Nespresso Machine', 'Laptop Safe']),
        JSON.stringify(['https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1000&q=80'])
      ]);
      delId = ins.rows[0].id;
    } else {
      delId = delRes.rows[0].id;
    }

    // 2. Executive Suite
    let execRes = await client.query("SELECT id FROM room_types WHERE property_id = $1 AND name = 'Executive Suite'", [grandId]);
    let execId: string;
    if (execRes.rows.length === 0) {
      const ins = await client.query(`
        INSERT INTO room_types (
          property_id, name, description, capacity, bed_type,
          base_price_minor_units, total_inventory, amenities, images,
          website_visibility, booking_visibility
        ) VALUES (
          $1, 'Executive Suite',
          'Expansive 62 sqm one-bedroom suite with separated lounge, marble bathroom with deep soaking tub, private dressing area, and premium minibar.',
          3, 'King Bed + Sofa Bed', 12000000, 4,
          $2, $3, true, true
        ) RETURNING id
      `, [
        grandId,
        JSON.stringify(['Separate Living Room', 'Marble Soaking Tub', 'Double Vanity', 'Bose Sound System', 'Espresso Bar', 'Executive Lounge Access']),
        JSON.stringify(['https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1000&q=80'])
      ]);
      execId = ins.rows[0].id;
    } else {
      execId = execRes.rows[0].id;
    }

    // 3. Presidential Penthouse
    let pentRes = await client.query("SELECT id FROM room_types WHERE property_id = $1 AND name = 'Presidential Penthouse'", [grandId]);
    let pentId: string;
    if (pentRes.rows.length === 0) {
      const ins = await client.query(`
        INSERT INTO room_types (
          property_id, name, description, capacity, bed_type,
          base_price_minor_units, total_inventory, amenities, images,
          website_visibility, booking_visibility
        ) VALUES (
          $1, 'Presidential Penthouse',
          'Magnificent 110 sqm top-floor penthouse with private terrace overlooking the Atlantic ocean, dining room for 6, full service pantry, and 24-hour butler service.',
          4, 'Two King Beds', 25000000, 2,
          $2, $3, true, true
        ) RETURNING id
      `, [
        grandId,
        JSON.stringify(['Private Ocean Terrace', 'Dining Room', 'Dedicated Butler', 'Whirlpool Spa Tub', 'Walk-in Closet', 'Complimentary Airport Transfer']),
        JSON.stringify(['https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1000&q=80'])
      ]);
      pentId = ins.rows[0].id;
    } else {
      pentId = pentRes.rows[0].id;
    }

    // Seed 11 Physical Rooms
    const roomsList = [
      { num: '101', typeId: delId, floor: '1' },
      { num: '102', typeId: delId, floor: '1' },
      { num: '103', typeId: delId, floor: '1' },
      { num: '104', typeId: delId, floor: '1' },
      { num: '105', typeId: delId, floor: '1' },
      { num: '201', typeId: execId, floor: '2' },
      { num: '202', typeId: execId, floor: '2' },
      { num: '203', typeId: execId, floor: '2' },
      { num: '204', typeId: execId, floor: '2' },
      { num: 'PH-1', typeId: pentId, floor: 'Penthouse' },
      { num: 'PH-2', typeId: pentId, floor: 'Penthouse' },
    ];

    for (const r of roomsList) {
      await client.query(`
        INSERT INTO rooms (property_id, room_type_id, room_number, floor, operational_status, housekeeping_status)
        VALUES ($1, $2, $3, $4, 'available', 'clean')
        ON CONFLICT DO NOTHING
      `, [grandId, r.typeId, r.num, r.floor]);
    }
    console.log(`Created/verified 11 physical rooms for Sena Grand Hotel.`);

    // 6 Verified & Authentic Reviews for Sena Grand
    await client.query('DELETE FROM reviews WHERE property_id = $1', [grandId]);
    const reviewsData = [
      {
        guestName: 'Dr. Babatunde Fashola',
        rating: 5,
        title: 'Impeccable quiet luxury in VI',
        body: 'Sena Grand is in a league of its own in Lagos. The Wi-Fi never dropped once during three days of video conferences, and the staff operates with understated elegance. Best sleep I have had in months.',
        isVerified: true,
      },
      {
        guestName: 'Claire Tremblay',
        rating: 5,
        title: 'A true 5-star boutique experience',
        body: 'From the private airport transfer to the farm-fresh breakfast, everything was flawless. The rain shower and acoustics in the Executive Suite are world-class.',
        isVerified: true,
      },
      {
        guestName: 'Emeka Nwosu',
        rating: 5,
        title: 'Flawless power and serene atmosphere',
        body: 'Zero generator noise, 24/7 power, and exceptionally clean linen. Direct booking through their website was smooth and got us early check-in without hassle.',
        isVerified: true,
      },
      {
        guestName: 'Sarah Jenkins',
        rating: 4,
        title: 'Wonderful stay, rooftop view is stunning',
        body: 'The penthouse terrace at sunset is unforgettable. Cocktail service was slightly slow on Friday evening, but the manager promptly resolved it with a complimentary dessert. Will return!',
        isVerified: true,
      },
      {
        guestName: 'Alhaji Mansur Bello',
        rating: 5,
        title: 'Executive travel standard elevated',
        body: 'Quiet, secure, and disciplined staff. The meeting room amenities were top notch. Sena Grand has earned my permanent corporate booking.',
        isVerified: false,
      },
      {
        guestName: 'Jessica Adebayo',
        rating: 5,
        title: 'Delightful weekend getaway',
        body: 'The bed is heavenly and the attention to detail is noticeable everywhere. The curated tea selection in the room was a very thoughtful touch.',
        isVerified: false,
      },
    ];

    for (const rev of reviewsData) {
      await client.query(`
        INSERT INTO reviews (
          property_id, guest_name, rating, title, body,
          source, status, is_verified_stay, submitted_at, published_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          'sena', 'published', $6, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'
        )
      `, [grandId, rev.guestName, rev.rating, rev.title, rev.body, rev.isVerified]);
    }
    console.log(`Seeded 6 reviews (4 verified stay, 2 manual) for Sena Grand Hotel.`);


    // =========================================================================
    // PROPERTY 2: SENA COAST RESORT (slug: sena-coast) - ISOLATION TESTING
    // =========================================================================
    console.log('\n--- Seeding Property 2: Sena Coast Resort (sena-coast) ---');
    let coastRes = await client.query("SELECT id FROM properties WHERE slug = 'sena-coast'");
    let coastId: string;

    if (coastRes.rows.length === 0) {
      const newCoast = await client.query(`
        INSERT INTO properties (
          organization_id, name, slug, code, property_type,
          country, address, phone, email, currency,
          check_in_time, check_out_time
        ) VALUES (
          $1, 'Sena Coast Resort', 'sena-coast', 'SCR', 'resort',
          'Nigeria', 'Km 34 Lekki-Epe Expressway, Coastal Corridor, Lagos',
          '+234 809 111 8888', 'stay@senacoast.ng', 'NGN',
          '15:00', '12:00'
        ) RETURNING id
      `, [orgId]);
      coastId = newCoast.rows[0].id;
    } else {
      coastId = coastRes.rows[0].id;
      await client.query(`
        UPDATE properties SET
          name = 'Sena Coast Resort',
          property_type = 'resort',
          country = 'Nigeria',
          address = 'Km 34 Lekki-Epe Expressway, Coastal Corridor, Lagos',
          phone = '+234 809 111 8888',
          email = 'stay@senacoast.ng'
        WHERE id = $1
      `, [coastId]);
    }
    console.log(`Sena Coast Resort ID: ${coastId}`);

    // Website Config for Sena Coast Resort (Theme 3: sena_three)
    await client.query(`
      INSERT INTO website_configs (
        property_id, theme, brand_colors, typography, button_style,
        hero_headline, hero_subheading, hero_image_url, hero_cta_label,
        welcome_eyebrow, welcome_title, welcome_body, welcome_image_url,
        about_story, about_image_url, highlights, gallery_images, nearby_places,
        amenities, policies, contact_phone, contact_email, contact_whatsapp,
        whatsapp_enabled, is_published, published_at, seo_title, seo_description
      ) VALUES (
        $1, 'sena_three',
        $2, $3, 'rounded',
        'Where Coastal Calm Meets Modern Craft',
        'An oceanfront haven designed for rest, restorative retreats, and effortless oceanfront dining along Lagos serene shoreline.',
        'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=1800&q=85',
        'Reserve A Villa',
        'Oceanfront Living',
        'A Natural Rhythm of Leisure',
        'Nestled along the pristine Atlantic shoreline, Sena Coast Resort offers private villa sanctuaries crafted from local stone and cedar, harmonizing luxury with nature.',
        'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80',
        'Escape the noise. Wake up to the sound of breaking waves and unwind in our beachfront saltwater pools.',
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
        $4, $5, $6, $7, $8,
        '+234 809 111 8888', 'concierge@senacoast.ng', '+2348091118888',
        true, true, NOW(),
        'Sena Coast Resort | Beachfront Villas & Retreat in Lagos',
        'Private villas, private beach access, and oceanfront dining at Sena Coast Resort.'
      )
      ON CONFLICT (property_id) DO UPDATE SET
        theme = 'sena_three',
        brand_colors = EXCLUDED.brand_colors,
        typography = EXCLUDED.typography,
        button_style = EXCLUDED.button_style,
        hero_headline = EXCLUDED.hero_headline,
        hero_subheading = EXCLUDED.hero_subheading,
        hero_image_url = EXCLUDED.hero_image_url,
        hero_cta_label = EXCLUDED.hero_cta_label,
        welcome_eyebrow = EXCLUDED.welcome_eyebrow,
        welcome_title = EXCLUDED.welcome_title,
        welcome_body = EXCLUDED.welcome_body,
        welcome_image_url = EXCLUDED.welcome_image_url,
        about_story = EXCLUDED.about_story,
        about_image_url = EXCLUDED.about_image_url,
        highlights = EXCLUDED.highlights,
        gallery_images = EXCLUDED.gallery_images,
        nearby_places = EXCLUDED.nearby_places,
        amenities = EXCLUDED.amenities,
        policies = EXCLUDED.policies,
        contact_phone = EXCLUDED.contact_phone,
        contact_email = EXCLUDED.contact_email,
        contact_whatsapp = EXCLUDED.contact_whatsapp,
        whatsapp_enabled = true,
        is_published = true,
        published_at = NOW(),
        seo_title = EXCLUDED.seo_title,
        seo_description = EXCLUDED.seo_description
    `, [
      coastId,
      JSON.stringify({ primaryColor: '#1A3636', accentColor: '#E07A5F', navStyle: 'solid_light' }),
      JSON.stringify({ headingFont: 'Cormorant Garamond', bodyFont: 'Plus Jakarta Sans' }),
      JSON.stringify([
        { title: 'Private Beach Access', description: 'Direct steps to 300 meters of private sand.', icon: 'Sun' },
        { title: 'Saltwater Infinity Pool', description: 'Heated oceanfront pool with continuous tidal views.', icon: 'Waves' },
        { title: 'Coastal Grill & Bar', description: 'Fresh seafood delivered daily by local artisanal fishermen.', icon: 'Utensils' }
      ]),
      JSON.stringify([
        { url: 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=1200&q=80', caption: 'Private Beachfront Villas', category: 'Exterior' },
        { url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80', caption: 'Ocean Terrace Lounge', category: 'Resort' },
        { url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80', caption: 'Private White Sand Shore', category: 'Beach' }
      ]),
      JSON.stringify([
        { place: 'Lekki Conservation Centre', distance: '20 mins drive', category: 'Nature' },
        { place: 'Eleko Beach Surf Spot', distance: '10 mins drive', category: 'Leisure' }
      ]),
      JSON.stringify([
        { name: 'Private Beach Lounge', category: 'Leisure', featured: true },
        { name: 'Paddleboard & Kayaks', category: 'Sports', featured: true },
        { name: 'Beachside Bonfires', category: 'Experiences', featured: true }
      ]),
      JSON.stringify({
        checkInTime: '15:00',
        checkOutTime: '12:00',
        cancellation: 'Flexible cancellation up to 72 hours before arrival.',
        pets: 'Well-behaved dogs allowed in beachfront villas on request.'
      })
    ]);

    // Subdomain entry for sena-coast
    await client.query(`
      INSERT INTO website_domains (property_id, domain, type, status, is_primary)
      VALUES ($1, 'sena-coast.sena.ng', 'subdomain', 'active', true)
      ON CONFLICT (domain) DO UPDATE SET status = 'active', is_primary = true
    `, [coastId]);

    // Room categories for Sena Coast
    let villaRes = await client.query("SELECT id FROM room_types WHERE property_id = $1 AND name = 'Oceanview Pool Villa'", [coastId]);
    let villaId: string;
    if (villaRes.rows.length === 0) {
      const ins = await client.query(`
        INSERT INTO room_types (
          property_id, name, description, capacity, bed_type,
          base_price_minor_units, total_inventory, amenities, images,
          website_visibility, booking_visibility
        ) VALUES (
          $1, 'Oceanview Pool Villa',
          'Private 85 sqm standalone villa featuring a plunge pool, expansive teak sundeck, and panoramic views of the Atlantic.',
          2, 'King Bed', 18500000, 3,
          $2, $3, true, true
        ) RETURNING id
      `, [
        coastId,
        JSON.stringify(['Private Plunge Pool', 'Teak Sundeck', 'Oceanfront View', 'Outdoor Stone Shower', 'Breakfast in Villa']),
        JSON.stringify(['https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=1000&q=80'])
      ]);
      villaId = ins.rows[0].id;
    } else {
      villaId = villaRes.rows[0].id;
    }

    // Seed physical rooms for Sena Coast
    for (const n of ['V-01', 'V-02', 'V-03']) {
      await client.query(`
        INSERT INTO rooms (property_id, room_type_id, room_number, floor, operational_status, housekeeping_status)
        VALUES ($1, $2, $3, 'Ground', 'available', 'clean')
        ON CONFLICT DO NOTHING
      `, [coastId, villaId, n]);
    }

    // Distinct reviews for Sena Coast
    await client.query('DELETE FROM reviews WHERE property_id = $1', [coastId]);
    await client.query(`
      INSERT INTO reviews (
        property_id, guest_name, rating, title, body,
        source, status, is_verified_stay, submitted_at, published_at
      ) VALUES
      ($1, 'Kemi Adeleke', 5, 'Absolute peace by the ocean', 'The private plunge pool and sound of the ocean made this the best weekend escape from Victoria Island. 10/10.', 'sena', 'published', true, NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'),
      ($1, 'David O.', 5, 'Stunning architectural design', 'Minimalist, thoughtful, and discreet. The grilled red snapper at the coastal lounge was outstanding.', 'sena', 'published', true, NOW() - INTERVAL '1 days', NOW() - INTERVAL '1 days')
    `, [coastId]);

    console.log('✅ QA Properties Seeding Completed Successfully!');
  } finally {
    await client.end();
  }
}

seedQAProperties().catch((err) => {
  console.error('Seeding error:', err);
  process.exit(1);
});
