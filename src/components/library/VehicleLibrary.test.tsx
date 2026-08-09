import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getManifestForVehicle } from '@/lib/catalog';
import { useBuildStore } from '@/state/buildStore';
import { useUiStore } from '@/state/uiStore';
import { VehicleLibrary } from './VehicleLibrary';

describe('VehicleLibrary', () => {
  beforeEach(() => {
    useBuildStore.getState().clear();
    useUiStore.getState().closeDialog();
  });

  it('filters vehicles by search text', async () => {
    const user = userEvent.setup();
    render(<VehicleLibrary />);
    const list = screen.getByRole('list', { name: 'Vehicles' });
    expect(within(list).getAllByRole('listitem').length).toBeGreaterThan(5);
    await user.type(screen.getByRole('searchbox', { name: 'Search vehicles' }), 'Mustang');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent('1965 Ford Mustang');
  });

  it('filters by vehicle type and 3D-ready flag', async () => {
    const user = userEvent.setup();
    render(<VehicleLibrary />);
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Filter by vehicle type' }),
      'pickup',
    );
    await user.click(screen.getByRole('checkbox', { name: '3D-ready only' }));
    const list = screen.getByRole('list', { name: 'Vehicles' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent('Titanforge TF-100');
  });

  it('selecting the demo vehicle creates a build wired to the right manifest', async () => {
    const user = userEvent.setup();
    render(<VehicleLibrary />);
    await user.click(screen.getByRole('button', { name: /1952 Titanforge TF-100/ }));
    await user.click(screen.getByRole('button', { name: 'Start / switch build' }));
    const build = useBuildStore.getState().build;
    expect(build?.vehicleId).toBe('veh-tf100-1952');
    expect(getManifestForVehicle(build!.vehicleId)?.id).toBe('manifest-tf100');
    expect(build!.installed.length).toBeGreaterThan(0);
  });

  it('switching vehicles with an open build routes through the warning dialog', async () => {
    const user = userEvent.setup();
    render(<VehicleLibrary />);
    await user.click(screen.getByRole('button', { name: /1952 Titanforge TF-100/ }));
    await user.click(screen.getByRole('button', { name: 'Start / switch build' }));
    await user.click(screen.getByRole('button', { name: /1957 Chevrolet Bel Air/ }));
    await user.click(screen.getByRole('button', { name: 'Open metadata (no 3D)' }));
    // Build must be unchanged until the dialog confirms.
    expect(useBuildStore.getState().build?.vehicleId).toBe('veh-tf100-1952');
    expect(useUiStore.getState().dialog).toEqual({
      kind: 'vehicle-change',
      targetVehicleId: 'veh-belair-1957',
    });
  });
});
