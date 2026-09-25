import { db, properties, websiteConfigs, roomTypes, reviews, eq, desc } from '@sena/database';

export interface WebsiteData {
  property: {
    id: string;
    name: string;
    slug: string;
    code: string;
    propertyType: string;
    country: string;
    address: string;
    phone: string;
    email: string;
    currency: string;
    checkInTime: string;
    checkOutTime: string;
  };
  config: {
    theme: 'sena_one' | 'sena_two' | 'sena_three';
    brandColors: {
      primaryColor: string;
      accentColor: string;
      bgStyle?: string;
      textDark?: string;
      navStyle?: 'transparent' | 'solid_light' | 'solid_dark';
    };
    typography: {
      headingFont: string;
      bodyFont: string;
    };
    buttonStyle: 'square' | 'soft' | 'rounded';
    logoUrl?: string | null;
    faviconUrl?: string | null;
    heroHeadline: string;
    heroSubheading: string;
    heroImageUrl: string;
    heroCtaLabel: string;
    welcomeEyebrow: string;
    welcomeTitle: string;
    welcomeBody: string;
    welcomeImageUrl?: string | null;
    highlights: Array<{ title: string; description: string; icon?: string }>;
    aboutStory?: string | null;
    aboutImageUrl?: string | null;
    galleryImages: Array<{ url: string; caption?: string; category?: string }>;
    nearbyPlaces: Array<{ place: string; distance: string; category?: string }>;
    amenities: Array<{ name: string; category?: string; icon?: string; featured?: boolean }>;
    policies: {
      checkInTime?: string;
      checkOutTime?: string;
      cancellation?: string;
      children?: string;
      pets?: string;
      smoking?: string;
      payment?: string;
    };
    contactPhone?: string | null;
    contactEmail?: string | null;
    contactWhatsapp?: string | null;
    whatsappEnabled: boolean;
    socialLinks: {
      instagram?: string;
      facebook?: string;
      twitter?: string;
      linkedin?: string;
    };
    seoTitle?: string | null;
    seoDescription?: string | null;
    seoOgImage?: string | null;
    enabledSections: {
      hero?: boolean;
      booking?: boolean;
      intro?: boolean;
      rooms?: boolean;
      highlights?: boolean;
      gallery?: boolean;
      amenities?: boolean;
      reviews?: boolean;
      location?: boolean;
      contact?: boolean;
    };
    sectionOrder: string[];
    isPublished: boolean;
  };
  rooms: Array<{
    id: string;
    name: string;
    description: string;
    capacity: number;
    bedType: string;
    basePriceMinorUnits: number;
    amenities: string[];
    images: string[];
    totalInventory: number;
  }>;
  reviews: {
    items: Array<{
      id: string;
      guestName: string;
      rating: number;
      title?: string | null;
      body: string;
      source: string;
      isVerifiedStay: boolean;
      response?: string | null;
      responseAt?: Date | null;
      submittedAt: Date;
    }>;
    averageRating: number;
    totalCount: number;
  };
}

export async function getWebsiteData(slug: string, isPreview = false): Promise<WebsiteData | null> {
  try {
    const cleanSlug = slug.toLowerCase().trim();

    // 1. Fetch property by slug
    const property = await db.query.properties.findFirst({
      where: eq(properties.slug, cleanSlug),
    });

    if (!property) return null;

    // 2. Fetch website configuration
    const configRecord = await db.query.websiteConfigs.findFirst({
      where: eq(websiteConfigs.propertyId, property.id),
    });

    // 3. Fetch active room types
    const roomRecords = await db
      .select()
      .from(roomTypes)
      .where(eq(roomTypes.propertyId, property.id))
      .orderBy(desc(roomTypes.createdAt));

    // 4. Fetch published reviews
    const reviewRecords = await db
      .select()
      .from(reviews)
      .where(eq(reviews.propertyId, property.id))
      .orderBy(desc(reviews.submittedAt));

    const publishedReviews = reviewRecords.filter((r) => r.status === 'published');
    const totalCount = publishedReviews.length;
    const avgRating =
      totalCount > 0
        ? Number((publishedReviews.reduce((sum, r) => sum + r.rating, 0) / totalCount).toFixed(1))
        : 5.0;

    // Determine config to use (draft if preview mode, otherwise published)
    const baseConfig = configRecord || ({} as any);
    const effectiveConfig =
      isPreview && baseConfig.draftConfig
        ? { ...baseConfig, ...(baseConfig.draftConfig as any) }
        : baseConfig;

    return {
      property: {
        id: property.id,
        name: property.name,
        slug: property.slug || cleanSlug,
        code: property.code,
        propertyType: property.propertyType,
        country: property.country,
        address: property.address,
        phone: property.phone,
        email: property.email,
        currency: property.currency,
        checkInTime: property.checkInTime,
        checkOutTime: property.checkOutTime,
      },
      config: {
        theme: effectiveConfig.theme || 'sena_one',
        brandColors: {
          primaryColor: effectiveConfig.brandColors?.primaryColor || '#71382D',
          accentColor: effectiveConfig.brandColors?.accentColor || '#B85C3E',
          bgStyle: effectiveConfig.brandColors?.bgStyle || '#FAF7F2',
          textDark: effectiveConfig.brandColors?.textDark || '#191816',
          navStyle: effectiveConfig.brandColors?.navStyle || 'transparent',
        },
        typography: {
          headingFont: effectiveConfig.typography?.headingFont || 'serif',
          bodyFont: effectiveConfig.typography?.bodyFont || 'sans',
        },
        buttonStyle: effectiveConfig.buttonStyle || 'soft',
        logoUrl: effectiveConfig.logoUrl,
        faviconUrl: effectiveConfig.faviconUrl,
        heroHeadline: effectiveConfig.heroHeadline || `Experience Warm Hospitality at ${property.name}`,
        heroSubheading:
          effectiveConfig.heroSubheading ||
          'Serene boutique accommodations with refined comfort, reliable 24/7 power, and personalized service.',
        heroImageUrl:
          effectiveConfig.heroImageUrl ||
          'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1800&q=80',
        heroCtaLabel: effectiveConfig.heroCtaLabel || 'Reserve Your Stay',
        welcomeEyebrow: effectiveConfig.welcomeEyebrow || 'Hospitality, Simplified',
        welcomeTitle: effectiveConfig.welcomeTitle || 'A Tranquil Sanctuary in the City',
        welcomeBody:
          effectiveConfig.welcomeBody ||
          `Welcome to ${property.name}. Each of our residences combines thoughtful design with quiet privacy and personalized service. Enjoy uninterrupted electricity, superfast Wi-Fi, and peaceful comfort throughout your stay.`,
        welcomeImageUrl: effectiveConfig.welcomeImageUrl,
        highlights: effectiveConfig.highlights?.length
          ? effectiveConfig.highlights
          : [
              {
                title: '24/7 Redundant Power',
                description: 'Uninterrupted electricity guarantee with silent backup generators.',
                icon: 'Zap',
              },
              {
                title: 'High-Speed Fiber Wi-Fi',
                description: 'Dedicated enterprise connectivity for seamless streaming and remote work.',
                icon: 'Wifi',
              },
              {
                title: 'Personalized Concierge',
                description: 'Attentive, discreet front desk care ready 24 hours a day.',
                icon: 'HeartHandshake',
              },
              {
                title: 'Direct Guest Privileges',
                description: 'Best rate guaranteed and priority early check-in.',
                icon: 'ShieldCheck',
              },
            ],
        aboutStory:
          effectiveConfig.aboutStory ||
          `${property.name} was created for the modern traveler who appreciates understated luxury, authentic warmth, and dependable tranquility. Located in ${property.address}, we prioritize intuitive hospitality and quiet comfort.`,
        aboutImageUrl: effectiveConfig.aboutImageUrl,
        galleryImages: effectiveConfig.galleryImages?.length
          ? effectiveConfig.galleryImages
          : [
              { url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1000&q=80', category: 'Rooms', caption: 'Executive Suite' },
              { url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1000&q=80', category: 'Rooms', caption: 'Deluxe Residence' },
              { url: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1000&q=80', category: 'Property', caption: 'Garden & Pool' },
              { url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1000&q=80', category: 'Experiences', caption: 'Evening Lounge' },
            ],
        nearbyPlaces: effectiveConfig.nearbyPlaces?.length
          ? effectiveConfig.nearbyPlaces
          : [
              { place: 'Fine Dining & Cafes', distance: '3 mins' },
              { place: 'Art Galleries & Shopping', distance: '8 mins' },
              { place: 'International Airport', distance: '35 mins' },
            ],
        amenities: effectiveConfig.amenities?.length
          ? effectiveConfig.amenities
          : [
              { name: 'Air Conditioning', category: 'Comfort', featured: true },
              { name: 'High-Speed Wi-Fi', category: 'Connectivity', featured: true },
              { name: 'Swimming Pool', category: 'Leisure', featured: true },
              { name: '24/7 Electricity', category: 'Essentials', featured: true },
              { name: 'Secure Parking', category: 'Convenience', featured: true },
              { name: 'Room Service', category: 'Dining', featured: true },
            ],
        policies: effectiveConfig.policies || {
          checkInTime: property.checkInTime || '14:00',
          checkOutTime: property.checkOutTime || '11:00',
          cancellation: 'Free cancellation up to 48 hours before check-in date.',
          children: 'Children of all ages are welcome.',
          pets: 'Pets are not allowed.',
          smoking: 'Non-smoking property in all indoor spaces.',
          payment: 'Direct online payment via Card or Bank Transfer accepted.',
        },
        contactPhone: effectiveConfig.contactPhone || property.phone,
        contactEmail: effectiveConfig.contactEmail || property.email,
        contactWhatsapp: effectiveConfig.contactWhatsapp || property.phone,
        whatsappEnabled: effectiveConfig.whatsappEnabled ?? true,
        socialLinks: effectiveConfig.socialLinks || {},
        seoTitle: effectiveConfig.seoTitle || `${property.name} | Boutique Accommodations & Stays`,
        seoDescription:
          effectiveConfig.seoDescription ||
          `Book direct with ${property.name} for the guaranteed best rates, exclusive perks, and flexible check-in.`,
        seoOgImage: effectiveConfig.seoOgImage || effectiveConfig.heroImageUrl,
        enabledSections: effectiveConfig.enabledSections || {
          hero: true,
          booking: true,
          intro: true,
          rooms: true,
          highlights: true,
          gallery: true,
          amenities: true,
          reviews: true,
          location: true,
          contact: true,
        },
        sectionOrder: effectiveConfig.sectionOrder || [
          'hero',
          'booking',
          'intro',
          'rooms',
          'highlights',
          'gallery',
          'amenities',
          'reviews',
          'location',
          'contact',
        ],
        isPublished: effectiveConfig.isPublished ?? true,
      },
      rooms: roomRecords.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description || 'Thoughtfully appointed room with premium finishes.',
        capacity: r.capacity || 2,
        bedType: r.bedType || 'King Bed',
        basePriceMinorUnits: r.basePriceMinorUnits,
        amenities: (r.amenities as string[]) || ['High-Speed Wi-Fi', 'En-suite bath', 'Breakfast included'],
        images:
          r.images && (r.images as string[]).length > 0
            ? (r.images as string[])
            : ['https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1000&q=80'],
        totalInventory: r.totalInventory,
      })),
      reviews: {
        items: publishedReviews.map((r) => ({
          id: r.id,
          guestName: r.guestName,
          rating: r.rating,
          title: r.title,
          body: r.body,
          source: r.source,
          isVerifiedStay: r.isVerifiedStay,
          response: r.response,
          responseAt: r.responseAt,
          submittedAt: r.submittedAt,
        })),
        averageRating: avgRating,
        totalCount,
      },
    };
  } catch (error) {
    console.error('Error fetching website data:', error);
    return null;
  }
}
