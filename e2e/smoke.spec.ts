import { expect, test, type Page } from '@playwright/test';

async function openDemoVehicle(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /1952 Titanforge TF-100/ }).click();
  await page.getByRole('button', { name: 'Start / switch build' }).click();
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 20_000 });
}

test.describe('workspace smoke', () => {
  test('empty state renders without console errors, then demo vehicle loads', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/');
    await expect(page.getByText('No vehicle loaded')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Design' })).toBeDisabled();

    await openDemoVehicle(page);
    await expect(page.getByRole('button', { name: 'Design' })).toBeEnabled();
    // Camera presets + turntable controls are live.
    await page.getByRole('button', { name: 'Front', exact: true }).click();
    await page.getByRole('button', { name: 'Turntable' }).click();
    expect(errors, errors.join('\n')).toHaveLength(0);
  });

  test('paint change survives a reload (autosave + restore)', async ({ page }) => {
    await openDemoVehicle(page);
    await page.getByRole('tab', { name: 'Paint' }).click();
    await page.getByRole('button', { name: '60s: Marina Blue' }).click();
    // The change first marks the save pending ("Saving…"), then flushes.
    await expect(page.getByText('Saving…')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Saved locally')).toBeVisible({ timeout: 10_000 });

    await page.reload();
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole('tab', { name: 'Paint' }).click();
    // The custom colour input reflects the persisted zone colour.
    await expect(page.getByLabel('Custom colour for Body')).toHaveValue('#2e5d9e');
  });

  test('undo/redo and component remove work end to end', async ({ page }) => {
    await openDemoVehicle(page);
    await page.getByRole('tab', { name: 'Parts' }).click();
    const bumperRow = page.locator('li', { hasText: 'Front bumper' }).first();
    await bumperRow.getByTitle('Remove part').click();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(bumperRow.getByTitle('Remove part')).toBeVisible();
    await page.getByRole('button', { name: 'Redo' }).click();
    await expect(bumperRow.getByTitle('Install / restore part')).toBeVisible();
  });

  test('titanforge record and export menu are wired', async ({ page }) => {
    await openDemoVehicle(page);
    await page.getByRole('button', { name: 'Fabrication' }).click();
    await expect(page.getByText('Adapter')).toBeVisible();
    // No records yet: export should warn, not download.
    await page.getByRole('button', { name: 'Export ▾' }).click();
    await page.getByRole('menuitem', { name: 'Titanforge manifest (JSON)' }).click();
    await expect(page.getByText(/No Titanforge records yet/)).toBeVisible();
  });

  test('compare mode renders a synchronised split view against stock', async ({ page }) => {
    await openDemoVehicle(page);
    // Make the working build visibly different from stock first.
    await page.getByRole('tab', { name: 'Paint' }).click();
    await page.getByRole('button', { name: '60s: Rally Red' }).click();
    await page.getByRole('button', { name: 'Compare' }).click();
    // Two canvases (primary + follower), labelled panes, and the B-side picker.
    await expect(page.locator('canvas')).toHaveCount(2, { timeout: 20_000 });
    await expect(page.getByText(/^A · /)).toBeVisible();
    await expect(page.getByText('B · Factory stock')).toBeVisible();
    const picker = page.getByLabel('Compare against');
    await expect(picker).toHaveValue('');
    // Leaving compare returns to a single viewport.
    await page.getByRole('button', { name: 'Design' }).click();
    await expect(page.locator('canvas')).toHaveCount(1);
  });

  test('an imported GLB can be mapped into a fully editable vehicle', async ({ page }) => {
    // Import is available once a build is open.
    await openDemoVehicle(page);
    // Import the committed demo GLB through the real validation flow.
    await page.getByRole('button', { name: 'Import', exact: true }).click();
    const chooserPromise = page.waitForEvent('filechooser');
    await page.getByText('Choose a file…').click();
    const chooser = await chooserPromise;
    await chooser.setFiles('public/assets/vehicles/tf100-stepside.glb');
    await expect(page.getByText(/glTF 2\.0 binary/)).toBeVisible({ timeout: 20_000 });
    await page.getByPlaceholder('Source / provider name *').fill('Project demo asset');
    await page.getByPlaceholder('Licence, e.g. CC0, CC-BY-4.0, purchased *').fill('CC0-1.0');
    await page.getByText('I confirm I have the right to reuse').click();
    await page.getByRole('button', { name: 'Add to library' }).click();

    // Map it: node tree + zone guesses load, metadata is filled, vehicle created.
    await page.getByRole('button', { name: 'Map to vehicle' }).click();
    await expect(page.getByText(/named mesh nodes found/)).toBeVisible({ timeout: 30_000 });
    await page.getByLabel('Make', { exact: true }).fill('Workshop');
    await page.getByLabel('Model', { exact: true }).fill('Special');
    await page.getByRole('button', { name: 'Create vehicle' }).click();
    await expect(page.getByText(/added to the library — 3D ready/)).toBeVisible();

    // The new vehicle opens as a real, renderable build (via the honest
    // vehicle-change warning, since a build is already open).
    await page.getByRole('button', { name: /1965 Workshop Special/ }).click();
    await page.getByRole('button', { name: 'Start / switch build' }).click();
    await page.getByRole('button', { name: /Switch (vehicle|and drop)/ }).click();
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('1965 Special build')).toBeVisible();
  });

  test('share dialog is truthful about missing backend', async ({ page }) => {
    await openDemoVehicle(page);
    await page.getByRole('button', { name: 'Share' }).click();
    await expect(page.getByText('Public share links are not available.')).toBeVisible();
  });
});
