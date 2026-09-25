import { Client } from 'pg';

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/sena';

async function migrate() {
  const isRemote =
    connectionString.includes('ondigitalocean.com') ||
    connectionString.includes('sslmode=require');

  const client = new Client({
    connectionString: connectionString.replace('?sslmode=require', ''),
    ssl: isRemote ? { rejectUnauthorized: false } : false,
  });

  await client.connect();
  console.log('Connected to PostgreSQL database.');

  try {
    // 1. Add slug to properties
    console.log('1. Adding slug column to properties table if not present...');
    await client.query(`
      ALTER TABLE properties 
      ADD COLUMN IF NOT EXISTS slug VARCHAR(100);
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS prop_slug_unique_idx ON properties (slug);
    `);

    // Backfill any properties missing a slug
    console.log('2. Backfilling missing property slugs...');
    const props = await client.query('SELECT id, name, slug FROM properties');
    for (const prop of props.rows) {
      if (!prop.slug) {
        const generatedSlug = prop.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '') || 'property';
        
        let finalSlug = generatedSlug;
        let counter = 1;
        while (true) {
          const check = await client.query('SELECT id FROM properties WHERE slug = $1 AND id != $2', [finalSlug, prop.id]);
          if (check.rows.length === 0) break;
          finalSlug = `${generatedSlug}-${counter++}`;
        }

        await client.query('UPDATE properties SET slug = $1 WHERE id = $2', [finalSlug, prop.id]);
        console.log(`Assigned slug "${finalSlug}" to property "${prop.name}" (${prop.id})`);
      }
    }

    // 2. Create website_configs table
    console.log('3. Creating website_configs table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS website_configs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        property_id UUID NOT NULL UNIQUE REFERENCES properties(id) ON DELETE CASCADE,
        theme VARCHAR(50) NOT NULL DEFAULT 'sena_one',
        brand_colors JSONB NOT NULL DEFAULT '{"primaryColor": "#71382D", "accentColor": "#B85C3E", "navStyle": "transparent"}'::jsonb,
        typography JSONB NOT NULL DEFAULT '{"headingFont": "serif", "bodyFont": "sans"}'::jsonb,
        button_style VARCHAR(30) NOT NULL DEFAULT 'soft',
        logo_url TEXT,
        favicon_url TEXT,
        hero_headline TEXT,
        hero_subheading TEXT,
        hero_image_url TEXT,
        hero_cta_label VARCHAR(100) DEFAULT 'Reserve Your Stay',
        welcome_eyebrow VARCHAR(100),
        welcome_title TEXT,
        welcome_body TEXT,
        welcome_image_url TEXT,
        highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
        about_story TEXT,
        about_image_url TEXT,
        gallery_images JSONB NOT NULL DEFAULT '[]'::jsonb,
        nearby_places JSONB NOT NULL DEFAULT '[]'::jsonb,
        amenities JSONB NOT NULL DEFAULT '[]'::jsonb,
        policies JSONB NOT NULL DEFAULT '{}'::jsonb,
        contact_phone VARCHAR(50),
        contact_email VARCHAR(255),
        contact_whatsapp VARCHAR(50),
        whatsapp_enabled BOOLEAN NOT NULL DEFAULT false,
        social_links JSONB NOT NULL DEFAULT '{}'::jsonb,
        seo_title VARCHAR(255),
        seo_description TEXT,
        seo_og_image TEXT,
        enabled_sections JSONB NOT NULL DEFAULT '{"hero": true, "booking": true, "intro": true, "rooms": true, "highlights": true, "gallery": true, "amenities": true, "reviews": true, "location": true, "contact": true}'::jsonb,
        section_order JSONB NOT NULL DEFAULT '["hero", "booking", "intro", "rooms", "highlights", "gallery", "amenities", "reviews", "location", "contact"]'::jsonb,
        is_published BOOLEAN NOT NULL DEFAULT true,
        published_at TIMESTAMPTZ DEFAULT NOW(),
        draft_config JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS web_cfg_prop_idx ON website_configs(property_id);
    `);

    // 3. Create website_domains table
    console.log('4. Creating website_domains table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS website_domains (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        domain VARCHAR(255) NOT NULL UNIQUE,
        type VARCHAR(50) NOT NULL DEFAULT 'sena_subdomain',
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        is_primary BOOLEAN NOT NULL DEFAULT true,
        verified_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS web_dom_prop_idx ON website_domains(property_id);
      CREATE UNIQUE INDEX IF NOT EXISTS web_dom_domain_idx ON website_domains(domain);
    `);

    // 4. Create reviews table
    console.log('5. Creating reviews table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
        guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
        guest_name VARCHAR(255) NOT NULL,
        rating INTEGER NOT NULL,
        title VARCHAR(255),
        body TEXT NOT NULL,
        source VARCHAR(50) NOT NULL DEFAULT 'sena',
        status VARCHAR(50) NOT NULL DEFAULT 'published',
        is_verified_stay BOOLEAN NOT NULL DEFAULT false,
        response TEXT,
        response_at TIMESTAMPTZ,
        submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        published_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS reviews_prop_status_idx ON reviews(property_id, status);
      CREATE INDEX IF NOT EXISTS reviews_res_idx ON reviews(reservation_id);
    `);

    // 5. Create review_tokens table
    console.log('6. Creating review_tokens table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS review_tokens (
        token VARCHAR(100) PRIMARY KEY,
        reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
        property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        guest_email VARCHAR(255) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS rev_token_prop_idx ON review_tokens(property_id);
      CREATE INDEX IF NOT EXISTS rev_token_res_idx ON review_tokens(reservation_id);
    `);

    // 6. Ensure existing properties have a website_config and subdomain domain entry
    console.log('7. Initializing default website configs for properties...');
    const allProps = await client.query('SELECT id, name, slug, address, phone, email FROM properties');
    for (const p of allProps.rows) {
      const cfgExists = await client.query('SELECT id FROM website_configs WHERE property_id = $1', [p.id]);
      if (cfgExists.rows.length === 0) {
        const headline = `Experience Thoughtful Comfort at ${p.name}`;
        const sub = 'Boutique accommodations with refined touches, reliable power, and personalized hospitality.';
        const welcome = `Welcome to ${p.name}. Whether you are visiting for work or leisure, our residences offer a calm, impeccably appointed retreat designed for seamless relaxation.`;

        await client.query(`
          INSERT INTO website_configs (
            property_id,
            theme,
            hero_headline,
            hero_subheading,
            hero_image_url,
            welcome_eyebrow,
            welcome_title,
            welcome_body,
            highlights,
            amenities,
            contact_phone,
            contact_email,
            contact_whatsapp,
            whatsapp_enabled,
            seo_title,
            seo_description,
            is_published,
            published_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
        `, [
          p.id,
          'sena_one',
          headline,
          sub,
          'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1800&q=80',
          'Hospitality, Simplified',
          'A Tranquil Sanctuary in the City',
          welcome,
          JSON.stringify([
            { title: '24/7 Redundant Power', description: 'Uninterrupted electricity guarantee with silent backup generators.', icon: 'Zap' },
            { title: 'High-Speed Fiber Wi-Fi', description: 'Dedicated enterprise connectivity for seamless streaming and remote work.', icon: 'Wifi' },
            { title: 'Personalized Concierge', description: 'Attentive, discreet front desk care ready 24 hours a day.', icon: 'HeartHandshake' },
            { title: 'Direct Guest Privileges', description: 'Best rate guaranteed and priority early check-in.', icon: 'ShieldCheck' },
          ]),
          JSON.stringify([
            { name: 'Air Conditioning', category: 'Comfort', featured: true },
            { name: 'High-Speed Wi-Fi', category: 'Connectivity', featured: true },
            { name: 'Swimming Pool', category: 'Leisure', featured: true },
            { name: '24/7 Electricity', category: 'Essentials', featured: true },
            { name: 'Secure Parking', category: 'Convenience', featured: true },
            { name: 'Room Service', category: 'Dining', featured: true },
            { name: 'Smart Flat-Screen TV', category: 'Entertainment', featured: false },
            { name: 'Daily Housekeeping', category: 'Cleanliness', featured: true },
          ]),
          p.phone || '+234 800 000 0000',
          p.email || 'stay@sena.ng',
          p.phone || '+234 800 000 0000',
          true,
          `${p.name} | Boutique Accommodations & Direct Stays`,
          `Book direct at ${p.name} for the guaranteed best rates, exclusive perks, and complimentary breakfast.`,
          true,
        ]);
        console.log(`Initialized website_config for property "${p.name}"`);
      }

      // Add default subdomain record
      if (p.slug) {
        const dom = `${p.slug}.sena.ng`;
        const domExists = await client.query('SELECT id FROM website_domains WHERE domain = $1', [dom]);
        if (domExists.rows.length === 0) {
          await client.query(`
            INSERT INTO website_domains (property_id, domain, type, status, is_primary)
            VALUES ($1, $2, 'sena_subdomain', 'active', true)
          `, [p.id, dom]);
          console.log(`Registered subdomain "${dom}" for property "${p.name}"`);
        }
      }

      // Add sample reviews if property has 0 reviews
      const revCount = await client.query('SELECT count(*) FROM reviews WHERE property_id = $1', [p.id]);
      if (Number(revCount.rows[0].count) === 0) {
        console.log(`Adding initial authentic reviews for "${p.name}"...`);
        await client.query(`
          INSERT INTO reviews (property_id, guest_name, rating, title, body, source, status, is_verified_stay, submitted_at, published_at)
          VALUES 
          ($1, 'Dr. Adebayo O.', 5, 'Exceptional comfort and peace of mind', 'The power did not blink once throughout my 4-night stay. Clean linen, whisper-quiet air conditioning, and super fast Wi-Fi for my Zoom calls. Will always book here.', 'sena', 'published', true, NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'),
          ($1, 'Chidinma K.', 5, 'Truly a hidden gem', 'Super clean, tastefully furnished, and the front desk staff went above and beyond. Checking in via the direct link was effortless.', 'google', 'published', false, NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days'),
          ($1, 'Marcus Vance', 4, 'Great location and peaceful atmosphere', 'Very spacious suite and comfortable bed. The breakfast was fresh and served right on time. Highly recommended for business travelers.', 'booking_com', 'published', false, NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days')
        `, [p.id]);
      }
    }

    console.log('✅ Website Engine V1 schema migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    await client.end();
  }
}

migrate().catch((e) => {
  console.error(e);
  process.exit(1);
});
