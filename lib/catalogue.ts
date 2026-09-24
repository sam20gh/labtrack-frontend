/**
 * The orderable catalogue, as the app reads it.
 *
 * Two screens draw products — the shop (`app/(tabs)/orders.tsx`) and the product page
 * (`app/ProductDetails.tsx`) — and both need the same three answers: which pictures does
 * this product have, what does its type look like, and how is its price written. Each
 * screen answering for itself is how the shop came to show a 48pt cover while the product
 * page showed a gallery, with no way to tell from the list that there was more to see.
 *
 * Same argument `lib/quickActions.ts` records: the list is a product decision, and the
 * next surface that wants it must not hand-copy it.
 */
import type { Product } from '@/types/api';
import { schemed, tone, activePalette } from '@/constants/theme';

/**
 * A product's pictures, cover first.
 *
 * `images` is the gallery and `image` is its cover; the API keeps the two in step, so
 * `images[0] === image` on anything written since the gallery existed. A record written
 * before it has only the cover, which is a gallery of one rather than nothing — and a
 * record with neither is an empty array, never `[undefined]`.
 */
export const galleryOf = (product?: Partial<Product> | null): string[] => {
    const gallery = Array.isArray(product?.images) ? product.images.filter(Boolean) : [];
    if (gallery.length) return gallery;
    return product?.image ? [product.image] : [];
};

/**
 * The order the shop lists categories in — clinical volume first, so the section a person
 * most likely came for is the one already on screen.
 */
export const TYPE_ORDER = [
    'Blood Test', 'DNA Test', 'Scan', 'Examination', 'Procedure', 'Urine Test',
] as const;

export interface TypeMeta {
    icon: string;
    /** A short label for a chip, where the full name would wrap. */
    short: string;
    /** The card's tint. Categories are visually distinct so a grid scan reads as sorted. */
    tint: string;
    surface: string;
}

/**
 * Per-category identity.
 *
 * The tints are decorative, not clinical — nothing here is a verdict on a result, so they
 * deliberately avoid `FlagColors`' red/amber/green, which a person reads as a finding.
 */
export const TYPE_META: Record<string, TypeMeta> = schemed((Palette, scheme) => ({
    'Blood Test': { icon: 'water', short: 'Blood', tint: Palette.danger, surface: Palette.dangerSurface },
    'DNA Test': { icon: 'git-branch', short: 'DNA', tint: Palette.primary, surface: Palette.primarySurface },
    'Scan': { icon: 'scan', short: 'Scans', tint: tone('#0891B2', scheme), surface: tone('#ECFEFF', scheme) },
    'Examination': { icon: 'body', short: 'Exams', tint: Palette.indigo, surface: Palette.indigoSurface },
    'Procedure': { icon: 'medkit', short: 'Procedures', tint: tone('#DB2777', scheme), surface: Palette.pinkSurface },
    'Urine Test': { icon: 'flask', short: 'Urine', tint: tone('#CA8A04', scheme), surface: tone('#FEFCE8', scheme) },
}));

export const metaFor = (type?: string): TypeMeta =>
    (type && TYPE_META[type]) || { icon: 'ellipse', short: type || 'Other', tint: activePalette().textSecondary, surface: activePalette().borderLight };

/** Sort comparator putting known categories in `TYPE_ORDER` and everything else after. */
export const byTypeOrder = (a: string, b: string) => {
    const ai = TYPE_ORDER.indexOf(a as never);
    const bi = TYPE_ORDER.indexOf(b as never);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
};

/** Prices are stored as numbers; `.00` is written out so a column of them aligns. */
export const formatPrice = (price?: number) =>
    typeof price === 'number' ? `£${price.toFixed(2)}` : '—';

/**
 * Does this product's name or description mention `query`?
 *
 * Description is searched as well as name because the catalogue's names are deliberately
 * short — `planGeneratorV2.matchProduct()` needs them to be — so "cholesterol" finds
 * nothing by name and everything by description.
 */
export const matchesQuery = (product: Product, query: string) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${product.name} ${product.description ?? ''} ${product.type ?? ''}`
        .toLowerCase()
        .includes(q);
};
