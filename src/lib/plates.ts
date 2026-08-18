/**
 * Numberplate configuration: text sanitisation and decorative plate styles.
 *
 * Styles are generic colourways (no real jurisdiction's emblems or layouts) —
 * the plate is a display prop for the build, not a reproduction of any
 * official plate design.
 */

export interface PlateStyle {
  id: string;
  label: string;
  /** Plate background colour. */
  background: string;
  /** Character colour. */
  text: string;
  /** Border/frame line colour. */
  border: string;
}

export const PLATE_STYLES: PlateStyle[] = [
  {
    id: 'classic-black',
    label: 'Classic black',
    background: '#101114',
    text: '#e8c33c',
    border: '#e8c33c',
  },
  { id: 'plain-white', label: 'White', background: '#f2f1ec', text: '#17181b', border: '#17181b' },
  { id: 'blue', label: 'Blue', background: '#1d3a8f', text: '#f2d13c', border: '#f2d13c' },
  { id: 'yellow', label: 'Yellow', background: '#efc93d', text: '#17181b', border: '#17181b' },
];

export function getPlateStyle(id: string): PlateStyle {
  return PLATE_STYLES.find((s) => s.id === id) ?? PLATE_STYLES[0]!;
}

export const PLATE_TEXT_MAX = 10;

/** Uppercase; letters, digits, space, hyphen and middle dot only. */
export function sanitizePlateText(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9 ·-]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, PLATE_TEXT_MAX)
    .trimStart();
}

export const DEFAULT_PLATE_SETUP = { text: 'NOVA 70', styleId: 'classic-black' };
