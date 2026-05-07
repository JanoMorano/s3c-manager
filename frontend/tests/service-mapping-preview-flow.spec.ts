import { expect, test } from '@playwright/test';
import { getConfiguredAdminCredentials, loginWithConfiguredAdmin } from './admin-credentials';

interface CapabilityOption {
  uuid: string;
  slug: string;
  title: string;
}

interface PreviewResponse {
  read_only: boolean;
  affected_spirals: string[];
  coverage_delta_per_lvl3: Array<{
    capability_slug?: string;
    after_coverage_percent: number;
    newly_covered_count: number;
  }>;
}

interface CapabilityLinkResponse {
  data_objects?: Array<{ id: number; entity_id: number }>;
}

test('service mapping preview can be saved and reflected on capability dashboard', async ({ page }) => {
  test.setTimeout(3 * 60 * 1000);

  const credentials = getConfiguredAdminCredentials();
  if (!credentials) {
    test.skip(true, 'Set PLAYWRIGHT_ADMIN_USERNAME and PLAYWRIGHT_ADMIN_PASSWORD to run mapping preview E2E.');
    return;
  }

  const suffix = `${Date.now()}`.slice(-8);
  const serviceId = `AUTO-MAP-${suffix}`;
  let created = false;
  let createdDataObjectLink: { capabilityUuid: string; linkId: number } | null = null;

  await loginWithConfiguredAdmin(page, credentials);

  try {
    const createResponse = await page.request.post('/api/v1/services', {
      data: {
        service_id: serviceId,
        title: `[E2E] Mapping Preview ${suffix}`,
        service_type: 'ES',
        service_status: 'draft',
        description: 'Temporary service created for mapping preview E2E.',
        requestable: false,
      },
    });
    expect(createResponse.ok(), await createResponse.text()).toBeTruthy();
    created = true;

    const capabilitiesResponse = await page.request.get('/api/v1/capabilities/lvl3');
    expect(capabilitiesResponse.ok(), await capabilitiesResponse.text()).toBeTruthy();
    const capabilities = await capabilitiesResponse.json() as CapabilityOption[];

    const selected = capabilities.find((item) => item.uuid && item.slug) ?? null;
    if (!selected) {
      test.skip(true, 'No Level-3 capability is available in this dataset.');
      return;
    }

    async function previewSelected() {
      const previewResponse = await page.request.post(`/api/v1/services/${serviceId}/preview-mapping`, {
        data: { capability_uuid: selected.uuid, mapping_type_code: 'supports' },
      });
      expect(previewResponse.ok(), await previewResponse.text()).toBeTruthy();
      return await previewResponse.json() as PreviewResponse;
    }

    let preview = await previewSelected();
    if (preview.coverage_delta_per_lvl3.length === 0) {
      const dataObjectsResponse = await page.request.get('/api/v1/taxonomy/c3-data-objects');
      expect(dataObjectsResponse.ok(), await dataObjectsResponse.text()).toBeTruthy();
      const dataObjects = await dataObjectsResponse.json() as Array<{ id: number; title: string }>;
      const dataObject = dataObjects[0];
      if (!dataObject) {
        test.skip(true, 'No C3 data object is available to create a temporary requirement link.');
        return;
      }

      const linkResponse = await page.request.post(`/api/v1/taxonomy/c3/${selected.uuid}/links/data-object`, {
        data: { c3_data_object_id: dataObject.id, link_role: 'core' },
      });
      expect([201, 409]).toContain(linkResponse.status());

      const linksResponse = await page.request.get(`/api/v1/taxonomy/c3/${selected.uuid}/links`);
      expect(linksResponse.ok(), await linksResponse.text()).toBeTruthy();
      const links = await linksResponse.json() as CapabilityLinkResponse;
      const createdLink = links.data_objects?.find((item) => item.entity_id === dataObject.id);
      if (linkResponse.status() === 201 && createdLink) {
        createdDataObjectLink = { capabilityUuid: selected.uuid, linkId: createdLink.id };
      }

      preview = await previewSelected();
    }
    expect(preview.read_only).toBeTruthy();
    expect(preview.coverage_delta_per_lvl3.length).toBeGreaterThan(0);

    await page.goto(`/services/${serviceId}/edit`);
    await expect(page).toHaveURL(new RegExp(`/services/${serviceId}/edit`), { timeout: 15_000 });
    const c3Section = page.locator('#readiness-governance');
    await expect(c3Section).toBeVisible({ timeout: 15_000 });
    await c3Section.getByRole('button', { name: /assign c3 taxonomy|přiřadit c3 taxonomii|priradiť c3 taxonómiu|c3-taxonomie zuweisen/i }).click();

    const capabilitySelect = c3Section
      .locator('select')
      .first();
    await expect(capabilitySelect).toBeVisible({ timeout: 15_000 });

    const previewUiResponse = page.waitForResponse((response) =>
      response.url().includes(`/api/v1/services/${serviceId}/preview-mapping`) &&
      response.request().method() === 'POST' &&
      response.ok(),
    );
    await capabilitySelect.selectOption(selected.uuid);
    await previewUiResponse;

    await expect(page.getByText(/coverage impact preview|náhled dopadu|náhľad dopadu|coverage-auswirkungs/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/affected spirals|ovlivněné spirály|ovplyvnené špirály|betroffene spiralen/i)).toBeVisible({ timeout: 15_000 });

    const saveMappingResponse = page.waitForResponse((response) =>
      response.url().includes(`/api/v1/taxonomy/mapping/${serviceId}`) &&
      response.request().method() === 'PUT' &&
      response.ok(),
    );
    await page.getByRole('button', { name: /add mapping|přidat mapování|pridať mapovanie|mapping hinzufügen/i }).click();
    await saveMappingResponse;

    const spiral = preview.affected_spirals[0] ?? 'Spiral_7';
    await page.goto(`/capabilities/${selected.slug}?spiral=${encodeURIComponent(spiral)}&tab=services`);
    await expect(page.locator(`a[href="/services/${serviceId}"]`)).toBeVisible({ timeout: 20_000 });
  } finally {
    if (createdDataObjectLink) {
      await page.request
        .delete(`/api/v1/taxonomy/c3/${createdDataObjectLink.capabilityUuid}/links/data-object/${createdDataObjectLink.linkId}`)
        .catch(() => undefined);
    }
    if (created) {
      await page.request.delete(`/api/v1/services/${serviceId}?force=true`).catch(() => undefined);
    }
  }
});
