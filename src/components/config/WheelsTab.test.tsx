import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { getVehicle } from '@/lib/catalog';
import { useBuildStore } from '@/state/buildStore';
import { WheelsTab } from './WheelsTab';

describe('WheelsTab', () => {
  beforeEach(() => {
    useBuildStore.getState().clear();
    useBuildStore.getState().newBuildForVehicle(getVehicle('veh-tf100-1952')!);
  });

  it('shows the derived tyre designation and diameter', () => {
    render(<WheelsTab />);
    // stock 205/75-16 → 16*25.4 + 2*153.75 ≈ 714 mm
    expect(screen.getByText(/205\/75-16/)).toBeInTheDocument();
    expect(screen.getByText(/Ø 714 mm/)).toBeInTheDocument();
  });

  it('changing tyre width updates the build and the derived spec', () => {
    render(<WheelsTab />);
    fireEvent.change(screen.getByRole('slider', { name: /Section width/ }), {
      target: { value: '295' },
    });
    expect(useBuildStore.getState().build!.wheels.front.tyre.widthMm).toBe(295);
    expect(screen.getByText(/295\/75-16/)).toBeInTheDocument();
  });

  it('incompatible combinations surface fitment warnings without corrupting the build', () => {
    render(<WheelsTab />);
    fireEvent.change(screen.getByRole('slider', { name: /Section width/ }), {
      target: { value: '345' },
    });
    fireEvent.change(screen.getByRole('slider', { name: /Aspect ratio/ }), {
      target: { value: '85' },
    });
    expect(screen.getByText(/Fitment warnings/)).toBeInTheDocument();
    // Build state remains valid & unchanged apart from the requested values.
    const build = useBuildStore.getState().build!;
    expect(build.wheels.front.tyre.widthMm).toBe(345);
    expect(build.wheels.front.tyre.aspectPct).toBe(85);
  });

  it('unlinking exposes an independent rear axle editor', () => {
    render(<WheelsTab />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Same setup front & rear/ }));
    expect(screen.getByText('Rear axle')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'rear rim diameter' }), {
      target: { value: '18' },
    });
    const build = useBuildStore.getState().build!;
    expect(build.wheels.rear.tyre.rimIn).toBe(18);
    expect(build.wheels.front.tyre.rimIn).toBe(16);
  });
});
