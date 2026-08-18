/**
 * Pre-designed full-car livery schemes. Each scheme is a set of filled
 * polygons authored in car-space metres (y up, +z nose, dimensions tuned to
 * the ~4.98 m catalogue vehicles) and projected onto the UV atlas through the
 * manifest's `liveryPanels` island frames at draw time. Because every island
 * is an affine orthographic unwrap, straight polygon edges stay straight and
 * shapes wrap continuously over panel shoulders when they share coordinates
 * (e.g. a tail band at the same z range on the trunk and quarter islands).
 *
 * Coordinates use whichever two axes a panel's frame projects (side islands
 * ignore x, top islands ignore y) — the third component is a don't-care.
 * Accent shapes are listed before primaries so primaries overlap them into
 * clean keylines.
 */

export type SchemePoint = readonly [number, number, number];

export interface SchemeShape {
  /** `liveryPanels` ids this polygon is projected onto. */
  panels: readonly string[];
  fill: 'primary' | 'accent';
  pts: readonly SchemePoint[];
}

export interface LiveryScheme {
  id: string;
  label: string;
  description: string;
  shapes: readonly SchemeShape[];
}

const SIDES = ['side-l', 'side-r'] as const;

export const LIVERY_SCHEMES: LiveryScheme[] = [
  {
    id: 'spear',
    label: 'Side spear',
    description: 'Tapering spear along both sides, nose to a point at the tail.',
    shapes: [
      // Accent: the same spear expanded ~18 mm → keyline border under primary.
      {
        panels: SIDES,
        fill: 'accent',
        pts: [
          [0, 0.913, 2.45],
          [0, 0.933, 0.9],
          [0, 0.903, -1.2],
          [0, 0.815, -2.29],
          [0, 0.762, -1.2],
          [0, 0.772, 0.9],
          [0, 0.782, 2.45],
        ],
      },
      {
        panels: SIDES,
        fill: 'primary',
        pts: [
          [0, 0.895, 2.45],
          [0, 0.915, 0.9],
          [0, 0.885, -1.2],
          [0, 0.815, -2.25],
          [0, 0.78, -1.2],
          [0, 0.79, 0.9],
          [0, 0.8, 2.45],
        ],
      },
    ],
  },
  {
    id: 'hockey',
    label: 'Hockey stick',
    description: 'Beltline stripe that kicks up over the rear quarter.',
    shapes: [
      {
        panels: SIDES,
        fill: 'accent',
        pts: [
          [0, 0.935, 2.45],
          [0, 0.935, -0.13],
          [0, 1.035, -0.13],
          [0, 1.035, -0.52],
          [0, 0.765, -0.52],
          [0, 0.765, 2.45],
        ],
      },
      {
        panels: SIDES,
        fill: 'primary',
        pts: [
          [0, 0.92, 2.45],
          [0, 0.92, -0.15],
          [0, 1.02, -0.15],
          [0, 1.02, -0.5],
          [0, 0.78, -0.5],
          [0, 0.78, 2.45],
        ],
      },
    ],
  },
  {
    id: 'two-tone',
    label: 'Lower two-tone',
    description: 'Second colour below the beltline with a divider pinstripe.',
    shapes: [
      {
        panels: SIDES,
        fill: 'accent',
        pts: [
          [0, 0.658, 2.49],
          [0, 0.658, -2.49],
          [0, 0.632, -2.49],
          [0, 0.632, 2.49],
        ],
      },
      {
        panels: SIDES,
        fill: 'primary',
        pts: [
          [0, 0.625, 2.49],
          [0, 0.625, -2.49],
          [0, 0.28, -2.49],
          [0, 0.28, 2.49],
        ],
      },
    ],
  },
  {
    id: 'bands',
    label: 'Nose & tail bands',
    description: 'Transverse bands wrapping the nose and the tail.',
    shapes: [
      // Nose: hood surface + fender sides share the same z range so the band
      // wraps continuously over the fender shoulder; a thin accent trails it.
      {
        panels: ['hood'],
        fill: 'accent',
        pts: [
          [-0.98, 0, 1.84],
          [-0.98, 0, 1.89],
          [0.98, 0, 1.89],
          [0.98, 0, 1.84],
        ],
      },
      {
        panels: SIDES,
        fill: 'accent',
        pts: [
          [0, 0.52, 1.84],
          [0, 0.99, 1.84],
          [0, 0.99, 1.89],
          [0, 0.52, 1.89],
        ],
      },
      {
        panels: ['hood'],
        fill: 'primary',
        pts: [
          [-0.98, 0, 1.92],
          [-0.98, 0, 2.14],
          [0.98, 0, 2.14],
          [0.98, 0, 1.92],
        ],
      },
      {
        panels: SIDES,
        fill: 'primary',
        pts: [
          [0, 0.52, 1.92],
          [0, 0.99, 1.92],
          [0, 0.99, 2.14],
          [0, 0.52, 2.14],
        ],
      },
      // Tail: trunk lid + quarter sides at one z range.
      {
        panels: ['trunk'],
        fill: 'accent',
        pts: [
          [-0.98, 0, -1.96],
          [-0.98, 0, -1.91],
          [0.98, 0, -1.91],
          [0.98, 0, -1.96],
        ],
      },
      {
        panels: SIDES,
        fill: 'accent',
        pts: [
          [0, 0.52, -1.96],
          [0, 1.02, -1.96],
          [0, 1.02, -1.91],
          [0, 0.52, -1.91],
        ],
      },
      {
        panels: ['trunk'],
        fill: 'primary',
        pts: [
          [-0.98, 0, -2.24],
          [-0.98, 0, -2.02],
          [0.98, 0, -2.02],
          [0.98, 0, -2.24],
        ],
      },
      {
        panels: SIDES,
        fill: 'primary',
        pts: [
          [0, 0.52, -2.24],
          [0, 1.02, -2.24],
          [0, 1.02, -2.02],
          [0, 0.52, -2.02],
        ],
      },
    ],
  },
];

export function getLiveryScheme(id: string): LiveryScheme | undefined {
  return id === 'none' ? undefined : LIVERY_SCHEMES.find((s) => s.id === id);
}
