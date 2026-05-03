import { expect, test, type Page } from '@playwright/test';

async function mockAuthenticatedService360(page: Page) {
  await page.context().addCookies([
    {
      name: 'sc_access_token',
      value: 'test-access-token',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
    {
      name: 'sc_locale',
      value: 'en',
      domain: 'localhost',
      path: '/',
      sameSite: 'Lax',
    },
  ]);

  const serviceDetail = {
    id: 42,
    service_id: 'SVC-IAM',
    title: 'Identity Access Management',
    service_type: 'platform',
    service_status: 'active',
    service_status_name: 'Active',
    portfolio_group: 'APP',
    portfolio_group_name: 'Application Services',
    summary: 'Identity and access service.',
    detailed_description: 'Controls identity lifecycle and application access.',
    global_service_group_code: null,
    global_service_group_name: null,
    service_line_code: null,
    service_line_name: null,
    value_proposition: 'Fast access with governed ownership.',
    business_purpose: 'Enable controlled access to mission applications.',
    service_features: null,
    unit_of_measure: 'user',
    charging_basis: 'monthly',
    available_on: ['CLOUD'],
    sla_availability: 99.9,
    sla_restoration: 4,
    sla_delivery: 2,
    source_url: null,
    completeness_score: 82,
    in_service_eur: null,
    flavour_count: 1,
    relation_count: 2,
    service_owner: 'Alice Owner',
    vlastnik: 'Bob Steward',
    manager: 'Carol Delivery',
    created_at: '2026-04-01T10:00:00Z',
    updated_at: '2026-04-28T10:00:00Z',
    flavours: [
      {
        id: 50,
        flavour_code: 'IAM-BASIC',
        service_id: 'SVC-IAM',
        title: 'Basic',
        service_unit: 'user',
        price_value: 10,
        currency_code: 'EUR',
        billing_period_code: 'monthly',
        initiation_cost: null,
        lifecycle_cost: null,
        lifetime_years: null,
        nations_rate: null,
        dependency_text: null,
        short_note: null,
        flavour_status_code: 'available',
        pricing_note_raw: null,
        delivery_note: null,
        technical_note: null,
        display_order: 1,
        is_orderable: true,
        created_at: '2026-04-01T10:00:00Z',
        updated_at: '2026-04-28T10:00:00Z',
      },
    ],
    relations: [
      {
        id: 60,
        from_service_id: 'SVC-IAM',
        to_service_id: 'SVC-DIR',
        from_title: 'Identity Access Management',
        to_title: 'Directory Service',
        relation_type: 'depends_on',
        relation_label: 'Directory',
        relation_note: null,
        source_field: null,
        raw_text: null,
        is_inferred: false,
        parse_confidence: 1,
        is_verified: true,
        is_mandatory: true,
        impact_mode: 'hard_stop',
        impact_level: 'high',
        pace_code: 'P1',
        is_deleted: false,
        created_at: '2026-04-01T10:00:00Z',
        created_by: 'seed',
      },
      {
        id: 61,
        from_service_id: 'SVC-PORTAL',
        to_service_id: 'SVC-IAM',
        from_title: 'Service Portal',
        to_title: 'Identity Access Management',
        relation_type: 'uses',
        relation_label: 'SSO',
        relation_note: null,
        source_field: null,
        raw_text: null,
        is_inferred: false,
        parse_confidence: 1,
        is_verified: false,
        is_mandatory: false,
        impact_mode: 'degraded',
        impact_level: 'medium',
        pace_code: 'P2',
        is_deleted: false,
        created_at: '2026-04-01T10:00:00Z',
        created_by: 'seed',
      },
    ],
    rate_note: null,
    ordering_note: null,
    exclusions: null,
    service_area: null,
    security_classification: null,
    retired_note: null,
    notes: null,
    catalogue_version: '2026.04',
    organizational_element_code: null,
    created_at_source: null,
    modified_at_source: null,
    created_by: 'seed',
    updated_by: 'admin',
    is_deleted: false,
    is_stub: false,
    is_available_status_ambiguous: false,
    cp_service_type_raw: null,
    graph_x: null,
    graph_y: null,
    prerequisites_json: null,
    dependencies_json: null,
    training_refs: null,
    source_local_id: null,
    source_sp_id: null,
    source_etag: null,
    c3_uuid: 'cap-iam',
    c3_parent_id: null,
    c3_level: '3',
    c3_domain: 'FMN',
    c3_source: 'seed',
    c3_reference: 'C3-IAM',
    c3_synced_at: '2026-04-28T10:00:00Z',
    c3_sync_status: 'synced',
    c3_is_primary: true,
    scope_text: null,
    sla_restoration_text: null,
    sla_delivery_text: null,
    operational_notes_raw: null,
    support_locations_raw: null,
    request_process_raw: null,
    support_availability_raw: null,
    service_cost_raw: null,
    additional_information_raw: null,
    service_features_raw: null,
    ext_tools_raw: null,
    legacy_ssl_mapping_raw: null,
    budget_activity_code: null,
    other_info_raw: null,
    pricing_note_raw: null,
    customer_type: null,
    options: null,
    business_summary: 'Identity and access service.',
    consumer_value: 'Faster onboarding and safer access.',
    requestable: true,
    lifecycle_state: 'live',
    lifecycle_stage_code: 'active',
    criticality_code: 'mission_critical',
    review_due_at: '2026-06-30',
    target_audience_summary: 'All mission application teams',
    request_channel_type: 'portal',
    request_channel_url: 'https://request.example/iam',
    approval_required: true,
    fulfillment_lead_time_text: '2 business days',
    review_owner_user_id: null,
    next_review_due_at: '2026-06-30',
    offerings: [
      {
        id: 10,
        service_id: 42,
        offering_code: 'STD',
        title: 'Standard Access',
        description: 'Default governed access path.',
        is_default: true,
        requestable: true,
        approval_required: true,
        request_channel_type: 'portal',
        request_channel_url: 'https://request.example/iam',
        lead_time_text: '2 business days',
        support_tier_code: 'tier1',
        status: 'active',
        display_order: 1,
        created_at: '2026-04-01T10:00:00Z',
        updated_at: '2026-04-28T10:00:00Z',
      },
    ],
    primary_offering: null,
    support_model: [
      {
        id: 20,
        service_id: 42,
        offering_id: null,
        support_owner_name: 'IAM Support',
        resolver_group: 'IAM-L2',
        support_hours_code: '24x7',
        support_channel: 'portal',
        escalation_path: 'IAM-L3',
        maintenance_window: null,
        review_cadence: 'quarterly',
        created_at: '2026-04-01T10:00:00Z',
        updated_at: '2026-04-28T10:00:00Z',
      },
    ],
    audience_policies: [],
    operational_links: [],
    business_view: {
      business_summary: 'Identity and access service.',
      consumer_value: 'Faster onboarding and safer access.',
      requestable: true,
      lifecycle_state: 'live',
      target_audience_summary: 'All mission application teams',
      request_channel_type: 'portal',
      request_channel_url: 'https://request.example/iam',
      approval_required: true,
      fulfillment_lead_time_text: '2 business days',
      primary_offering: null,
      support_model: [],
      audience_policies: [],
      operational_links: [],
    },
    technical_view: {
      service_type: 'platform',
      service_status: 'active',
      completeness_score: 82,
      relation_count: 2,
      flavour_count: 1,
      has_c3_mapping: true,
      has_primary_offering: true,
    },
  };

  const overview = {
    item: {
      service: {
        id: 42,
        service_id: 'SVC-IAM',
        title: 'Identity Access Management',
        summary: 'Identity and access service.',
        service_type: 'platform',
        service_status: 'active',
        updated_at: '2026-04-28T10:00:00Z',
      },
      portfolio: {
        id: 3,
        code: 'APP',
        title: 'Application Services',
        group_code: 'APP',
        group_name: 'Application Services',
      },
      lifecycle: {
        stage_code: 'active',
        state: 'live',
        service_status: 'active',
        criticality_code: 'mission_critical',
        requestable: true,
        review_due_at: '2026-06-30',
      },
      owners: {
        primary: { role_code: 'service_owner', display_name: 'Alice Owner', email: 'alice@example.com' },
        steward: { role_code: 'service_area_owner', display_name: 'Bob Steward', email: null },
        delivery_manager: { role_code: 'service_delivery_manager', display_name: 'Carol Delivery', email: null },
        reviewer: null,
        review_owner_user_id: null,
        assignments: [],
      },
      offerings: {
        count: 1,
        requestable_count: 1,
        primary: { id: 10, offering_code: 'STD', title: 'Standard Access', requestable: true },
        items: [],
      },
      flavours: serviceDetail.flavours,
      audience_policies: [],
      support_model: serviceDetail.support_model,
      operational_links: [],
      sla: {
        availability_pct: 99.9,
        restoration_hours: 4,
        delivery_days: 2,
        record_count: 1,
        has_sla: true,
        records: [],
      },
      pricing: {
        has_prices: true,
        requestable_without_price: false,
        flavour_count: 1,
        active_flavour_count: 1,
        priced_flavour_count: 1,
        currency_codes: ['EUR'],
        billing_period_codes: ['monthly'],
        flavours: serviceDetail.flavours,
      },
      dependencies: {
        total_count: 2,
        incoming_count: 1,
        outgoing_count: 1,
        mandatory_count: 1,
        unverified_count: 1,
        incoming: [],
        outgoing: [],
        items: [],
        raw_dependencies: [],
      },
      capability_mappings: [
        {
          mapping_id: 80,
          c3_uuid: 'cap-iam',
          code: 'C3-IAM',
          title: 'Provide Identity Services',
          mapping_type_code: 'primary',
          is_primary: true,
          status: 'partial',
        },
      ],
      c3_mappings: [],
      readiness: {
        service_id: 'SVC-IAM',
        is_publishable: false,
        blockers: ['Owner review is missing.', 'Primary capability is not complete.'],
        warnings: ['Review due within 30 days.'],
      },
      governance_risks: {
        count: 1,
        high_count: 0,
        items: [{ rule_code: 'review_due', severity: 'P2', reason: 'Review due soon' }],
      },
      audit_summary: {
        count: 1,
        last_action: { action: 'UPDATE', performed_by: 'admin', performed_at: '2026-04-28T12:00:00Z' },
        recent: [{ action: 'UPDATE', performed_by: 'admin', performed_at: '2026-04-28T12:00:00Z' }],
      },
      missing_actions: [
        {
          key: 'owner',
          title: 'Confirm owner',
          description: 'Owner review needs confirmation before publishing.',
          href: '/services/SVC-IAM/edit#ownership',
          severity: 'blocker',
        },
        {
          key: 'capability_mapping',
          title: 'Complete capability mapping',
          description: 'Primary capability still needs full coverage.',
          href: '/services/SVC-IAM/edit#c3',
          severity: 'blocker',
        },
      ],
    },
  };

  await page.route('**/api/v1/**', async (route) => {
    const url = route.request().url();

    if (url.includes('/api/v1/install/status')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'READY',
          modules: [
            { code: 'SERVICE_CATALOGUE_CORE', enabled: true, ui_visible: true, api_enabled: true },
            { code: 'C3_TAXONOMY', enabled: true, ui_visible: true, api_enabled: true },
          ],
        }),
      });
      return;
    }

    if (url.includes('/api/v1/auth/me')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          username: 'admin',
          display_name: 'Admin User',
          role: 'admin',
          auth_provider: 'local',
          preferred_lang: 'en',
          must_change_password: false,
        }),
      });
      return;
    }

    if (url.includes('/api/v1/services/SVC-IAM/overview')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(overview) });
      return;
    }

    if (url.includes('/api/v1/services/SVC-IAM/sla')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          service_id: 'SVC-IAM',
          sla_summary: { sla_availability: 99.9, sla_restoration: 4, sla_delivery: 2 },
          sla_records: [],
        }),
      });
      return;
    }

    if (url.includes('/api/v1/services/SVC-IAM/score')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ score: 82, passed: [], failed: [], breakdown: [] }),
      });
      return;
    }

    if (url.includes('/api/v1/services/SVC-IAM/roles')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      return;
    }

    if (url.includes('/api/v1/services/SVC-IAM/frameworks')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      return;
    }

    if (url.includes('/api/v1/services/SVC-IAM/c3-mappings')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          mappings: [
            {
              id: 80,
              c3_uuid: 'cap-iam',
              mapping_type_code: 'primary',
              mapping_type_name: 'Primary',
              pace_code: 'P1',
              pace_name: 'Pace 1',
              c3_level: 3,
              c3_domain: 'FMN',
              c3_source: 'seed',
              is_primary: true,
              mapping_note: null,
              synced_at: '2026-04-28T10:00:00Z',
              sync_status: 'synced',
              c3_title: 'Provide Identity Services',
              c3_external_id: 'C3-IAM',
              c3_item_type: 'CP',
              c3_item_status: 'partial',
              c3_short_title: null,
            },
          ],
        }),
      });
      return;
    }

    if (url.includes('/api/v1/services/SVC-IAM')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(serviceDetail) });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'not mocked' }),
    });
  });
}

test('service detail renders Service 360 readiness and action cockpit', async ({ page }) => {
  await mockAuthenticatedService360(page);

  await page.goto('/services/SVC-IAM');

  await expect(page.getByRole('heading', { name: 'Identity Access Management' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /service 360/i })).toBeVisible();
  await expect(page.getByText('2 blockers')).toBeVisible();
  await expect(page.getByText('1 warning')).toBeVisible();
  await expect(page.getByText('Owner review is missing.')).toBeVisible();
  await expect(page.getByText('Primary capability is not complete.')).toBeVisible();
  await expect(page.getByText('1 out / 1 in')).toBeVisible();
  await expect(page.getByText('Provide Identity Services')).toBeVisible();

  const ownerAction = page.getByRole('link', { name: /confirm owner/i });
  await expect(ownerAction).toHaveAttribute('href', '/services/SVC-IAM/edit#ownership');
});
