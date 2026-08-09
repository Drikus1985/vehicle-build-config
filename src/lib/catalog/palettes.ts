/** Curated, factory-inspired paint palettes (period-flavoured names, original data). */

export interface PaletteColor {
  id: string;
  name: string;
  hex: string;
  era: string;
}

export const FACTORY_PALETTES: { id: string; label: string; colors: PaletteColor[] }[] = [
  {
    id: 'fifties',
    label: 'Late 40s – 50s',
    colors: [
      { id: 'p-onyx', name: 'Onyx Black', hex: '#101114', era: '1948-59' },
      { id: 'p-glacier', name: 'Glacier White', hex: '#eceae2', era: '1948-59' },
      { id: 'p-seafoam', name: 'Seafoam Green', hex: '#9fc4b0', era: '1950-57' },
      { id: 'p-skyhaze', name: 'Sky Haze Blue', hex: '#a9c3d4', era: '1950-58' },
      { id: 'p-matador', name: 'Matador Red', hex: '#8f1f27', era: '1953-59' },
      { id: 'p-desert', name: 'Desert Beige', hex: '#cbb694', era: '1948-56' },
      { id: 'p-forest', name: 'Forester Green', hex: '#2d4a3a', era: '1948-55' },
      { id: 'p-coral', name: 'Coral Mist', hex: '#d98a7e', era: '1955-58' },
    ],
  },
  {
    id: 'sixties',
    label: '60s',
    colors: [
      { id: 'p-rally-red', name: 'Rally Red', hex: '#b1121b', era: '1963-69' },
      { id: 'p-marina', name: 'Marina Blue', hex: '#2e5d9e', era: '1965-69' },
      { id: 'p-goldwood', name: 'Goldenwood', hex: '#b98d3e', era: '1966-69' },
      { id: 'p-ermine', name: 'Ermine White', hex: '#f0eee6', era: '1960-69' },
      { id: 'p-tuxedo', name: 'Tuxedo Black', hex: '#0c0d10', era: '1960-69' },
      { id: 'p-emberglo', name: 'Ember Glow', hex: '#c05a3a', era: '1966-67' },
      { id: 'p-highland', name: 'Highland Green', hex: '#2f4536', era: '1968' },
      { id: 'p-silverblue', name: 'Silver Blue', hex: '#8ea7bd', era: '1963-66' },
    ],
  },
  {
    id: 'seventies',
    label: '70s',
    colors: [
      { id: 'p-plum', name: 'Plum Frenzy', hex: '#4d2a5e', era: '1970-74' },
      { id: 'p-sublime', name: 'Sub-Lime', hex: '#7fb541', era: '1970-72' },
      { id: 'p-vitamin', name: 'Vitamin C Orange', hex: '#d2591c', era: '1970-73' },
      { id: 'p-banana', name: 'Top Banana', hex: '#e2c235', era: '1970-74' },
      { id: 'p-burnish', name: 'Burnished Copper', hex: '#8a4a24', era: '1970-78' },
      { id: 'p-petty', name: 'Corporate Blue', hex: '#2358a8', era: '1970-78' },
      { id: 'p-cream', name: 'Parchment Cream', hex: '#e8dfc6', era: '1970-78' },
      { id: 'p-graphite', name: 'Graphite Poly', hex: '#3c3f45', era: '1974-78' },
    ],
  },
];

export const ALL_PALETTE_COLORS: PaletteColor[] = FACTORY_PALETTES.flatMap((p) => p.colors);
