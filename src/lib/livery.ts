/**
 * Livery configuration: racing roundels (number circles) and lettering drawn
 * onto the vehicle's UV texture atlas. Placement data (anchors) lives in the
 * asset manifest; this module holds the user-facing options and sanitisers.
 * Liveries need the manifest's UV-mapped `liverySource` asset at runtime.
 */
import type { LiverySetup } from '@/lib/schemas';

export const LIVERY_NUMBER_MAX = 3;
export const LIVERY_TEXT_MAX = 18;

/** Shared swatches for disc/ring/lettering colours. */
export const LIVERY_COLORS = [
  { name: 'White', hex: '#f2f1ec' },
  { name: 'Black', hex: '#141519' },
  { name: 'Red', hex: '#b1121b' },
  { name: 'Blue', hex: '#2358a8' },
  { name: 'Gold', hex: '#c9a13b' },
];

export const DEFAULT_LIVERY_SETUP: LiverySetup = {
  roundels: {
    anchorIds: [],
    number: '11',
    discHex: '#f2f1ec',
    ringHex: '#141519',
    sizeScale: 1,
  },
  lettering: {
    anchorIds: [],
    text: '',
    colorHex: '#f2f1ec',
    sizeScale: 1,
  },
};

/** Racing numbers: alphanumerics only, up to 3 characters. */
export function sanitizeRoundelNumber(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, LIVERY_NUMBER_MAX);
}

/** Lettering: printable subset so the canvas text always renders cleanly. */
export function sanitizeLetteringText(raw: string): string {
  return raw
    .replace(/[^A-Za-z0-9 .\-'&!]/g, '')
    .replace(/ {2,}/g, ' ')
    .slice(0, LIVERY_TEXT_MAX)
    .trimStart();
}

/** True when the setup draws anything at all. */
export function liveryHasContent(livery: LiverySetup): boolean {
  return (
    (livery.roundels.anchorIds.length > 0 && livery.roundels.number.length > 0) ||
    (livery.lettering.anchorIds.length > 0 && livery.lettering.text.trim().length > 0)
  );
}
