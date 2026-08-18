/**
 * Racing stripe configuration. Stripes are painted in the shader from
 * car-space geometry (no textures/UVs needed), on the material zones a
 * vehicle's manifest lists in `stripeZones`.
 */

export interface StripeStyle {
  id: 'none' | 'single' | 'twin-rally' | 'rocker';
  label: string;
  description: string;
}

export const STRIPE_STYLES: StripeStyle[] = [
  { id: 'none', label: 'None', description: 'No stripes.' },
  {
    id: 'single',
    label: 'Single centre',
    description: 'One wide stripe over hood, roof and trunk.',
  },
  { id: 'twin-rally', label: 'Twin rally', description: 'Classic paired centre stripes.' },
  {
    id: 'rocker',
    label: 'Side rockers',
    description: 'Horizontal stripe along the lower body sides.',
  },
];

/** Numeric style index used by the shader uniform. */
export const STRIPE_STYLE_INDEX: Record<StripeStyle['id'], number> = {
  none: 0,
  single: 1,
  'twin-rally': 2,
  rocker: 3,
};

export const STRIPE_COLORS = [
  { name: 'White', hex: '#f2f1ec' },
  { name: 'Black', hex: '#141519' },
  { name: 'Red', hex: '#b1121b' },
  { name: 'Blue', hex: '#2358a8' },
  { name: 'Gold', hex: '#c9a13b' },
];

export const DEFAULT_STRIPE_SETUP = {
  styleId: 'none' as StripeStyle['id'],
  colorHex: '#f2f1ec',
  /** 0.5 – 1.5 multiplier on the style's base width. */
  widthScale: 1,
};
