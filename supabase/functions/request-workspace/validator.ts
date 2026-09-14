export const VALID_CATEGORIES = ['fish', 'produce', 'dry_goods', 'packaging'] as const;
export type PrimaryCategory = (typeof VALID_CATEGORIES)[number];

export interface WorkspaceRequestPayload {
  fullName: string;
  email: string;
  phone: string | null;
  restaurantName: string;
  city: string;
  website: string | null;
  primaryCategory: PrimaryCategory | null;
  locationsCount: number;
}

export type ParseWorkspaceResult =
  | { ok: true; isHoneypot: true }
  | { ok: true; isHoneypot: false; value: WorkspaceRequestPayload }
  | { ok: false; isHoneypot: false; error: string };

const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export function parseWorkspaceRequest(input: unknown): ParseWorkspaceResult {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, isHoneypot: false, error: 'Invalid request body' };
  }

  const raw = input as Record<string, unknown>;

  // Honeypot field: silent drop if bots fill this in
  const honeypotVal = raw.hpField ?? raw.faxNumber ?? raw.hp_website;
  if (typeof honeypotVal === 'string' && honeypotVal.trim().length > 0) {
    return { ok: true, isHoneypot: true };
  }

  const fullNameRaw = typeof raw.fullName === 'string' ? raw.fullName : raw.full_name;
  if (typeof fullNameRaw !== 'string' || !fullNameRaw.trim()) {
    return { ok: false, isHoneypot: false, error: 'Full name is required' };
  }
  const fullName = fullNameRaw.trim();
  if (fullName.length > 120) {
    return { ok: false, isHoneypot: false, error: 'Full name must be 120 characters or fewer' };
  }

  const emailRaw = typeof raw.email === 'string' ? raw.email : undefined;
  if (typeof emailRaw !== 'string' || !emailRaw.trim()) {
    return { ok: false, isHoneypot: false, error: 'Email is required' };
  }
  const email = emailRaw.trim().toLowerCase();
  if (email.length > 255 || !EMAIL_PATTERN.test(email)) {
    return { ok: false, isHoneypot: false, error: 'A valid email address is required' };
  }

  const phoneRaw = typeof raw.phone === 'string' ? raw.phone : undefined;
  let phone: string | null = null;
  if (typeof phoneRaw === 'string') {
    const trimmed = phoneRaw.trim();
    if (trimmed.length > 30) {
      return { ok: false, isHoneypot: false, error: 'Phone must be 30 characters or fewer' };
    }
    phone = trimmed || null;
  }

  const restaurantNameRaw =
    typeof raw.restaurantName === 'string' ? raw.restaurantName : raw.restaurant_name;
  if (typeof restaurantNameRaw !== 'string' || !restaurantNameRaw.trim()) {
    return { ok: false, isHoneypot: false, error: 'Restaurant name is required' };
  }
  const restaurantName = restaurantNameRaw.trim();
  if (restaurantName.length > 120) {
    return { ok: false, isHoneypot: false, error: 'Restaurant name must be 120 characters or fewer' };
  }

  const cityRaw = typeof raw.city === 'string' ? raw.city : undefined;
  if (typeof cityRaw !== 'string' || !cityRaw.trim()) {
    return { ok: false, isHoneypot: false, error: 'City is required' };
  }
  const city = cityRaw.trim();
  if (city.length > 120) {
    return { ok: false, isHoneypot: false, error: 'City must be 120 characters or fewer' };
  }

  const websiteRaw = typeof raw.website === 'string' ? raw.website : undefined;
  let website: string | null = null;
  if (typeof websiteRaw === 'string') {
    const trimmed = websiteRaw.trim();
    if (trimmed.length > 255) {
      return { ok: false, isHoneypot: false, error: 'Website must be 255 characters or fewer' };
    }
    website = trimmed || null;
  }

  const catRaw =
    typeof raw.primaryCategory === 'string' ? raw.primaryCategory : raw.primary_category;
  let primaryCategory: PrimaryCategory | null = null;
  if (typeof catRaw === 'string' && catRaw.trim()) {
    const normalized = catRaw.trim().toLowerCase();
    if (!VALID_CATEGORIES.includes(normalized as PrimaryCategory)) {
      return { ok: false, isHoneypot: false, error: 'Invalid primary category' };
    }
    primaryCategory = normalized as PrimaryCategory;
  }

  const locCountRaw =
    raw.locationsCount !== undefined ? raw.locationsCount : raw.locations_count;
  let locationsCount = 1;
  if (locCountRaw !== undefined && locCountRaw !== null && locCountRaw !== '') {
    const parsed = Number(locCountRaw);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 20) {
      return {
        ok: false,
        isHoneypot: false,
        error: 'Number of locations must be between 1 and 20',
      };
    }
    locationsCount = parsed;
  }

  return {
    ok: true,
    isHoneypot: false,
    value: {
      fullName,
      email,
      phone,
      restaurantName,
      city,
      website,
      primaryCategory,
      locationsCount,
    },
  };
}
