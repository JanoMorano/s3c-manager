'use strict';
/**
 * demo-data-seed.js
 *
 * Creates a demo dataset for Service Catalogue:
 *  - 8 demo services across lifecycle and governance states
 *  - Pricing flavours for each service
 *  - Service relationships
 *  - Role assignments (ownership)
 *  - Domain availability
 *  - C3 taxonomy demo items (c3_taxonomy) + entity records
 *  - service_c3_mapping links (SC → C3)
 *  - C3 entity links (capability → app/TIN/dataObject/C3service)
 *
 * All operations are idempotent (ON CONFLICT DO NOTHING / INSERT … WHERE NOT EXISTS).
 * Fails gracefully if C3 tables do not exist (C3 module activation is optional).
 */

const logger = require('../utils/logger');
const { normalizeLocale } = require('../../../shared/i18n/locales');

// ── Demo UUIDs (stable, deterministic) ────────────────────────────────────────
const DEMO_UUIDS = {
    CAP_BP: 'demo-bp-0001-0000-000000000001',
    CAP_BR: 'demo-br-0001-0000-000000000002',
    CAP_CP: 'demo-cp-0001-0000-000000000003',
    CAP_CI: 'demo-ci-0001-0000-000000000004',
    CAP_CO: 'demo-co-0001-0000-000000000005',
    CAP_CR: 'demo-cr-0001-0000-000000000006',
    CAP_IP: 'demo-ip-0001-0000-000000000007',
    CAP_UA: 'demo-ua-0001-0000-000000000008',
    CAP_BP_L4: 'demo-bp-0002-0000-000000000016',
    CAP_CI_L4: 'demo-ci-0002-0000-000000000017',
    CAP_UA_L4: 'demo-ua-0002-0000-000000000018',
    CAP_RPA: 'demo-cp-0003-0000-000000000019',
    CAP_GAP: 'demo-cp-0004-0000-000000000020',
    APP_01: 'demo-app-0001-0000-000000000009',
    APP_02: 'demo-app-0002-0000-000000000010',
    TIN_01: 'demo-tin-0001-0000-000000000011',
    TIN_02: 'demo-tin-0002-0000-000000000012',
    DO_01:  'demo-do--0001-0000-000000000013',
    DO_02:  'demo-do--0002-0000-000000000014',
    C3SVC_01: 'demo-svc-0001-0000-000000000015',
};

const DEMO_SERVICE_COPY = {
    en: {
        'DEMO-PIS-001': {
            short_description: 'Central integration platform for exchanging data and messages between systems.',
            description: 'Platform Integration Service (PIS) provides robust middleware for integrating heterogeneous systems. It includes an API gateway, message broker, and event bus. It supports synchronous REST/SOAP and asynchronous AMQP/Kafka communication and runs as an HA cluster with automatic failover.',
            business_purpose: 'Eliminate point-to-point integration links. Centralize monitoring of data flows. Standardize the organisation\'s integration layer.',
            scope_text: 'Covers internal system integrations, partner interfaces, and cloud APIs. Does not include end-user applications.',
            value_proposition: 'Reduces integration project TCO by ~40% through reusable connectors and centralized governance.',
            service_features: 'API Gateway, Message Broker, Event Streaming, Data Transformation, Monitoring Dashboard, 500+ prebuilt connectors',
            sla_restoration_text: 'P1 incidents: 4h RTO, P2 incidents: 8h RTO',
            sla_delivery_text: 'New connector: 5 business days from request approval',
            rate_note: 'Base fee EUR 5,000/month plus EUR 0.002 per transaction above the 1M/month threshold.',
            ordering_note: 'Request via ServiceNow (category: Middleware). Requires manager approval plus J6 approval. Service activation within 5 business days.',
            exclusions: 'Does not include end-user applications or mobile clients. Communication outside organisational networks requires a separate agreement.',
            operational_notes_raw: '24/7 NOC monitoring. Maintenance window: Sunday 02:00-04:00 UTC. Escalation contact: integration-ops@example.org.',
            notes_json: JSON.stringify({
                lifecycle_state: 'production',
                review_date: '2025-06-30',
                next_review_date: '2026-06-30',
                compliance_flags: ['NIS2', 'ISO-27001'],
                hosting_model: 'on-premise HA cluster',
                platform_ref: 'CMDB-CI-00412',
                risk_level: 'high',
                review_notes: 'Latest review completed without findings. Hybrid cloud migration is planned for Q3 2025.',
            }),
        },
        'DEMO-IAM-002': {
            short_description: 'Identity, authentication, and authorization management for users and systems across the organisation.',
            description: 'Identity & Access Management (IAM) provides central user identity management, single sign-on (SSO), MFA, and role-based access control (RBAC). It integrates with Active Directory, LDAP, and external identity providers through SAML 2.0 and OIDC, and provides a full audit trail of access events.',
            business_purpose: 'Provide secure access to applications and data while keeping the user experience simple. Meet compliance requirements (NIS2, ISO 27001).',
            scope_text: 'Covers all internal systems and cloud applications connected through SSO. Includes privileged access management (PAM).',
            value_proposition: 'Reduces unauthorized-access risk. One identity for all systems. Automated onboarding and offboarding.',
            service_features: 'SSO, MFA, RBAC, PAM, lifecycle management, self-service portal, audit logs, identity-management API',
            sla_restoration_text: 'Critical authentication path: 2h RTO, self-service features: 4h RTO',
            sla_delivery_text: 'New user: 1 business day',
            rate_note: 'Standard tier: EUR 8/user/month. Governance tier (IGA): EUR 25/user/month. Initiation fee: EUR 20,000.',
            ordering_note: 'New user: helpdesk ticket. New application (SSO integration): architecture request via J6 with a 5 business day target.',
            exclusions: 'Does not include identity management for external contractors without an NDA. Biometric systems are handled in a separate project.',
            operational_notes_raw: 'Critical dependency on Active Directory domain controllers. Geo-redundancy between Prague and Brno. PAM vault: CyberArk cluster.',
            notes_json: JSON.stringify({
                lifecycle_state: 'production',
                review_date: '2025-03-15',
                next_review_date: '2026-03-15',
                compliance_flags: ['NIS2', 'ISO-27001', 'GDPR', 'SOC2'],
                hosting_model: 'on-premise geo-redundant (Prague + Brno)',
                platform_ref: 'CMDB-CI-00198',
                risk_level: 'critical',
                review_notes: 'The NIS2 audit passed in 03/2025. Recommended next step: extend MFA to contractors in Q2 2025.',
            }),
        },
        'DEMO-DAP-003': {
            short_description: 'Analytical platform for collecting, processing, and visualizing data across the organisation.',
            description: 'Data Analytics Platform (DAP) provides end-to-end analytical capabilities: data ingestion, ETL pipelines, a data lake, an SQL warehouse, and BI dashboards. It is built on a modern lakehouse approach and supports self-service analytics for business users as well as advanced ML/AI workloads.',
            business_purpose: 'Enable data-driven decision making at every organisational level. Provide a standardized way to work with data. Reduce time-to-insight from weeks to hours.',
            scope_text: 'Covers operational reporting, strategic dashboards, and exploratory analytics. Does not include transactional systems.',
            value_proposition: 'Provides access to consolidated data. Self-service analytics without IT dependency. Scalable ML infrastructure.',
            service_features: 'Data Ingestion, ETL/ELT Pipeline, Data Lake, SQL Warehouse, BI Dashboards, ML Workbench, Data Catalog, Self-service Analytics',
            sla_restoration_text: 'P1 dashboards: 8h RTO, batch pipelines: next business day',
            sla_delivery_text: 'New dataset: 3 business days after source data delivery',
            rate_note: 'Reporting: EUR 0.10/report. Compute: EUR 0.05/CPU-hour. Ingestion: EUR 2/GB. Monthly minimum: EUR 1,000.',
            ordering_note: 'Self-service onboarding via the analytics portal. New data source: J9/CDO ticket including dataset description and classification.',
            exclusions: 'Does not include real-time OLTP databases. Production ML inference is a separate service. Data older than 7 years is archived outside the base SLA.',
            operational_notes_raw: 'Batch window: nightly 22:00-06:00. Streaming workloads run 24/7. Cluster: Databricks + Delta Lake. Backup: daily snapshot to cold storage.',
            notes_json: JSON.stringify({
                lifecycle_state: 'production',
                review_date: '2025-09-01',
                next_review_date: '2026-09-01',
                compliance_flags: ['GDPR', 'NIS2'],
                hosting_model: 'hybrid cloud (Azure + on-premise DWH)',
                platform_ref: 'CMDB-CI-00731',
                risk_level: 'medium',
                review_notes: 'Planned migration of the DWH layer to Azure Synapse in Q4 2025. Data classification completed in 08/2025.',
            }),
        },
    },
};

function getDemoServiceCopy(locale, serviceId) {
    const normalizedLocale = normalizeLocale(locale);
    return DEMO_SERVICE_COPY[normalizedLocale]?.[serviceId] ?? {};
}

function resolveDemoSeedLocale(locale) {
    if (typeof locale === 'string' && locale.trim()) {
        return normalizeLocale(locale);
    }

    return normalizeLocale(
        process.env.LC_ALL
        || process.env.LC_MESSAGES
        || process.env.LANG
        || 'cs',
    );
}

function buildDemoServices(locale = 'cs') {
    const resolvedLocale = resolveDemoSeedLocale(locale);
    const services = [
        {
            service_id: 'DEMO-PIS-001',
            title: '[DEMO] Platform Integration Service',
            service_type_code: 'CF',
            service_status_code: 'active',
            catalogue_version: '2.1',
            portfolio_group_code: 'SHARED',
            global_service_group_code: 'INFRA',
            service_line_code: 'INTEGRATION',
            organizational_element_code: 'CIS',
            // §2 Description
            short_description: 'Centrální integrační platforma zajišťující výměnu dat a zpráv mezi systémy organisace.',
            description: 'Platform Integration Service (PIS) poskytuje robustní middleware pro integraci heterogenních systémů. Zahrnuje API gateway, message broker a event bus. Umožňuje synchronní REST/SOAP a asynchronní AMQP/Kafka komunikaci. Nasazena jako HA cluster s automatickým failover.',
            business_purpose: 'Eliminace point-to-point integračních vazeb. Centralizovaný monitoring toků dat. Standardizace integrační vrstvy organisace.',
            scope_text: 'Pokrývá integraci interních systémů, napojení partnerských rozhraní a cloud API. Nezahrnuje end-user aplikace.',
            value_proposition: 'Snižuje TCO integračních projektů o ~40% díky znovupoužitelným konektorům a centralizované správě.',
            service_features: 'API Gateway, Message Broker, Event Streaming, Data Transformation, Monitoring Dashboard, 500+ předdefinovaných konektorů',
            // §5 Availability / SLA
            sla_availability: 99.9,
            sla_restoration_hours: 4,
            sla_delivery_days: 5,
            sla_restoration_text: 'Kategorie P1: 4h RTO, P2: 8h RTO',
            sla_delivery_text: 'Nový konektor: 5 pracovních dnů od požadavku',
            // §10 Governance
            security_classification_code: 'RESTRICTED',
            retired_note: null,
            // §11 Technical
            service_url: 'https://integration.example.org/portal',
            unit_of_measure: 'per transaction / per month',
            charging_basis: 'Volume + Base fee',
            rate_note: 'Základní paušál 5 000 EUR/měsíc + 0.002 EUR/transakci nad limit 1M/měsíc.',
            ordering_note: 'Požadavek přes ServiceNow (kategorie: Middleware). Schválení vedoucího oddělení + J6. Zprovoznění do 5 pracovních dnů.',
            exclusions: 'Nezahrnuje end-user aplikace ani mobilní klienty. Komunikace mimo organisační sítě podléhá samostatné dohodě.',
            customer_type: ['Internal', 'Partner'],
            operational_notes_raw: '24/7 monitoring NOC. Maintenance window: neděle 02:00-04:00 UTC. Escalační kontakt: integration-ops@example.org.',
            budget_activity_code: 'BA-INFRA-2024',
            // §12 Review / structured notes
            notes_json: JSON.stringify({
                lifecycle_state: 'production',
                review_date: '2025-06-30',
                next_review_date: '2026-06-30',
                compliance_flags: ['NIS2', 'ISO-27001'],
                hosting_model: 'on-premise HA cluster',
                platform_ref: 'CMDB-CI-00412',
                risk_level: 'high',
                review_notes: 'Poslední review proběhl bez nálezů. Plánovaná migrace na cloud hybrid v Q3 2025.',
            }),
            ...getDemoServiceCopy(resolvedLocale, 'DEMO-PIS-001'),
        },
        {
            service_id: 'DEMO-IAM-002',
            title: '[DEMO] Identity & Access Management',
            service_type_code: 'ES',
            service_status_code: 'active',
            catalogue_version: '2.1',
            portfolio_group_code: 'SECURITY',
            global_service_group_code: 'SEC',
            service_line_code: 'IDENTITY',
            organizational_element_code: 'CSO',
            // §2 Description
            short_description: 'Správa identit, autentizace a autorizace uživatelů a systémů napříč celou organisací.',
            description: 'Identity & Access Management (IAM) zajišťuje centrální správu uživatelských identit, single sign-on (SSO), MFA a role-based access control (RBAC). Integruje se s Active Directory, LDAP a externími IdP (SAML 2.0, OIDC). Poskytuje auditní trail všech přístupů.',
            business_purpose: 'Zajištění bezpečného přístupu k aplikacím a datům při zachování uživatelského komfortu. Splnění compliance požadavků (NIS2, ISO 27001).',
            scope_text: 'Pokrývá všechny interní systémy a cloudové aplikace napojené přes SSO. Zahrnuje privileged access management (PAM).',
            value_proposition: 'Snižuje riziko neoprávněného přístupu. Single identity pro všechny systémy. Automatizované onboarding/offboarding.',
            service_features: 'SSO, MFA, RBAC, PAM, Lifecycle Management, Self-service portal, Audit logs, API pro správu identit',
            // §5 Availability / SLA
            sla_availability: 99.95,
            sla_restoration_hours: 2,
            sla_delivery_days: 1,
            sla_restoration_text: 'Auth kritická cesta: 2h RTO, Self-service: 4h RTO',
            sla_delivery_text: 'Nový uživatel: 1 pracovní den',
            // §10 Governance
            security_classification_code: 'CONFIDENTIAL',
            retired_note: null,
            // §11 Technical
            service_url: 'https://iam.example.org',
            unit_of_measure: 'per user / per month',
            charging_basis: 'Per seat',
            rate_note: 'Standard tier: 8 EUR/user/měsíc. Governance tier (IGA): 25 EUR/user/měsíc. Initiation fee: 20 000 EUR.',
            ordering_note: 'Nový uživatel: helpdesk ticket. Nová aplikace (SSO integrace): architektonická žádost přes J6 — lhůta 5 prac. dní.',
            exclusions: 'Nezahrnuje správu identit externích dodavatelů bez smlouvy NDA. Biometrické systémy jsou v samostatném projektu.',
            customer_type: ['Internal'],
            operational_notes_raw: 'Kritická závislost na DC Active Directory. Georedundance Praha/Brno. PAM vault: Cyberark cluster.',
            budget_activity_code: 'BA-SEC-2024',
            // §12 Review / structured notes
            notes_json: JSON.stringify({
                lifecycle_state: 'production',
                review_date: '2025-03-15',
                next_review_date: '2026-03-15',
                compliance_flags: ['NIS2', 'ISO-27001', 'GDPR', 'SOC2'],
                hosting_model: 'on-premise georedundant (Praha + Brno)',
                platform_ref: 'CMDB-CI-00198',
                risk_level: 'critical',
                review_notes: 'Audit NIS2 proběhl 03/2025 — splněno. Doporučení: rozšíření MFA na dodavatele do Q2 2025.',
            }),
            ...getDemoServiceCopy(resolvedLocale, 'DEMO-IAM-002'),
        },
        {
            service_id: 'DEMO-DAP-003',
            title: '[DEMO] Data Analytics Platform',
            service_type_code: 'SS',
            service_status_code: 'active',
            catalogue_version: '2.1',
            portfolio_group_code: 'DATA',
            global_service_group_code: 'ANALYTICS',
            service_line_code: 'BI',
            organizational_element_code: 'CDO',
            // §2 Description
            short_description: 'Analytická platforma pro sběr, zpracování a vizualizaci dat z celé organisace.',
            description: 'Data Analytics Platform (DAP) poskytuje end-to-end analytické kapacity: data ingestion, ETL pipeline, data lake, SQL warehouse a BI dashboardy. Postavena na moderním lakehouse přístupu. Podporuje self-service analytiku pro business uživatele i pokročilé ML/AI workloady.',
            business_purpose: 'Datově řízené rozhodování na všech úrovních organisace. Standardizovaný přístup k datům. Zkrácení time-to-insight z týdnů na hodiny.',
            scope_text: 'Pokrývá provozní reporting, strategické dashboardy a experimentální analytiku. Nezahrnuje transakční systémy.',
            value_proposition: 'Přístup ke konsolidovaným datům. Self-service analytika bez závislosti na IT. Škálovatelná ML infrastruktura.',
            service_features: 'Data Ingestion, ETL/ELT Pipeline, Data Lake, SQL Warehouse, BI Dashboards, ML Workbench, Data Catalog, Self-service Analytics',
            // §5 Availability / SLA
            sla_availability: 99.5,
            sla_restoration_hours: 8,
            sla_delivery_days: 3,
            sla_restoration_text: 'Dashboardy P1: 8h, Batch pipeline: next-day',
            sla_delivery_text: 'Nový dataset: 3 pracovní dny od dodání dat',
            // §10 Governance
            security_classification_code: 'RESTRICTED',
            retired_note: null,
            // §11 Technical
            service_url: 'https://analytics.example.org',
            unit_of_measure: 'per report / per compute-hour',
            charging_basis: 'Usage-based',
            rate_note: 'Reporting: 0,10 EUR/report. Compute: 0,05 EUR/CPU-hour. Ingestion: 2 EUR/GB. Měsíční minimum 1 000 EUR.',
            ordering_note: 'Self-service onboarding přes analytický portál. Nový datový zdroj: ticket J9/CDO s popisem datasetu a klasifikací.',
            exclusions: 'Nezahrnuje real-time OLTP databáze. ML inference v produkci je samostatná služba. Data starší 7 let jsou v archivu mimo základní SLA.',
            customer_type: ['Internal', 'Command'],
            operational_notes_raw: 'Batch okno: noc 22:00-06:00. Streaming zpracování 24/7. Cluster: Databricks + Delta Lake. Backup: denní snapshot do cold storage.',
            budget_activity_code: 'BA-DATA-2024',
            // §12 Review / structured notes
            notes_json: JSON.stringify({
                lifecycle_state: 'production',
                review_date: '2025-09-01',
                next_review_date: '2026-09-01',
                compliance_flags: ['GDPR', 'NIS2'],
                hosting_model: 'hybrid cloud (Azure + on-premise DWH)',
                platform_ref: 'CMDB-CI-00731',
                risk_level: 'medium',
                review_notes: 'Plánovaná migrace DWH vrstvy na Azure Synapse v Q4 2025. Datová klasifikace provedena 08/2025.',
            }),
            ...getDemoServiceCopy(resolvedLocale, 'DEMO-DAP-003'),
        },
        {
            service_id: 'DEMO-RPA-004',
            title: '[DEMO] Process Automation Service',
            service_type_code: 'MS',
            service_status_code: 'planned',
            catalogue_version: '2.1',
            portfolio_group_code: 'SHARED',
            global_service_group_code: 'INFRA',
            service_line_code: 'INTEGRATION',
            organizational_element_code: 'CIS',
            short_description: 'Automation service for repeatable back-office workflows and approval orchestration.',
            description: 'Process Automation Service provides managed robotic process automation, workflow orchestration, and low-code integration patterns for repeatable business tasks.',
            business_purpose: 'Reduce manual hand-offs and standardize approval workflows before moving them into core systems.',
            scope_text: 'Covers tactical automations, approval workflows, and assisted integrations.',
            value_proposition: 'Creates quick wins while governance reviews decide whether a process deserves productization.',
            service_features: 'Workflow templates, attended automation, queue monitoring, approval routing',
            sla_availability: 99.0,
            sla_restoration_hours: 12,
            sla_delivery_days: 10,
            service_url: 'https://automation.example.org',
            security_classification_code: 'RESTRICTED',
            unit_of_measure: 'per workflow / month',
            charging_basis: 'Workflow tier',
            rate_note: 'Standard workflow EUR 750/month; enterprise workflow EUR 1,600/month.',
            ordering_note: 'Request through governance review with process owner approval.',
            customer_type: ['Internal'],
            operational_notes_raw: 'Managed by automation center of excellence.',
            budget_activity_code: 'BA-INFRA-2024',
            lifecycle_state: 'under_review',
            lifecycle_stage_code: 'design',
            criticality_code: 'standard',
            requestable: true,
            next_review_due_at: '2026-05-31T00:00:00Z',
            review_due_at: '2026-05-31T00:00:00Z',
            notes_json: JSON.stringify({ demo_signal: 'incomplete_primary_mapping', risk_level: 'medium' }),
        },
        {
            service_id: 'DEMO-LRG-005',
            title: '[DEMO] Legacy Reporting Gateway',
            service_type_code: 'SS',
            service_status_code: 'deprecated',
            catalogue_version: '2.1',
            portfolio_group_code: 'DATA',
            global_service_group_code: 'ANALYTICS',
            service_line_code: 'BI',
            organizational_element_code: 'CDO',
            short_description: 'Legacy reporting gateway kept temporarily for contractual reporting feeds.',
            description: 'Legacy Reporting Gateway proxies old report consumers into the analytics platform while consumers migrate to modern dashboards.',
            business_purpose: 'Keep legacy reporting consumers stable during migration.',
            scope_text: 'Read-only reporting feeds and scheduled exports.',
            value_proposition: 'Controls retirement risk by making remaining consumers visible.',
            service_features: 'Legacy export scheduler, report proxy, consumer inventory',
            sla_availability: 98.5,
            sla_restoration_hours: 24,
            sla_delivery_days: 15,
            service_url: 'https://legacy-reporting.example.org',
            security_classification_code: 'RESTRICTED',
            unit_of_measure: 'per report feed',
            charging_basis: 'Migration exception',
            rate_note: 'No new consumers; cost recovered through migration program.',
            ordering_note: 'New requests are blocked; use Data Analytics Platform instead.',
            customer_type: ['Internal'],
            operational_notes_raw: 'Retirement candidate, no new integrations accepted.',
            budget_activity_code: 'BA-DATA-2024',
            lifecycle_state: 'deprecated',
            lifecycle_stage_code: 'retiring',
            criticality_code: 'important',
            requestable: false,
            next_review_due_at: '2026-05-15T00:00:00Z',
            review_due_at: '2026-05-15T00:00:00Z',
            retired_note: 'Target retirement after final consumer migration.',
            notes_json: JSON.stringify({ demo_signal: 'retiring_service', risk_level: 'high' }),
        },
        {
            service_id: 'DEMO-DOC-006',
            title: '[DEMO] Document Collaboration Workspace',
            service_type_code: 'CF',
            service_status_code: 'draft',
            catalogue_version: '2.1',
            portfolio_group_code: 'SHARED',
            global_service_group_code: 'INFRA',
            service_line_code: 'INTEGRATION',
            organizational_element_code: 'CIS',
            short_description: 'Draft collaboration workspace service with intentionally incomplete governance metadata.',
            description: 'Document Collaboration Workspace demonstrates readiness blockers: missing owner, incomplete capability mapping, and pending decision.',
            business_purpose: 'Provide a safe demo record for readiness queue and governance review workflows.',
            scope_text: 'Draft internal collaboration use case.',
            value_proposition: 'Shows how a service moves from draft to governed catalogue entry.',
            service_features: 'Workspace templates, retention policies, team access',
            sla_availability: null,
            sla_restoration_hours: null,
            sla_delivery_days: 7,
            service_url: 'https://docs.example.org',
            security_classification_code: 'RESTRICTED',
            unit_of_measure: 'per workspace',
            charging_basis: 'Per workspace',
            rate_note: null,
            ordering_note: 'Blocked until owner and readiness review are assigned.',
            customer_type: ['Internal'],
            operational_notes_raw: 'Intentionally incomplete for readiness demo.',
            budget_activity_code: 'BA-INFRA-2024',
            lifecycle_state: 'draft',
            lifecycle_stage_code: 'draft',
            criticality_code: 'standard',
            requestable: false,
            next_review_due_at: null,
            review_due_at: null,
            notes_json: JSON.stringify({ demo_signal: 'readiness_blocker', risk_level: 'medium' }),
        },
        {
            service_id: 'DEMO-OBS-007',
            title: '[DEMO] Observability Command Center',
            service_type_code: 'ES',
            service_status_code: 'active',
            catalogue_version: '2.1',
            portfolio_group_code: 'SHARED',
            global_service_group_code: 'INFRA',
            service_line_code: 'INTEGRATION',
            organizational_element_code: 'CIS',
            short_description: 'Central observability service for service health, telemetry, and alert correlation.',
            description: 'Observability Command Center aggregates logs, metrics, traces, and service health signals for governed services.',
            business_purpose: 'Reduce incident diagnosis time and provide operational evidence for reviews.',
            scope_text: 'Monitoring, telemetry, and alert correlation for catalogue services.',
            value_proposition: 'Makes ownership and readiness issues visible before operational impact.',
            service_features: 'Metrics, logs, traces, dashboards, alert routing',
            sla_availability: 99.9,
            sla_restoration_hours: 4,
            sla_delivery_days: 3,
            service_url: 'https://observability.example.org',
            security_classification_code: 'RESTRICTED',
            unit_of_measure: 'per monitored service',
            charging_basis: 'Telemetry volume',
            rate_note: 'EUR 120/service/month plus telemetry volume.',
            ordering_note: 'Request via platform operations.',
            customer_type: ['Internal', 'Operations'],
            operational_notes_raw: 'Consumes signals from PIS, IAM, DAP, and automation.',
            budget_activity_code: 'BA-INFRA-2024',
            lifecycle_state: 'live',
            lifecycle_stage_code: 'active',
            criticality_code: 'mission_critical',
            requestable: true,
            next_review_due_at: '2026-06-15T00:00:00Z',
            review_due_at: '2026-06-15T00:00:00Z',
            notes_json: JSON.stringify({ demo_signal: 'owner_load', risk_level: 'critical' }),
        },
        {
            service_id: 'DEMO-LEG-008',
            title: '[DEMO] Retired Field Portal',
            service_type_code: 'CF',
            service_status_code: 'retired',
            catalogue_version: '2.1',
            portfolio_group_code: 'DATA',
            global_service_group_code: 'ANALYTICS',
            service_line_code: 'BI',
            organizational_element_code: 'CDO',
            short_description: 'Retired portal kept as historical evidence for impact and lifecycle views.',
            description: 'Retired Field Portal was replaced by modern analytics and collaboration workflows.',
            business_purpose: 'Demonstrate retired lifecycle handling and historical dependency traces.',
            scope_text: 'Historical record only.',
            value_proposition: 'Shows what retired services look like without deleting audit context.',
            service_features: 'Historical catalogue record',
            sla_availability: null,
            sla_restoration_hours: null,
            sla_delivery_days: null,
            service_url: null,
            security_classification_code: 'RESTRICTED',
            unit_of_measure: 'n/a',
            charging_basis: 'Retired',
            rate_note: null,
            ordering_note: 'Do not request; replacement is Data Analytics Platform.',
            customer_type: ['Internal'],
            operational_notes_raw: 'Retired demo service.',
            budget_activity_code: 'BA-DATA-2024',
            lifecycle_state: 'retired',
            lifecycle_stage_code: 'retired',
            criticality_code: 'standard',
            requestable: false,
            next_review_due_at: null,
            review_due_at: null,
            retired_note: 'Replaced by DEMO-DAP-003.',
            notes_json: JSON.stringify({ demo_signal: 'retired_service', risk_level: 'low' }),
        },
    ];
    const defaultsByStatus = {
        active: { requestable: true, lifecycle_state: 'live', lifecycle_stage_code: 'active', criticality_code: 'important', next_review_due_at: '2026-06-30T00:00:00Z', review_due_at: '2026-06-30T00:00:00Z' },
        planned: { requestable: true, lifecycle_state: 'under_review', lifecycle_stage_code: 'design', criticality_code: 'standard', next_review_due_at: '2026-05-31T00:00:00Z', review_due_at: '2026-05-31T00:00:00Z' },
        draft: { requestable: false, lifecycle_state: 'draft', lifecycle_stage_code: 'draft', criticality_code: 'standard', next_review_due_at: null, review_due_at: null },
        deprecated: { requestable: false, lifecycle_state: 'deprecated', lifecycle_stage_code: 'retiring', criticality_code: 'important', next_review_due_at: '2026-05-15T00:00:00Z', review_due_at: '2026-05-15T00:00:00Z' },
        retired: { requestable: false, lifecycle_state: 'retired', lifecycle_stage_code: 'retired', criticality_code: 'standard', next_review_due_at: null, review_due_at: null },
    };
    return services.map((service) => ({
        ...(defaultsByStatus[service.service_status_code] ?? defaultsByStatus.draft),
        ...service,
    }));
}

// ── Helper ──────────────────────────────────────────────────────────────────────
async function safeQuery(pool, sql, params = [], label = '') {
    try {
        return await pool.query(sql, params);
    } catch (err) {
        // 42P01 = undefined_table (C3 module is not installed)
        // 23505 = unique violation (record already exists, which is OK)
        if (err.code === '42P01') {
            logger.warn(`demo-seed: table does not exist (skipped) — ${label}`);
            return null;
        }
        if (err.code === '23505') return null; // already exists
        // 23503 = foreign_key_violation; log it but do not interrupt seeding.
        if (err.code === '23503') {
            logger.warn(`demo-seed: FK violation (skipped) — ${label}: ${err.detail || err.message}`);
            return null;
        }
        throw err;
    }
}

// ── 0. REFERENCE DATA — ensure codes exist for demo services ─────────────────
async function seedReferenceData(pool) {
    // Portfolio groups used by demo data.
    await safeQuery(pool, `
        INSERT INTO data.ref_portfolio_group (code, name, sort_order)
        VALUES
            ('SHARED',   'Shared Services',   50),
            ('SECURITY', 'Security Services',  51),
            ('DATA',     'Data Services',      52)
        ON CONFLICT (code) DO NOTHING
    `, [], 'ref_portfolio_group:demo');

    await safeQuery(pool, `
        INSERT INTO data.service_portfolio (portfolio_code, title, description, status_code)
        VALUES
            ('SHARED',   'Shared Services',   'Common platforms, integration, collaboration, and operational command services.', 'active'),
            ('SECURITY', 'Security Services', 'Identity, access, assurance, and security governance services.', 'active'),
            ('DATA',     'Data Services',     'Analytics, reporting, and data-product services across the organisation.', 'active')
        ON CONFLICT (portfolio_code) DO UPDATE SET
            title       = EXCLUDED.title,
            description = EXCLUDED.description,
            status_code = EXCLUDED.status_code,
            updated_at  = CURRENT_TIMESTAMP
    `, [], 'service_portfolio:demo');

    // Global service groups
    await safeQuery(pool, `
        INSERT INTO data.ref_global_service_group (code, name, portfolio_group_code)
        VALUES
            ('INFRA',     'Infrastructure',    'SHARED'),
            ('SEC',       'Security',          'SECURITY'),
            ('ANALYTICS', 'Analytics & Data',  'DATA')
        ON CONFLICT (code) DO NOTHING
    `, [], 'ref_global_service_group:demo');

    // Service lines
    await safeQuery(pool, `
        INSERT INTO data.ref_service_line (code, name, global_service_group_code)
        VALUES
            ('INTEGRATION', 'Integration Services', 'INFRA'),
            ('IDENTITY',    'Identity Management',  'SEC'),
            ('BI',          'Business Intelligence', 'ANALYTICS')
        ON CONFLICT (code) DO NOTHING
    `, [], 'ref_service_line:demo');

    // Organizational elements
    await safeQuery(pool, `
        INSERT INTO data.ref_organizational_element (code, name)
        VALUES
            ('CIS', 'Communications & Information Services'),
            ('CSO', 'Chief Security Office'),
            ('CDO', 'Chief Data Office')
        ON CONFLICT (code) DO NOTHING
    `, [], 'ref_organizational_element:demo');

    // Security classifications
    await safeQuery(pool, `
        INSERT INTO data.ref_security_classification (code, name, sort_order)
        VALUES
            ('RESTRICTED',   'Restricted',   10),
            ('CONFIDENTIAL', 'Confidential', 11)
        ON CONFLICT (code) DO NOTHING
    `, [], 'ref_security_classification:demo');

    // Pace categories for demo data (Wardley Pace Layer model), max 10 characters.
    await safeQuery(pool, `
        INSERT INTO data.ref_pace_category (code, name, sort_order, description)
        VALUES
            ('DIFF',  'Differentiation', 10, 'Custom-built, competitive differentiator'),
            ('SYS',   'Systems',         11, 'Product / packaged solution'),
            ('COMM',  'Commodity',       12, 'Standardized, utility-like service'),
            ('INNOV', 'Innovation',      13, 'Experimental, exploratory capability')
        ON CONFLICT (code) DO NOTHING
    `, [], 'ref_pace_category:demo');

    // C3 mapping types pro demo data
    await safeQuery(pool, `
        INSERT INTO data.ref_c3_mapping_type (code, name, description)
        VALUES
            ('primary',    'Primary',    'Služba je primárním poskytovatelem C3 capability'),
            ('implements', 'Implements', 'Služba implementuje C3 capability nebo service'),
            ('supports',   'Supports',   'Služba podporuje splnění C3 požadavku')
        ON CONFLICT (code) DO NOTHING
    `, [], 'ref_c3_mapping_type:demo');

    // C3 Capability Domains: required for the /c3/graph domain filter.
    await safeQuery(pool, `
        INSERT INTO data.ref_c3_capability_domain
            (code, css_class, heading_color, background_color, label, sort_order, is_active)
        VALUES
            ('Capabilities',           'dom-cap',  '#1b8f52', '#b8ddd0', 'CAPABILITIES',                    0, TRUE),
            ('BusinessProcesses',      'dom-bp',   '#e65c00', '#ffd0a0', 'BUSINESS PROCESSES',              1, TRUE),
            ('BusinessRoles',          'dom-br',   '#c2185b', '#f8bbd0', 'BUSINESS ROLES',                  2, TRUE),
            ('InformationProducts',    'dom-ip',   '#1565c0', '#bbdefb', 'INFORMATION PRODUCTS',            3, TRUE),
            ('UserApplications',       'dom-ua',   '#7b1fa2', '#e1bee7', 'USER APPLICATIONS',               4, TRUE),
            ('COIServices',            'dom-coi',  '#f57f17', '#ffe082', 'COMMUNITY OF INTEREST SERVICES',  5, TRUE),
            ('CoreServices',           'dom-core', '#283593', '#c5cae9', 'CORE SERVICES',                   6, TRUE),
            ('CommunicationsServices', 'dom-com',  '#37474f', '#cfd8dc', 'COMMUNICATIONS SERVICES',         7, TRUE)
        ON CONFLICT (code) DO UPDATE SET
            heading_color    = EXCLUDED.heading_color,
            background_color = EXCLUDED.background_color,
            label            = EXCLUDED.label,
            sort_order       = EXCLUDED.sort_order,
            is_active        = TRUE,
            updated_at       = CURRENT_TIMESTAMP
    `, [], 'ref_c3_capability_domain:demo');

    logger.info('demo-seed: reference data OK');
}

// ── 1. SERVICE CATALOGUE — 3 demo services ───────────────────────────────────
async function seedServices(pool, locale = 'cs') {
    const services = buildDemoServices(locale);
    for (const svc of services) {
        await safeQuery(pool, `
            INSERT INTO data.service_catalog (
                service_id, title, service_type_code, service_status_code, catalogue_version,
                portfolio_group_code, global_service_group_code, service_line_code, organizational_element_code,
                short_description, description, business_purpose, scope_text,
                value_proposition, service_features,
                sla_availability, sla_restoration_hours, sla_delivery_days,
                sla_restoration_text, sla_delivery_text,
                service_url, security_classification_code,
                unit_of_measure, charging_basis, rate_note, ordering_note,
                exclusions, customer_type_json, operational_notes_raw, budget_activity_code,
                retired_note, notes_json,
                requestable, lifecycle_state, next_review_due_at, review_due_at,
                lifecycle_stage_code, criticality_code,
                is_deleted, is_stub, created_by, updated_by
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9,
                $10, $11, $12, $13, $14, $15,
                $16, $17, $18, $19, $20,
                $21, $22, $23, $24, $25, $26,
                $27, $28, $29, $30,
                $31, $32,
                $33, $34, $35, $36, $37, $38,
                FALSE, FALSE, 'demo-seed', 'demo-seed'
            )
            ON CONFLICT (service_id) DO UPDATE SET
                is_deleted                    = FALSE,
                title                         = EXCLUDED.title,
                service_type_code             = EXCLUDED.service_type_code,
                service_status_code           = EXCLUDED.service_status_code,
                portfolio_group_code          = EXCLUDED.portfolio_group_code,
                global_service_group_code     = EXCLUDED.global_service_group_code,
                service_line_code             = EXCLUDED.service_line_code,
                organizational_element_code   = EXCLUDED.organizational_element_code,
                short_description             = EXCLUDED.short_description,
                description                   = EXCLUDED.description,
                business_purpose              = EXCLUDED.business_purpose,
                scope_text                    = EXCLUDED.scope_text,
                security_classification_code  = EXCLUDED.security_classification_code,
                sla_availability              = EXCLUDED.sla_availability,
                sla_restoration_hours         = EXCLUDED.sla_restoration_hours,
                sla_delivery_days             = EXCLUDED.sla_delivery_days,
                sla_restoration_text          = EXCLUDED.sla_restoration_text,
                sla_delivery_text             = EXCLUDED.sla_delivery_text,
                service_url                   = EXCLUDED.service_url,
                unit_of_measure               = EXCLUDED.unit_of_measure,
                charging_basis                = EXCLUDED.charging_basis,
                rate_note                     = EXCLUDED.rate_note,
                ordering_note                 = EXCLUDED.ordering_note,
                exclusions                    = EXCLUDED.exclusions,
                customer_type_json            = EXCLUDED.customer_type_json,
                operational_notes_raw         = EXCLUDED.operational_notes_raw,
                budget_activity_code          = EXCLUDED.budget_activity_code,
                retired_note                  = EXCLUDED.retired_note,
                notes_json                    = EXCLUDED.notes_json,
                requestable                   = EXCLUDED.requestable,
                lifecycle_state               = EXCLUDED.lifecycle_state,
                next_review_due_at            = EXCLUDED.next_review_due_at,
                review_due_at                 = EXCLUDED.review_due_at,
                lifecycle_stage_code          = EXCLUDED.lifecycle_stage_code,
                criticality_code              = EXCLUDED.criticality_code,
                updated_by                    = 'demo-seed',
                updated_at                    = CURRENT_TIMESTAMP
        `, [
            svc.service_id, svc.title, svc.service_type_code, svc.service_status_code, svc.catalogue_version,
            svc.portfolio_group_code, svc.global_service_group_code, svc.service_line_code, svc.organizational_element_code,
            svc.short_description, svc.description, svc.business_purpose, svc.scope_text,
            svc.value_proposition, svc.service_features,
            svc.sla_availability, svc.sla_restoration_hours, svc.sla_delivery_days,
            svc.sla_restoration_text, svc.sla_delivery_text,
            svc.service_url, svc.security_classification_code,
            svc.unit_of_measure, svc.charging_basis, svc.rate_note ?? null, svc.ordering_note ?? null,
            svc.exclusions ?? null, JSON.stringify(svc.customer_type ?? []), svc.operational_notes_raw, svc.budget_activity_code,
            svc.retired_note ?? null, svc.notes_json ?? null,
            svc.requestable ?? null, svc.lifecycle_state ?? null, svc.next_review_due_at ?? null, svc.review_due_at ?? null,
            svc.lifecycle_stage_code ?? null, svc.criticality_code ?? null,
        ], `service_catalog:${svc.service_id}`);
    }
    logger.info('demo-seed: services OK');
}

async function seedPortfolioAssignments(pool) {
    await safeQuery(pool, `
        UPDATE data.service_catalog sc
        SET portfolio_id = sp.id,
            updated_at = CURRENT_TIMESTAMP
        FROM data.service_portfolio sp
        WHERE sc.service_id LIKE 'DEMO-%'
          AND sc.portfolio_group_code = sp.portfolio_code
          AND sc.is_deleted = FALSE
    `, [], 'service_catalog:demo-portfolio-assignment');
    logger.info('demo-seed: portfolio assignments OK');
}

function buildDemoOfferings() {
    return [
        { service_id: 'DEMO-PIS-001', offering_code: 'PIS-API', title: 'API integration channel', description: 'Reusable API integration for governed services.', is_default: true, requestable: true, approval_required: true, support_tier_code: 'standard', status: 'active', display_order: 1 },
        { service_id: 'DEMO-PIS-001', offering_code: 'PIS-EVENT', title: 'Event stream channel', description: 'Asynchronous event stream with monitoring.', is_default: false, requestable: true, approval_required: true, support_tier_code: 'premium', status: 'active', display_order: 2 },
        { service_id: 'DEMO-IAM-002', offering_code: 'IAM-SSO', title: 'SSO onboarding', description: 'Application onboarding to centralized SSO.', is_default: true, requestable: true, approval_required: true, support_tier_code: 'standard', status: 'active', display_order: 1 },
        { service_id: 'DEMO-IAM-002', offering_code: 'IAM-PAM', title: 'Privileged access vault', description: 'Privileged account management and vault onboarding.', is_default: false, requestable: true, approval_required: true, support_tier_code: 'premium', status: 'active', display_order: 2 },
        { service_id: 'DEMO-DAP-003', offering_code: 'DAP-DASH', title: 'Dashboard workspace', description: 'Governed BI workspace with standard datasets.', is_default: true, requestable: true, approval_required: true, support_tier_code: 'standard', status: 'active', display_order: 1 },
        { service_id: 'DEMO-DAP-003', offering_code: 'DAP-ML', title: 'ML compute workspace', description: 'GPU-backed experimentation workspace.', is_default: false, requestable: true, approval_required: true, support_tier_code: 'premium', status: 'active', display_order: 2 },
        { service_id: 'DEMO-RPA-004', offering_code: 'RPA-WORKFLOW', title: 'Workflow automation', description: 'Managed workflow automation package.', is_default: true, requestable: true, approval_required: true, support_tier_code: 'standard', status: 'draft', display_order: 1 },
        { service_id: 'DEMO-RPA-004', offering_code: 'RPA-AUDIT', title: 'Audited automation', description: 'Automation with additional audit evidence.', is_default: false, requestable: true, approval_required: true, support_tier_code: 'premium', status: 'draft', display_order: 2 },
        { service_id: 'DEMO-LRG-005', offering_code: 'LRG-EXPORT', title: 'Legacy export exception', description: 'Temporary report export exception.', is_default: true, requestable: false, approval_required: true, support_tier_code: 'best_effort', status: 'deprecated', display_order: 1 },
        { service_id: 'DEMO-DOC-006', offering_code: 'DOC-WORKSPACE', title: 'Draft workspace', description: 'Draft offering blocked by readiness.', is_default: true, requestable: false, approval_required: true, support_tier_code: 'standard', status: 'draft', display_order: 1 },
        { service_id: 'DEMO-OBS-007', offering_code: 'OBS-SERVICE', title: 'Service observability', description: 'Telemetry onboarding for one service.', is_default: true, requestable: true, approval_required: false, support_tier_code: 'standard', status: 'active', display_order: 1 },
        { service_id: 'DEMO-LEG-008', offering_code: 'LEG-HISTORY', title: 'Historical reference', description: 'Retired service evidence only.', is_default: true, requestable: false, approval_required: false, support_tier_code: 'none', status: 'retired', display_order: 1 },
    ];
}

async function seedOfferings(pool) {
    for (const offering of buildDemoOfferings()) {
        await safeQuery(pool, `
            INSERT INTO data.service_offering (
                service_id, offering_code, title, description, is_default, requestable,
                approval_required, request_channel_type, request_channel_url,
                lead_time_text, support_tier_code, status, display_order
            )
            SELECT sc.id, $2, $3, $4, $5, $6, $7, 'portal', sc.service_url,
                   'Demo fulfilment target', $8, $9, $10
            FROM data.service_catalog sc
            WHERE sc.service_id = $1 AND sc.is_deleted = FALSE
            ON CONFLICT (service_id, offering_code) DO UPDATE SET
                title = EXCLUDED.title,
                description = EXCLUDED.description,
                is_default = EXCLUDED.is_default,
                requestable = EXCLUDED.requestable,
                approval_required = EXCLUDED.approval_required,
                support_tier_code = EXCLUDED.support_tier_code,
                status = EXCLUDED.status,
                display_order = EXCLUDED.display_order,
                updated_at = CURRENT_TIMESTAMP
        `, [
            offering.service_id,
            offering.offering_code,
            offering.title,
            offering.description,
            offering.is_default,
            offering.requestable,
            offering.approval_required,
            offering.support_tier_code,
            offering.status,
            offering.display_order,
        ], `offering:${offering.service_id}:${offering.offering_code}`);
    }
    logger.info('demo-seed: service offerings OK');
}

// ── 2. DOMAIN AVAILABILITY ──────────────────────────────────────────────────────
async function seedDomainAvailability(pool) {
    const entries = [
        { service_id: 'DEMO-PIS-001', domains: ['RELAY', 'CLOUD', 'GRID', 'PRISM', 'HELIX'] },
        { service_id: 'DEMO-IAM-002', domains: ['RELAY', 'CLOUD', 'GRID', 'PRISM', 'HELIX'] },
        { service_id: 'DEMO-DAP-003', domains: ['GRID', 'PRISM'] },
        { service_id: 'DEMO-RPA-004', domains: ['CLOUD', 'GRID'] },
        { service_id: 'DEMO-LRG-005', domains: ['GRID'] },
        { service_id: 'DEMO-DOC-006', domains: ['CLOUD'] },
        { service_id: 'DEMO-OBS-007', domains: ['RELAY', 'CLOUD', 'GRID'] },
        { service_id: 'DEMO-LEG-008', domains: ['GRID'] },
    ];
    for (const entry of entries) {
        for (const domain of entry.domains) {
            await safeQuery(pool, `
                INSERT INTO data.service_available_on (service_id, domain_code, source_field)
                SELECT sc.id, $2, 'demo-seed'
                FROM data.service_catalog sc
                WHERE sc.service_id = $1 AND sc.is_deleted = FALSE
                ON CONFLICT (service_id, domain_code) DO NOTHING
            `, [entry.service_id, domain], `available_on:${entry.service_id}:${domain}`);
        }
    }
    logger.info('demo-seed: domain availability OK');
}

// ── 3. ROLE ASSIGNMENTS ──────────────────────────────────────────────────────────
async function seedRoleAssignments(pool) {
    const roles = [
        { service_id: 'DEMO-PIS-001', role_code: 'service_owner',             display_name: 'Karel Novák',   email: 'karel.novak@example.org',   organization_name: 'CIS Department' },
        { service_id: 'DEMO-PIS-001', role_code: 'service_delivery_manager',  display_name: 'Jana Horáčková', email: 'jana.horáčková@example.org', organization_name: 'CIS Department' },
        { service_id: 'DEMO-PIS-001', role_code: 'service_area_owner',        display_name: 'Petr Dvořák',   email: 'petr.dvorak@example.org',    organization_name: 'Directorate J6' },

        { service_id: 'DEMO-IAM-002', role_code: 'service_owner',             display_name: 'Martina Šimková', email: 'martina.simkova@example.org', organization_name: 'CSO Department' },
        { service_id: 'DEMO-IAM-002', role_code: 'service_delivery_manager',  display_name: 'Tomáš Blažek',  email: 'tomas.blazek@example.org',   organization_name: 'CSO Department' },
        { service_id: 'DEMO-IAM-002', role_code: 'service_area_owner',        display_name: 'Lucie Marková', email: 'lucie.markova@example.org',  organization_name: 'Directorate J2' },

        { service_id: 'DEMO-DAP-003', role_code: 'service_owner',             display_name: 'David Procházka', email: 'david.prochazka@example.org', organization_name: 'CDO Department' },
        { service_id: 'DEMO-DAP-003', role_code: 'service_delivery_manager',  display_name: 'Eva Kratochvíl', email: 'eva.kratochvil@example.org',  organization_name: 'CDO Department' },
        { service_id: 'DEMO-DAP-003', role_code: 'service_area_owner',        display_name: 'Ondřej Fiala',  email: 'ondrej.fiala@example.org',   organization_name: 'Directorate J9' },

        { service_id: 'DEMO-RPA-004', role_code: 'service_owner',             display_name: 'Nina Automation', email: 'nina.automation@example.org', organization_name: 'Automation CoE' },
        { service_id: 'DEMO-RPA-004', role_code: 'service_delivery_manager',  display_name: 'Pavel Workflow', email: 'pavel.workflow@example.org', organization_name: 'Automation CoE' },
        { service_id: 'DEMO-LRG-005', role_code: 'service_owner',             display_name: 'David Procházka', email: 'david.prochazka@example.org', organization_name: 'CDO Department' },
        { service_id: 'DEMO-OBS-007', role_code: 'service_owner',             display_name: 'Karel Novák', email: 'karel.novak@example.org', organization_name: 'CIS Department' },
        { service_id: 'DEMO-OBS-007', role_code: 'service_delivery_manager',  display_name: 'Olga Signals', email: 'olga.signals@example.org', organization_name: 'Platform Operations' },
        { service_id: 'DEMO-LEG-008', role_code: 'service_owner',             display_name: 'Ondřej Fiala', email: 'ondrej.fiala@example.org', organization_name: 'Directorate J9' },
    ];
    for (const r of roles) {
        await safeQuery(pool, `
            INSERT INTO data.service_role_assignment (service_id, role_code, display_name, email, organization_name, valid_from)
            SELECT sc.id, $2, $3, $4, $5, CURRENT_DATE
            FROM data.service_catalog sc
            WHERE sc.service_id = $1 AND sc.is_deleted = FALSE
            ON CONFLICT DO NOTHING
        `, [r.service_id, r.role_code, r.display_name, r.email, r.organization_name], `role:${r.service_id}:${r.role_code}`);
    }
    logger.info('demo-seed: role assignments OK');
}

// ── 4. PRICING FLAVOURS ─────────────────────────────────────────────────────────
function buildDemoFlavours() {
    return [
        // PIS
        { service_id: 'DEMO-PIS-001', flavour_code: 'PIS-BASIC',    title: 'Basic',      service_unit: 'Instance', price_value: 2500,  currency_code: 'EUR', billing_period_code: 'MONTHLY',  initiation_cost: 5000,  lifecycle_cost: 30000, lifetime_years: 3, is_orderable: true,  display_order: 1, short_note: 'Základní instance pro testovací prostředí' },
        { service_id: 'DEMO-PIS-001', flavour_code: 'PIS-STD',      title: 'Standard',   service_unit: 'Instance', price_value: 8500,  currency_code: 'EUR', billing_period_code: 'MONTHLY',  initiation_cost: 15000, lifecycle_cost: 102000, lifetime_years: 3, is_orderable: true,  display_order: 2, short_note: 'HA instance pro produkční nasazení' },
        { service_id: 'DEMO-PIS-001', flavour_code: 'PIS-ENT',      title: 'Enterprise', service_unit: 'Instance', price_value: 22000, currency_code: 'EUR', billing_period_code: 'MONTHLY',  initiation_cost: 40000, lifecycle_cost: 264000, lifetime_years: 3, is_orderable: true,  display_order: 3, short_note: 'Georedundantní cluster s dedikovaou podporou' },

        // IAM
        { service_id: 'DEMO-IAM-002', flavour_code: 'IAM-STD',      title: 'Standard',   service_unit: 'User/month', price_value: 12,  currency_code: 'EUR', billing_period_code: 'MONTHLY', initiation_cost: 8000,  lifecycle_cost: null, lifetime_years: null, is_orderable: true,  display_order: 1, short_note: 'SSO + MFA, max 1000 uživatelů' },
        { service_id: 'DEMO-IAM-002', flavour_code: 'IAM-PLUS',     title: 'Plus',       service_unit: 'User/month', price_value: 18,  currency_code: 'EUR', billing_period_code: 'MONTHLY', initiation_cost: 12000, lifecycle_cost: null, lifetime_years: null, is_orderable: true,  display_order: 2, short_note: 'SSO + MFA + PAM, neomezený počet uživatelů' },
        { service_id: 'DEMO-IAM-002', flavour_code: 'IAM-GOV',      title: 'Governance', service_unit: 'User/month', price_value: 25,  currency_code: 'EUR', billing_period_code: 'MONTHLY', initiation_cost: 20000, lifecycle_cost: null, lifetime_years: null, is_orderable: false, display_order: 3, short_note: 'Plus + IGA, certifikace přístupů, compliance reporting' },

        // DAP
        { service_id: 'DEMO-DAP-003', flavour_code: 'DAP-STARTER',  title: 'Starter',    service_unit: 'Compute-hour', price_value: 0.8, currency_code: 'EUR', billing_period_code: 'HOURLY',  initiation_cost: 3000,  lifecycle_cost: null, lifetime_years: null, is_orderable: true,  display_order: 1, short_note: 'Shared cluster, max 4 vCPU, 16 GB RAM' },
        { service_id: 'DEMO-DAP-003', flavour_code: 'DAP-BUS',      title: 'Business',   service_unit: 'Compute-hour', price_value: 1.5, currency_code: 'EUR', billing_period_code: 'HOURLY',  initiation_cost: 6000,  lifecycle_cost: null, lifetime_years: null, is_orderable: true,  display_order: 2, short_note: 'Dedikovaný cluster, BI dashboardy, až 16 vCPU' },
        { service_id: 'DEMO-DAP-003', flavour_code: 'DAP-ML',       title: 'ML',         service_unit: 'Compute-hour', price_value: 3.2, currency_code: 'EUR', billing_period_code: 'HOURLY',  initiation_cost: 15000, lifecycle_cost: null, lifetime_years: null, is_orderable: true,  display_order: 3, short_note: 'GPU cluster pro ML/AI workloady' },
        // Governance cockpit additions
        { service_id: 'DEMO-RPA-004', flavour_code: 'RPA-STD',      title: 'Standard Automation', service_unit: 'Workflow/month', price_value: 750, currency_code: 'EUR', billing_period_code: 'MONTHLY', initiation_cost: 2500, lifecycle_cost: null, lifetime_years: null, is_orderable: true, display_order: 1, short_note: 'Managed automation workflow' },
        { service_id: 'DEMO-RPA-004', flavour_code: 'RPA-ENT',      title: 'Enterprise Automation', service_unit: 'Workflow/month', price_value: 1600, currency_code: 'EUR', billing_period_code: 'MONTHLY', initiation_cost: 5000, lifecycle_cost: null, lifetime_years: null, is_orderable: true, display_order: 2, short_note: 'High-control workflow with audit evidence' },
        { service_id: 'DEMO-OBS-007', flavour_code: 'OBS-STD',      title: 'Standard Observability', service_unit: 'Service/month', price_value: 120, currency_code: 'EUR', billing_period_code: 'MONTHLY', initiation_cost: 1000, lifecycle_cost: null, lifetime_years: null, is_orderable: true, display_order: 1, short_note: 'Core telemetry and alerting' },
    ];
}

async function seedFlavours(pool) {
    // Restore soft-deleted demo flavours first so upsert finds active records.
    await safeQuery(pool, `
        UPDATE data.service_flavour sf
        SET is_deleted = FALSE, updated_at = CURRENT_TIMESTAMP
        FROM data.service_catalog sc
        WHERE sf.service_id = sc.id
          AND sc.service_id LIKE 'DEMO-%'
          AND sf.is_deleted = TRUE
    `, [], 'flavours:restore-soft-deleted');
    const flavours = buildDemoFlavours();

    for (const f of flavours) {
        await safeQuery(pool, `
            INSERT INTO data.service_flavour (
                service_id, flavour_code, title, service_unit,
                price_value, currency_code, billing_period_code,
                initiation_cost, lifecycle_cost, lifetime_years,
                is_orderable, display_order, short_note,
                flavour_status_code
            )
            SELECT sc.id, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'active'
            FROM data.service_catalog sc
            WHERE sc.service_id = $1 AND sc.is_deleted = FALSE
            ON CONFLICT DO NOTHING
        `, [
            f.service_id, f.flavour_code, f.title, f.service_unit,
            f.price_value, f.currency_code, f.billing_period_code,
            f.initiation_cost ?? null, f.lifecycle_cost ?? null, f.lifetime_years ?? null,
            f.is_orderable, f.display_order, f.short_note,
        ], `flavour:${f.flavour_code}`);
    }
    logger.info('demo-seed: flavours OK');
}

// ── 4b. FLAVOUR-SPECIFIC SLA OVERRIDES ───────────────────────────────────────────
async function seedFlavourSla(pool) {
    const slaItems = [
        // PIS flavours
        { service_id: 'DEMO-PIS-001', flavour_code: 'PIS-BASIC', support_window: 'business_hours', availability_pct: 99.0,  restoration_hours: 8,  delivery_days: 10, note: 'Basic SLA: business hours support, best-effort recovery' },
        { service_id: 'DEMO-PIS-001', flavour_code: 'PIS-STD',   support_window: 'business_hours', availability_pct: 99.9,  restoration_hours: 4,  delivery_days: 5,  note: 'Standard SLA: extended support, guaranteed 4h RTO' },
        { service_id: 'DEMO-PIS-001', flavour_code: 'PIS-ENT',   support_window: '24x7',           availability_pct: 99.99, restoration_hours: 1,  delivery_days: 2,  note: 'Enterprise SLA: 24x7 NOC, 1h RTO, dedicated TAM' },
        // IAM flavours
        { service_id: 'DEMO-IAM-002', flavour_code: 'IAM-STD',   support_window: 'business_hours', availability_pct: 99.9,  restoration_hours: 4,  delivery_days: 2,  note: 'Standard: auth path 4h RTO, self-service best-effort' },
        { service_id: 'DEMO-IAM-002', flavour_code: 'IAM-PLUS',  support_window: '24x7',           availability_pct: 99.95, restoration_hours: 2,  delivery_days: 1,  note: 'Plus: 24x7 monitoring, 2h RTO, georedundant' },
        { service_id: 'DEMO-IAM-002', flavour_code: 'IAM-GOV',   support_window: '24x7',           availability_pct: 99.99, restoration_hours: 1,  delivery_days: 1,  note: 'Governance: highest tier, 1h RTO, compliance reporting' },
        // DAP flavours
        { service_id: 'DEMO-DAP-003', flavour_code: 'DAP-STARTER', support_window: 'best_effort',  availability_pct: 99.0,  restoration_hours: 24, delivery_days: 5,  note: 'Starter: shared resources, best-effort support' },
        { service_id: 'DEMO-DAP-003', flavour_code: 'DAP-BUS',     support_window: 'business_hours',availability_pct: 99.5,  restoration_hours: 8,  delivery_days: 3,  note: 'Business: dedicated cluster, 8h RTO dashboards' },
        { service_id: 'DEMO-DAP-003', flavour_code: 'DAP-ML',      support_window: '24x7',         availability_pct: 99.5,  restoration_hours: 4,  delivery_days: 2,  note: 'ML: GPU cluster, 24x7 monitoring, 4h RTO' },
    ];

    for (const item of slaItems) {
        await safeQuery(pool, `
            INSERT INTO data.service_sla (
                service_id, flavour_id, support_window_code,
                availability_pct, restoration_hours, delivery_days, sla_note_raw, source_field
            )
            SELECT sc.id, sf.id, $3, $4, $5, $6, $7, 'demo-seed'
            FROM data.service_catalog sc
            JOIN data.service_flavour sf
              ON sf.service_id = sc.id AND sf.flavour_code = $2 AND sf.is_deleted = FALSE
            WHERE sc.service_id = $1 AND sc.is_deleted = FALSE
              AND NOT EXISTS (
                  SELECT 1 FROM data.service_sla existing
                  WHERE existing.service_id  = sc.id
                    AND existing.flavour_id  = sf.id
              )
        `, [item.service_id, item.flavour_code, item.support_window,
            item.availability_pct, item.restoration_hours, item.delivery_days, item.note],
        `sla:${item.service_id}:${item.flavour_code}`);
    }
    logger.info('demo-seed: flavour SLA overrides OK');
}

// ── 5. SERVICE RELATIONSHIPS ─────────────────────────────────────────────────────
function buildDemoRelations() {
    return [
        { from: 'DEMO-PIS-001', to: 'DEMO-IAM-002', type: 'depends_on',  label: 'API autentizace',      pace_code: 'SYS',  is_mandatory: true,  impact_level: 'high',   note: 'Každý API call přes PIS vyžaduje IAM token validaci.' },
        { from: 'DEMO-DAP-003', to: 'DEMO-PIS-001', type: 'prerequisite',label: 'Ingestion pipeline',    pace_code: 'SYS',  is_mandatory: true,  impact_level: 'high',   note: 'Bez integrační vrstvy PIS není možné naplnit analytickou platformu.' },
        { from: 'DEMO-DAP-003', to: 'DEMO-IAM-002', type: 'underlying',  label: 'SSO trust',            pace_code: 'SYS',  is_mandatory: true,  impact_level: 'medium', note: 'IAM poskytuje podkladovou autentizaci pro analytický portál.' },
        { from: 'DEMO-IAM-002', to: 'DEMO-PIS-001', type: 'provided_by', label: 'Token distribution',   pace_code: 'DIFF', is_mandatory: false, impact_level: 'medium', note: 'IAM distribuuje JWT tokeny přes PIS event bus.' },
        { from: 'DEMO-PIS-001', to: 'DEMO-DAP-003', type: 'related_to',  label: 'Data publishing',      pace_code: 'COMM', is_mandatory: false, impact_level: 'low',    note: 'PIS publikuje integrační události, které DAP dále zpracovává.' },
        { from: 'DEMO-IAM-002', to: 'DEMO-DAP-003', type: 'replaces',    label: 'Legacy BI access',     pace_code: 'INNOV',is_mandatory: false, impact_level: 'medium', note: 'Nové IAM scénáře nahrazují starý přístup do BI portálu.' },
        { from: 'DEMO-OBS-007', to: 'DEMO-RPA-004', type: 'depends_on',  label: 'Automation telemetry', pace_code: 'SYS',  is_mandatory: true,  impact_level: 'medium', note: 'Observability consumes automation execution telemetry.' },
        { from: 'DEMO-RPA-004', to: 'DEMO-DAP-003', type: 'depends_on',  label: 'Decision analytics',   pace_code: 'SYS',  is_mandatory: true,  impact_level: 'medium', note: 'Automation review queues use analytics outputs from DAP.' },
        { from: 'DEMO-LRG-005', to: 'DEMO-DAP-003', type: 'replaces',    label: 'Analytics migration',  pace_code: 'COMM', is_mandatory: false, impact_level: 'high',   note: 'Legacy reporting is being replaced by the analytics platform.' },
    ];
}

async function seedRelations(pool) {
    const relations = buildDemoRelations();
    for (const rel of relations) {
        await safeQuery(pool, `
            INSERT INTO data.service_relation (
                from_service_id, to_service_id, relation_type_code, relation_label,
                pace_code, is_mandatory, impact_mode, impact_level, relation_note, created_by
            )
            SELECT f.id, t.id, $3, $4, $5, $6, 'passive', $7, $8, 'demo-seed'
            FROM data.service_catalog f, data.service_catalog t
            WHERE f.service_id = $1 AND f.is_deleted = FALSE
              AND t.service_id = $2 AND t.is_deleted = FALSE
            ON CONFLICT DO NOTHING
        `, [rel.from, rel.to, rel.type, rel.label, rel.pace_code, rel.is_mandatory, rel.impact_level, rel.note], `relation:${rel.from}→${rel.to}`);
    }
    logger.info('demo-seed: relations OK');
}

// ── 6. C3 TAXONOMY ITEMS ─────────────────────────────────────────────────────────
async function seedC3Taxonomy(pool) {
    const items = [
        { uuid: DEMO_UUIDS.CAP_BP, item_type: 'BP', external_id: 'DEMO-BP-001', title: '[DEMO] Business Process — Integration',   short_title: 'Integration',       item_status: 'approved', fmn_spiral: 'Spiral_7', description: 'Demo business process for platform integration workflows.' },
        { uuid: DEMO_UUIDS.CAP_BR, item_type: 'BR', external_id: 'DEMO-BR-001', title: '[DEMO] Business Role — Integration Architect', short_title: 'Integration Arch', item_status: 'approved', fmn_spiral: 'Spiral_7', description: 'Demo business role responsible for integration architecture.' },
        { uuid: DEMO_UUIDS.CAP_CP, item_type: 'CP', external_id: 'DEMO-CP-001', title: '[DEMO] Capability — Platform Integration',  short_title: 'Platform Integration', item_status: 'approved', fmn_spiral: 'Spiral_7', description: 'Demo capability covering platform integration patterns and services.' },
        { uuid: DEMO_UUIDS.CAP_CI, item_type: 'CI', external_id: 'DEMO-CI-001', title: '[DEMO] COI Service — Identity Management',  short_title: 'Identity Management',  item_status: 'approved', fmn_spiral: 'Spiral_7', description: 'Demo COI service for identity and access management.' },
        { uuid: DEMO_UUIDS.CAP_CO, item_type: 'CO', external_id: 'DEMO-CO-001', title: '[DEMO] Communication Service — API Bus',    short_title: 'API Bus',              item_status: 'approved', fmn_spiral: 'Spiral_7', description: 'Demo communication service providing API messaging bus.' },
        { uuid: DEMO_UUIDS.CAP_CR, item_type: 'CR', external_id: 'DEMO-CR-001', title: '[DEMO] Core Service — Analytics',          short_title: 'Analytics',            item_status: 'approved', fmn_spiral: 'Spiral_7', description: 'Demo core service for data analytics and reporting.' },
        { uuid: DEMO_UUIDS.CAP_IP, item_type: 'IP', external_id: 'DEMO-IP-001', title: '[DEMO] Information Product — Ops Dashboard', short_title: 'Ops Dashboard',       item_status: 'approved', fmn_spiral: 'Spiral_7', description: 'Demo information product: operational dashboard.' },
        { uuid: DEMO_UUIDS.CAP_UA, item_type: 'UA', external_id: 'DEMO-UA-001', title: '[DEMO] User Application — Analytics Portal', short_title: 'Analytics Portal',    item_status: 'approved', fmn_spiral: 'Spiral_7', description: 'Demo user application: self-service analytics portal.' },
        { uuid: DEMO_UUIDS.CAP_RPA, item_type: 'CP', external_id: 'DEMO-CP-004', title: '[DEMO] Capability — Process Automation', short_title: 'Process Automation', item_status: 'approved', fmn_spiral: 'Spiral_7', description: 'Demo capability with incomplete primary mapping to show readiness blockers.' },
        { uuid: DEMO_UUIDS.CAP_GAP, item_type: 'CP', external_id: 'DEMO-CP-999', title: '[DEMO] Capability — Uncovered Mission Workflow', short_title: 'Uncovered Workflow', item_status: 'approved', fmn_spiral: 'Spiral_7', description: 'Demo uncovered capability intentionally left without service mapping.' },
        { uuid: DEMO_UUIDS.CAP_BP_L4, item_type: 'BP', external_id: 'DEMO-BP-010', title: '[DEMO] Integration Workflow Orchestration', short_title: 'Workflow Orchestration', item_status: 'approved', fmn_spiral: 'Spiral_7', description: 'Demo L4 business process showing orchestration of integration workflows.', parent_uuid: DEMO_UUIDS.CAP_BP },
        { uuid: DEMO_UUIDS.CAP_CI_L4, item_type: 'CI', external_id: 'DEMO-CI-010', title: '[DEMO] Federated Identity Brokerage', short_title: 'Identity Brokerage', item_status: 'approved', fmn_spiral: 'Spiral_7', description: 'Demo L4 COI service showing federated identity brokerage.', parent_uuid: DEMO_UUIDS.CAP_CI },
        { uuid: DEMO_UUIDS.CAP_UA_L4, item_type: 'UA', external_id: 'DEMO-UA-010', title: '[DEMO] Commander Insight Portal', short_title: 'Commander Portal', item_status: 'approved', fmn_spiral: 'Spiral_7', description: 'Demo L4 user application showing command insights and BI views.', parent_uuid: DEMO_UUIDS.CAP_UA },
    ];

    for (const item of items) {
        await safeQuery(pool, `
            INSERT INTO data.c3_taxonomy (uuid, item_type, external_id, title, abbreviation, item_status, description, parent_uuid, level_num, fmn_spiral)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (uuid) DO UPDATE SET
                external_id = EXCLUDED.external_id,
                title = EXCLUDED.title,
                abbreviation = EXCLUDED.abbreviation,
                item_status = EXCLUDED.item_status,
                description = EXCLUDED.description,
                parent_uuid = EXCLUDED.parent_uuid,
                level_num = EXCLUDED.level_num,
                fmn_spiral = EXCLUDED.fmn_spiral,
                synced_at = CURRENT_TIMESTAMP
        `, [item.uuid, item.item_type, item.external_id, item.title, item.short_title, item.item_status, item.description, item.parent_uuid ?? null, item.parent_uuid ? 4 : 3, item.fmn_spiral ?? null], `c3_taxonomy:${item.external_id}`);
    }
    logger.info('demo-seed: c3_taxonomy OK');
}

// ── 6b. C3 CAPABILITY BUILDER — demo hierarchy for /c3/graph ──────────────────
async function seedC3CapabilityBuilder(pool) {
    // APP_FLOW.md item 29 requires the demo dataset to be visible in capability maps.
    // The capability map page renders groups from L2 items; L3 chips must have parent_id = L2 page_id.
    // Therefore each spiral uses this hierarchy: L1 (domain root) → L2 (group) → L3 (chip) → L4 (sub-chip).
    //
    // Stable UUIDs for L1/L2 hierarchy-only nodes. They are structural and are not present in c3_taxonomy.
    const H = {
        // Spiral_7 L1
        L1_BP_S7: 'demo-h1-bp-s7-0000-000000000101', L1_BR_S7: 'demo-h1-br-s7-0000-000000000102',
        L1_CP_S7: 'demo-h1-cp-s7-0000-000000000103', L1_CI_S7: 'demo-h1-ci-s7-0000-000000000104',
        L1_CO_S7: 'demo-h1-co-s7-0000-000000000105', L1_CR_S7: 'demo-h1-cr-s7-0000-000000000106',
        L1_IP_S7: 'demo-h1-ip-s7-0000-000000000107', L1_UA_S7: 'demo-h1-ua-s7-0000-000000000108',
        // Spiral_7 L2
        L2_BP_S7: 'demo-h2-bp-s7-0000-000000000201', L2_BR_S7: 'demo-h2-br-s7-0000-000000000202',
        L2_CP_S7: 'demo-h2-cp-s7-0000-000000000203', L2_CI_S7: 'demo-h2-ci-s7-0000-000000000204',
        L2_CO_S7: 'demo-h2-co-s7-0000-000000000205', L2_CR_S7: 'demo-h2-cr-s7-0000-000000000206',
        L2_IP_S7: 'demo-h2-ip-s7-0000-000000000207', L2_UA_S7: 'demo-h2-ua-s7-0000-000000000208',
        // Spiral_6 L1
        L1_BP_S6: 'demo-h1-bp-s6-0000-000000000301', L1_BR_S6: 'demo-h1-br-s6-0000-000000000302',
        L1_CP_S6: 'demo-h1-cp-s6-0000-000000000303', L1_CI_S6: 'demo-h1-ci-s6-0000-000000000304',
        L1_CO_S6: 'demo-h1-co-s6-0000-000000000305', L1_CR_S6: 'demo-h1-cr-s6-0000-000000000306',
        L1_IP_S6: 'demo-h1-ip-s6-0000-000000000307', L1_UA_S6: 'demo-h1-ua-s6-0000-000000000308',
        // Spiral_6 L2
        L2_BP_S6: 'demo-h2-bp-s6-0000-000000000401', L2_BR_S6: 'demo-h2-br-s6-0000-000000000402',
        L2_CP_S6: 'demo-h2-cp-s6-0000-000000000403', L2_CI_S6: 'demo-h2-ci-s6-0000-000000000404',
        L2_CO_S6: 'demo-h2-co-s6-0000-000000000405', L2_CR_S6: 'demo-h2-cr-s6-0000-000000000406',
        L2_IP_S6: 'demo-h2-ip-s6-0000-000000000407', L2_UA_S6: 'demo-h2-ua-s6-0000-000000000408',
    };
    const items = [
        // ── Spiral_7 — L1 domain roots ───────────────────────────────────────────
        { page_id: 'DEMO-BP-L1-S7', uuid: H.L1_BP_S7, title: '[DEMO] Business Processes',        domain: 'BusinessProcesses',      level: 1, spiral: 'Spiral_7' },
        { page_id: 'DEMO-BR-L1-S7', uuid: H.L1_BR_S7, title: '[DEMO] Business Roles',            domain: 'BusinessRoles',          level: 1, spiral: 'Spiral_7' },
        { page_id: 'DEMO-CP-L1-S7', uuid: H.L1_CP_S7, title: '[DEMO] Capabilities',              domain: 'Capabilities',           level: 1, spiral: 'Spiral_7' },
        { page_id: 'DEMO-CI-L1-S7', uuid: H.L1_CI_S7, title: '[DEMO] COI Services',              domain: 'COIServices',            level: 1, spiral: 'Spiral_7' },
        { page_id: 'DEMO-CO-L1-S7', uuid: H.L1_CO_S7, title: '[DEMO] Communications Services',   domain: 'CommunicationsServices', level: 1, spiral: 'Spiral_7' },
        { page_id: 'DEMO-CR-L1-S7', uuid: H.L1_CR_S7, title: '[DEMO] Core Services',             domain: 'CoreServices',           level: 1, spiral: 'Spiral_7' },
        { page_id: 'DEMO-IP-L1-S7', uuid: H.L1_IP_S7, title: '[DEMO] Information Products',      domain: 'InformationProducts',    level: 1, spiral: 'Spiral_7' },
        { page_id: 'DEMO-UA-L1-S7', uuid: H.L1_UA_S7, title: '[DEMO] User Applications',         domain: 'UserApplications',       level: 1, spiral: 'Spiral_7' },

        // ── Spiral_7 — L2 groups (parent = L1) ───────────────────────────────────
        { page_id: 'DEMO-BP-L2-S7', uuid: H.L2_BP_S7, title: '[DEMO] Integration Processes',    domain: 'BusinessProcesses',      level: 2, parent_id: 'DEMO-BP-L1-S7', spiral: 'Spiral_7' },
        { page_id: 'DEMO-BR-L2-S7', uuid: H.L2_BR_S7, title: '[DEMO] Integration Roles',        domain: 'BusinessRoles',          level: 2, parent_id: 'DEMO-BR-L1-S7', spiral: 'Spiral_7' },
        { page_id: 'DEMO-CP-L2-S7', uuid: H.L2_CP_S7, title: '[DEMO] Platform Capabilities',    domain: 'Capabilities',           level: 2, parent_id: 'DEMO-CP-L1-S7', spiral: 'Spiral_7' },
        { page_id: 'DEMO-CI-L2-S7', uuid: H.L2_CI_S7, title: '[DEMO] Identity COI',             domain: 'COIServices',            level: 2, parent_id: 'DEMO-CI-L1-S7', spiral: 'Spiral_7' },
        { page_id: 'DEMO-CO-L2-S7', uuid: H.L2_CO_S7, title: '[DEMO] API Services',             domain: 'CommunicationsServices', level: 2, parent_id: 'DEMO-CO-L1-S7', spiral: 'Spiral_7' },
        { page_id: 'DEMO-CR-L2-S7', uuid: H.L2_CR_S7, title: '[DEMO] Analytics Services',       domain: 'CoreServices',           level: 2, parent_id: 'DEMO-CR-L1-S7', spiral: 'Spiral_7' },
        { page_id: 'DEMO-IP-L2-S7', uuid: H.L2_IP_S7, title: '[DEMO] Ops Dashboards',           domain: 'InformationProducts',    level: 2, parent_id: 'DEMO-IP-L1-S7', spiral: 'Spiral_7' },
        { page_id: 'DEMO-UA-L2-S7', uuid: H.L2_UA_S7, title: '[DEMO] Analytics Applications',   domain: 'UserApplications',       level: 2, parent_id: 'DEMO-UA-L1-S7', spiral: 'Spiral_7' },

        // ── Spiral_7 — L3 chips (parent = L2) ────────────────────────────────────
        { page_id: 'DEMO-BP-001', uuid: DEMO_UUIDS.CAP_BP, title: '[DEMO] Integration Business Process',   domain: 'BusinessProcesses',      level: 3, parent_id: 'DEMO-BP-L2-S7', spiral: 'Spiral_7' },
        { page_id: 'DEMO-BR-001', uuid: DEMO_UUIDS.CAP_BR, title: '[DEMO] Integration Architect Role',     domain: 'BusinessRoles',          level: 3, parent_id: 'DEMO-BR-L2-S7', spiral: 'Spiral_7' },
        { page_id: 'DEMO-CP-001', uuid: DEMO_UUIDS.CAP_CP, title: '[DEMO] Platform Integration Capability', domain: 'Capabilities',           level: 3, parent_id: 'DEMO-CP-L2-S7', spiral: 'Spiral_7' },
        { page_id: 'DEMO-CI-001', uuid: DEMO_UUIDS.CAP_CI, title: '[DEMO] Identity Management COI',        domain: 'COIServices',            level: 3, parent_id: 'DEMO-CI-L2-S7', spiral: 'Spiral_7' },
        { page_id: 'DEMO-CO-001', uuid: DEMO_UUIDS.CAP_CO, title: '[DEMO] API Bus Communication Service',  domain: 'CommunicationsServices', level: 3, parent_id: 'DEMO-CO-L2-S7', spiral: 'Spiral_7' },
        { page_id: 'DEMO-CR-S7',  uuid: DEMO_UUIDS.CAP_CR, title: '[DEMO] Analytics Core Service',         domain: 'CoreServices',           level: 3, parent_id: 'DEMO-CR-L2-S7', spiral: 'Spiral_7' },
        { page_id: 'DEMO-IP-S7',  uuid: DEMO_UUIDS.CAP_IP, title: '[DEMO] Ops Dashboard Info Product',     domain: 'InformationProducts',    level: 3, parent_id: 'DEMO-IP-L2-S7', spiral: 'Spiral_7' },
        { page_id: 'DEMO-UA-S7',  uuid: DEMO_UUIDS.CAP_UA, title: '[DEMO] Analytics Portal Application',   domain: 'UserApplications',       level: 3, parent_id: 'DEMO-UA-L2-S7', spiral: 'Spiral_7' },

        // ── Spiral_7 — L4 sub-chips (parent = L3) ────────────────────────────────
        { page_id: 'DEMO-BP-010', uuid: DEMO_UUIDS.CAP_BP_L4, title: '[DEMO] Integration Workflow Orchestration', domain: 'BusinessProcesses', level: 4, parent_id: 'DEMO-BP-001', spiral: 'Spiral_7' },
        { page_id: 'DEMO-CI-010', uuid: DEMO_UUIDS.CAP_CI_L4, title: '[DEMO] Federated Identity Brokerage',       domain: 'COIServices',        level: 4, parent_id: 'DEMO-CI-001', spiral: 'Spiral_7' },
        { page_id: 'DEMO-UA-010', uuid: DEMO_UUIDS.CAP_UA_L4, title: '[DEMO] Commander Insight Portal',           domain: 'UserApplications',   level: 4, parent_id: 'DEMO-UA-S7',  spiral: 'Spiral_7' },

        // ── Spiral_6 — L1 domain roots ───────────────────────────────────────────
        { page_id: 'DEMO-BP-L1-S6', uuid: H.L1_BP_S6, title: '[DEMO] Business Processes',        domain: 'BusinessProcesses',      level: 1, spiral: 'Spiral_6' },
        { page_id: 'DEMO-BR-L1-S6', uuid: H.L1_BR_S6, title: '[DEMO] Business Roles',            domain: 'BusinessRoles',          level: 1, spiral: 'Spiral_6' },
        { page_id: 'DEMO-CP-L1-S6', uuid: H.L1_CP_S6, title: '[DEMO] Capabilities',              domain: 'Capabilities',           level: 1, spiral: 'Spiral_6' },
        { page_id: 'DEMO-CI-L1-S6', uuid: H.L1_CI_S6, title: '[DEMO] COI Services',              domain: 'COIServices',            level: 1, spiral: 'Spiral_6' },
        { page_id: 'DEMO-CO-L1-S6', uuid: H.L1_CO_S6, title: '[DEMO] Communications Services',   domain: 'CommunicationsServices', level: 1, spiral: 'Spiral_6' },
        { page_id: 'DEMO-CR-L1-S6', uuid: H.L1_CR_S6, title: '[DEMO] Core Services',             domain: 'CoreServices',           level: 1, spiral: 'Spiral_6' },
        { page_id: 'DEMO-IP-L1-S6', uuid: H.L1_IP_S6, title: '[DEMO] Information Products',      domain: 'InformationProducts',    level: 1, spiral: 'Spiral_6' },
        { page_id: 'DEMO-UA-L1-S6', uuid: H.L1_UA_S6, title: '[DEMO] User Applications',         domain: 'UserApplications',       level: 1, spiral: 'Spiral_6' },

        // ── Spiral_6 — L2 groups (parent = L1) ───────────────────────────────────
        { page_id: 'DEMO-BP-L2-S6', uuid: H.L2_BP_S6, title: '[DEMO] Integration Processes',    domain: 'BusinessProcesses',      level: 2, parent_id: 'DEMO-BP-L1-S6', spiral: 'Spiral_6' },
        { page_id: 'DEMO-BR-L2-S6', uuid: H.L2_BR_S6, title: '[DEMO] Integration Roles',        domain: 'BusinessRoles',          level: 2, parent_id: 'DEMO-BR-L1-S6', spiral: 'Spiral_6' },
        { page_id: 'DEMO-CP-L2-S6', uuid: H.L2_CP_S6, title: '[DEMO] Platform Capabilities',    domain: 'Capabilities',           level: 2, parent_id: 'DEMO-CP-L1-S6', spiral: 'Spiral_6' },
        { page_id: 'DEMO-CI-L2-S6', uuid: H.L2_CI_S6, title: '[DEMO] Identity COI',             domain: 'COIServices',            level: 2, parent_id: 'DEMO-CI-L1-S6', spiral: 'Spiral_6' },
        { page_id: 'DEMO-CO-L2-S6', uuid: H.L2_CO_S6, title: '[DEMO] API Services',             domain: 'CommunicationsServices', level: 2, parent_id: 'DEMO-CO-L1-S6', spiral: 'Spiral_6' },
        { page_id: 'DEMO-CR-L2-S6', uuid: H.L2_CR_S6, title: '[DEMO] Analytics Services',       domain: 'CoreServices',           level: 2, parent_id: 'DEMO-CR-L1-S6', spiral: 'Spiral_6' },
        { page_id: 'DEMO-IP-L2-S6', uuid: H.L2_IP_S6, title: '[DEMO] Ops Dashboards',           domain: 'InformationProducts',    level: 2, parent_id: 'DEMO-IP-L1-S6', spiral: 'Spiral_6' },
        { page_id: 'DEMO-UA-L2-S6', uuid: H.L2_UA_S6, title: '[DEMO] Analytics Applications',   domain: 'UserApplications',       level: 2, parent_id: 'DEMO-UA-L1-S6', spiral: 'Spiral_6' },

        // ── Spiral_6 — L3 chips (parent = L2) ────────────────────────────────────
        { page_id: 'DEMO-BP-S6',  uuid: DEMO_UUIDS.CAP_BP, title: '[DEMO] Integration Business Process',    domain: 'BusinessProcesses',      level: 3, parent_id: 'DEMO-BP-L2-S6', spiral: 'Spiral_6' },
        { page_id: 'DEMO-BR-S6',  uuid: DEMO_UUIDS.CAP_BR, title: '[DEMO] Integration Architect Role',      domain: 'BusinessRoles',          level: 3, parent_id: 'DEMO-BR-L2-S6', spiral: 'Spiral_6' },
        { page_id: 'DEMO-CP-S6',  uuid: DEMO_UUIDS.CAP_CP, title: '[DEMO] Platform Integration Capability',  domain: 'Capabilities',           level: 3, parent_id: 'DEMO-CP-L2-S6', spiral: 'Spiral_6' },
        { page_id: 'DEMO-CI-S6',  uuid: DEMO_UUIDS.CAP_CI, title: '[DEMO] Identity Management COI',          domain: 'COIServices',            level: 3, parent_id: 'DEMO-CI-L2-S6', spiral: 'Spiral_6' },
        { page_id: 'DEMO-CO-S6',  uuid: DEMO_UUIDS.CAP_CO, title: '[DEMO] API Bus Communication Service',    domain: 'CommunicationsServices', level: 3, parent_id: 'DEMO-CO-L2-S6', spiral: 'Spiral_6' },
        { page_id: 'DEMO-CR-001', uuid: DEMO_UUIDS.CAP_CR, title: '[DEMO] Analytics Core Service',           domain: 'CoreServices',           level: 3, parent_id: 'DEMO-CR-L2-S6', spiral: 'Spiral_6' },
        { page_id: 'DEMO-IP-001', uuid: DEMO_UUIDS.CAP_IP, title: '[DEMO] Ops Dashboard Info Product',       domain: 'InformationProducts',    level: 3, parent_id: 'DEMO-IP-L2-S6', spiral: 'Spiral_6' },
        { page_id: 'DEMO-UA-001', uuid: DEMO_UUIDS.CAP_UA, title: '[DEMO] Analytics Portal Application',     domain: 'UserApplications',       level: 3, parent_id: 'DEMO-UA-L2-S6', spiral: 'Spiral_6' },

        // ── Spiral_6 — L4 sub-chips (parent = L3) ────────────────────────────────
        { page_id: 'DEMO-BP-010-S6', uuid: DEMO_UUIDS.CAP_BP_L4, title: '[DEMO] Integration Workflow Orchestration', domain: 'BusinessProcesses', level: 4, parent_id: 'DEMO-BP-S6',  spiral: 'Spiral_6' },
        { page_id: 'DEMO-CI-010-S6', uuid: DEMO_UUIDS.CAP_CI_L4, title: '[DEMO] Federated Identity Brokerage',       domain: 'COIServices',        level: 4, parent_id: 'DEMO-CI-S6',  spiral: 'Spiral_6' },
        { page_id: 'DEMO-UA-010-S6', uuid: DEMO_UUIDS.CAP_UA_L4, title: '[DEMO] Commander Insight Portal',           domain: 'UserApplications',   level: 4, parent_id: 'DEMO-UA-001', spiral: 'Spiral_6' },
    ];
    for (const item of items) {
        await safeQuery(pool, `
            INSERT INTO data.c3_capability_builder (page_id, uuid, title, parent_id, level, state, domain_code, fmn_spiral)
            VALUES ($1, $2, $3, $4, $5, 'active', $6, $7)
            ON CONFLICT (page_id) DO UPDATE SET
                title       = EXCLUDED.title,
                parent_id   = EXCLUDED.parent_id,
                level       = EXCLUDED.level,
                domain_code = EXCLUDED.domain_code,
                fmn_spiral  = EXCLUDED.fmn_spiral,
                updated_at  = CURRENT_TIMESTAMP
        `, [item.page_id, item.uuid, item.title, item.parent_id ?? null, item.level, item.domain, item.spiral], `c3_builder:${item.page_id}`);
    }
    logger.info('demo-seed: c3_capability_builder OK');
}

// ── 7. C3 ENTITY RECORDS ─────────────────────────────────────────────────────────
async function seedC3Entities(pool) {
    // Applications
    const apps = [
        { uuid: DEMO_UUIDS.APP_01, application_code: 'DEMO-APP-001', title: '[DEMO] Integration Gateway',    item_status: 'active' },
        { uuid: DEMO_UUIDS.APP_02, application_code: 'DEMO-APP-002', title: '[DEMO] Analytics Workbench',    item_status: 'active' },
    ];
    for (const a of apps) {
        await safeQuery(pool, `
            INSERT INTO data.c3_application (uuid, application_code, title, item_status)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (uuid) DO NOTHING
        `, [a.uuid, a.application_code, a.title, a.item_status], `c3_application:${a.application_code}`);
    }

    // Technology Interactions
    const tins = [
        { uuid: DEMO_UUIDS.TIN_01, technology_interaction_code: 'DEMO-TIN-001', title: '[DEMO] REST API Gateway TIN',    item_status: 'active' },
        { uuid: DEMO_UUIDS.TIN_02, technology_interaction_code: 'DEMO-TIN-002', title: '[DEMO] AMQP Message Broker TIN', item_status: 'active' },
    ];
    for (const t of tins) {
        await safeQuery(pool, `
            INSERT INTO data.c3_technology_interaction (uuid, technology_interaction_code, title, item_status)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (uuid) DO NOTHING
        `, [t.uuid, t.technology_interaction_code, t.title, t.item_status], `c3_tin:${t.technology_interaction_code}`);
    }

    // Data Objects
    const dos = [
        { uuid: DEMO_UUIDS.DO_01, data_object_code: 'DEMO-DO-001', title: '[DEMO] User Identity Record',  item_status: 'active' },
        { uuid: DEMO_UUIDS.DO_02, data_object_code: 'DEMO-DO-002', title: '[DEMO] Analytics Dataset',     item_status: 'active' },
    ];
    for (const d of dos) {
        await safeQuery(pool, `
            INSERT INTO data.c3_data_object (uuid, data_object_code, title, item_status)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (uuid) DO NOTHING
        `, [d.uuid, d.data_object_code, d.title, d.item_status], `c3_data_object:${d.data_object_code}`);
    }

    // C3 Services
    const c3svcs = [
        { uuid: DEMO_UUIDS.C3SVC_01, service_code: 'DEMO-SVC-001', title: '[DEMO] Shared Auth Service', item_status: 'active' },
    ];
    for (const s of c3svcs) {
        await safeQuery(pool, `
            INSERT INTO data.c3_service (uuid, service_code, title, item_status)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (uuid) DO NOTHING
        `, [s.uuid, s.service_code, s.title, s.item_status], `c3_service:${s.service_code}`);
    }
    logger.info('demo-seed: c3 entities OK');
}

// ── 8. SERVICE → C3 MAPPING ──────────────────────────────────────────────────────
function buildDemoServiceC3Mappings() {
    return [
        // DEMO-PIS-001
        { service_id: 'DEMO-PIS-001', c3_uuid: DEMO_UUIDS.CAP_BP, type: 'supports',    pace: 'COMM',  level: 2, domain: 'BusinessProcesses',       is_primary: false, note: 'PIS podporuje integrační business procesy.' },
        { service_id: 'DEMO-PIS-001', c3_uuid: DEMO_UUIDS.CAP_BR, type: 'supports',    pace: 'SYS',   level: 2, domain: 'BusinessRoles',           is_primary: false, note: 'PIS podporuje roli integračního architekta.' },
        { service_id: 'DEMO-PIS-001', c3_uuid: DEMO_UUIDS.CAP_CP, type: 'primary',     pace: 'DIFF',  level: 3, domain: 'Capabilities',            is_primary: true,  note: 'PIS přímo realizuje platform integration capability.' },
        { service_id: 'DEMO-PIS-001', c3_uuid: DEMO_UUIDS.CAP_CI, type: 'implements',  pace: 'SYS',   level: 3, domain: 'COIServices',             is_primary: false, note: 'PIS napojuje COI identity integration toky.' },
        { service_id: 'DEMO-PIS-001', c3_uuid: DEMO_UUIDS.CAP_CO, type: 'implements',  pace: 'SYS',   level: 3, domain: 'CommunicationsServices',  is_primary: false, note: 'PIS poskytuje API bus jako komunikační službu.' },
        { service_id: 'DEMO-PIS-001', c3_uuid: DEMO_UUIDS.CAP_CR, type: 'supports',    pace: 'COMM',  level: 3, domain: 'CoreServices',            is_primary: false, note: 'PIS podporuje core integrační a orchestration služby.' },
        { service_id: 'DEMO-PIS-001', c3_uuid: DEMO_UUIDS.CAP_IP, type: 'supports',    pace: 'INNOV', level: 3, domain: 'InformationProducts',     is_primary: false, note: 'PIS zásobuje dashboardy integračními telemetry daty.' },
        { service_id: 'DEMO-PIS-001', c3_uuid: DEMO_UUIDS.CAP_UA, type: 'implements',  pace: 'SYS',   level: 3, domain: 'UserApplications',        is_primary: false, note: 'PIS obsluhuje user applications přes integrační API.' },
        // DEMO-IAM-002
        { service_id: 'DEMO-IAM-002', c3_uuid: DEMO_UUIDS.CAP_BP, type: 'supports',    pace: 'COMM',  level: 2, domain: 'BusinessProcesses',       is_primary: false, note: 'IAM podporuje přístupové workflow napříč business procesy.' },
        { service_id: 'DEMO-IAM-002', c3_uuid: DEMO_UUIDS.CAP_BR, type: 'implements',  pace: 'DIFF',  level: 2, domain: 'BusinessRoles',           is_primary: false, note: 'IAM spravuje business role a oprávnění.' },
        { service_id: 'DEMO-IAM-002', c3_uuid: DEMO_UUIDS.CAP_CP, type: 'supports',    pace: 'SYS',   level: 3, domain: 'Capabilities',            is_primary: false, note: 'IAM podporuje capability vrstvy bezpečnou identitou.' },
        { service_id: 'DEMO-IAM-002', c3_uuid: DEMO_UUIDS.CAP_CI, type: 'primary',     pace: 'DIFF',  level: 3, domain: 'COIServices',             is_primary: true,  note: 'IAM přímo realizuje COI Identity Management.' },
        { service_id: 'DEMO-IAM-002', c3_uuid: DEMO_UUIDS.CAP_CO, type: 'supports',    pace: 'COMM',  level: 3, domain: 'CommunicationsServices',  is_primary: false, note: 'IAM chrání komunikační vrstvy a API komunikaci.' },
        { service_id: 'DEMO-IAM-002', c3_uuid: DEMO_UUIDS.CAP_CR, type: 'implements',  pace: 'SYS',   level: 3, domain: 'CoreServices',            is_primary: false, note: 'IAM poskytuje core auth službu.' },
        { service_id: 'DEMO-IAM-002', c3_uuid: DEMO_UUIDS.CAP_IP, type: 'supports',    pace: 'COMM',  level: 3, domain: 'InformationProducts',     is_primary: false, note: 'IAM auditní záznamy vstupují do information products.' },
        { service_id: 'DEMO-IAM-002', c3_uuid: DEMO_UUIDS.CAP_UA, type: 'supports',    pace: 'COMM',  level: 3, domain: 'UserApplications',        is_primary: false, note: 'IAM obsluhuje přihlášení a session správu user applications.' },
        // DEMO-DAP-003
        { service_id: 'DEMO-DAP-003', c3_uuid: DEMO_UUIDS.CAP_BP, type: 'supports',    pace: 'COMM',  level: 2, domain: 'BusinessProcesses',       is_primary: false, note: 'DAP podporuje reporting a rozhodovací business procesy.' },
        { service_id: 'DEMO-DAP-003', c3_uuid: DEMO_UUIDS.CAP_BR, type: 'supports',    pace: 'SYS',   level: 2, domain: 'BusinessRoles',           is_primary: false, note: 'DAP poskytuje role-based dashboards a analytické pohledy.' },
        { service_id: 'DEMO-DAP-003', c3_uuid: DEMO_UUIDS.CAP_CP, type: 'supports',    pace: 'SYS',   level: 3, domain: 'Capabilities',            is_primary: false, note: 'DAP rozšiřuje capability vrstvu o analytické scénáře.' },
        { service_id: 'DEMO-DAP-003', c3_uuid: DEMO_UUIDS.CAP_CI, type: 'supports',    pace: 'COMM',  level: 3, domain: 'COIServices',             is_primary: false, note: 'DAP publikuje COI analytics služby.' },
        { service_id: 'DEMO-DAP-003', c3_uuid: DEMO_UUIDS.CAP_CO, type: 'supports',    pace: 'SYS',   level: 3, domain: 'CommunicationsServices',  is_primary: false, note: 'DAP využívá komunikační služby pro ingest a notifikace.' },
        { service_id: 'DEMO-DAP-003', c3_uuid: DEMO_UUIDS.CAP_CR, type: 'primary',     pace: 'DIFF',  level: 3, domain: 'CoreServices',            is_primary: true,  note: 'DAP realizuje core analytics service.' },
        { service_id: 'DEMO-DAP-003', c3_uuid: DEMO_UUIDS.CAP_IP, type: 'implements',  pace: 'DIFF',  level: 3, domain: 'InformationProducts',     is_primary: false, note: 'DAP produkuje information products a dashboardy.' },
        { service_id: 'DEMO-DAP-003', c3_uuid: DEMO_UUIDS.CAP_UA, type: 'implements',  pace: 'INNOV', level: 3, domain: 'UserApplications',        is_primary: false, note: 'DAP poskytuje self-service analytics portal.' },
        // governance cockpit additions
        { service_id: 'DEMO-RPA-004', c3_uuid: DEMO_UUIDS.CAP_RPA, type: 'primary', pace: 'INNOV', level: 3, domain: 'Capabilities', is_primary: true, note: 'RPA maps to an intentionally incomplete capability for readiness demo.' },
        { service_id: 'DEMO-OBS-007', c3_uuid: DEMO_UUIDS.CAP_CP, type: 'supports', pace: 'SYS', level: 3, domain: 'Capabilities', is_primary: false, note: 'Observability adds over-coverage to the platform capability.' },
        { service_id: 'DEMO-LRG-005', c3_uuid: DEMO_UUIDS.CAP_CR, type: 'supports', pace: 'COMM', level: 3, domain: 'CoreServices', is_primary: false, note: 'Legacy reporting remains a duplicate support path until retired.' },
        // explicit demo L4 capability content for capability maps
        { service_id: 'DEMO-PIS-001', c3_uuid: DEMO_UUIDS.CAP_BP_L4, type: 'implements', pace: 'SYS', level: 4, domain: 'BusinessProcesses', is_primary: false, note: 'PIS automatizuje workflow orchestration integračních procesů.' },
        { service_id: 'DEMO-IAM-002', c3_uuid: DEMO_UUIDS.CAP_CI_L4, type: 'implements', pace: 'DIFF', level: 4, domain: 'COIServices', is_primary: false, note: 'IAM zajišťuje federated identity brokerage mezi doménami.' },
        { service_id: 'DEMO-DAP-003', c3_uuid: DEMO_UUIDS.CAP_UA_L4, type: 'implements', pace: 'INNOV', level: 4, domain: 'UserApplications', is_primary: false, note: 'DAP napájí commander insight portal živými dashboardy.' },
    ];
}

async function seedServiceC3Mapping(pool) {
    const mappings = buildDemoServiceC3Mappings();
    for (const m of mappings) {
        await safeQuery(pool, `
            INSERT INTO data.service_c3_mapping (
                service_id, c3_uuid, mapping_type_code, pace_code,
                c3_level, c3_domain, c3_source,
                synced_at, sync_status, is_primary, mapping_note
            )
            SELECT sc.id, $2, $3, $4, $5, $6, 'demo-seed',
                   CURRENT_TIMESTAMP, 'ok', $7, $8
            FROM data.service_catalog sc
            WHERE sc.service_id = $1 AND sc.is_deleted = FALSE
            ON CONFLICT DO NOTHING
        `, [m.service_id, m.c3_uuid, m.type, m.pace, m.level, m.domain, m.is_primary, m.note], `c3_mapping:${m.service_id}→${m.c3_uuid}`);
    }
    logger.info('demo-seed: service_c3_mapping OK');
}

// ── 9. CAPABILITY → ENTITY LINKS ─────────────────────────────────────────────────
async function seedCapabilityEntityLinks(pool) {
    // Apps linked to capabilities: each capability has at least one link.
    const appLinks = [
        { capability_uuid: DEMO_UUIDS.CAP_CP, app_uuid: DEMO_UUIDS.APP_01, role: 'primary' },
        { capability_uuid: DEMO_UUIDS.CAP_UA, app_uuid: DEMO_UUIDS.APP_02, role: 'primary' },
        { capability_uuid: DEMO_UUIDS.CAP_CO, app_uuid: DEMO_UUIDS.APP_01, role: 'supporting' },
        { capability_uuid: DEMO_UUIDS.CAP_CR, app_uuid: DEMO_UUIDS.APP_02, role: 'supporting' },
        { capability_uuid: DEMO_UUIDS.CAP_BP, app_uuid: DEMO_UUIDS.APP_01, role: 'supporting' },
        { capability_uuid: DEMO_UUIDS.CAP_BR, app_uuid: DEMO_UUIDS.APP_02, role: 'supporting' },
        { capability_uuid: DEMO_UUIDS.CAP_CI, app_uuid: DEMO_UUIDS.APP_01, role: 'primary' },
        { capability_uuid: DEMO_UUIDS.CAP_IP, app_uuid: DEMO_UUIDS.APP_02, role: 'primary' },
        { capability_uuid: DEMO_UUIDS.CAP_BP_L4, app_uuid: DEMO_UUIDS.APP_01, role: 'supporting' },
        { capability_uuid: DEMO_UUIDS.CAP_CI_L4, app_uuid: DEMO_UUIDS.APP_01, role: 'primary' },
        { capability_uuid: DEMO_UUIDS.CAP_UA_L4, app_uuid: DEMO_UUIDS.APP_02, role: 'primary' },
    ];
    for (const l of appLinks) {
        const appRow = await safeQuery(pool, 'SELECT id FROM data.c3_application WHERE uuid = $1', [l.app_uuid], `lookup app ${l.app_uuid}`);
        if (!appRow?.rows?.[0]) continue;
        await safeQuery(pool, `
            INSERT INTO data.c3_capability_application_link (capability_uuid, c3_application_id, link_role, created_by)
            VALUES ($1, $2, $3, 'demo-seed')
            ON CONFLICT DO NOTHING
        `, [l.capability_uuid, appRow.rows[0].id, l.role], `cap_app_link:${l.capability_uuid}`);
    }

    // TINs linked to capabilities
    const tinLinks = [
        { capability_uuid: DEMO_UUIDS.CAP_BP, tin_uuid: DEMO_UUIDS.TIN_01, role: 'supporting' },
        { capability_uuid: DEMO_UUIDS.CAP_BR, tin_uuid: DEMO_UUIDS.TIN_02, role: 'supporting' },
        { capability_uuid: DEMO_UUIDS.CAP_CP, tin_uuid: DEMO_UUIDS.TIN_02, role: 'primary' },
        { capability_uuid: DEMO_UUIDS.CAP_CI, tin_uuid: DEMO_UUIDS.TIN_01, role: 'primary' },
        { capability_uuid: DEMO_UUIDS.CAP_CO, tin_uuid: DEMO_UUIDS.TIN_01, role: 'primary' },
        { capability_uuid: DEMO_UUIDS.CAP_CR, tin_uuid: DEMO_UUIDS.TIN_02, role: 'primary' },
        { capability_uuid: DEMO_UUIDS.CAP_IP, tin_uuid: DEMO_UUIDS.TIN_02, role: 'supporting' },
        { capability_uuid: DEMO_UUIDS.CAP_UA, tin_uuid: DEMO_UUIDS.TIN_01, role: 'supporting' },
        { capability_uuid: DEMO_UUIDS.CAP_BP_L4, tin_uuid: DEMO_UUIDS.TIN_02, role: 'supporting' },
        { capability_uuid: DEMO_UUIDS.CAP_CI_L4, tin_uuid: DEMO_UUIDS.TIN_01, role: 'primary' },
        { capability_uuid: DEMO_UUIDS.CAP_UA_L4, tin_uuid: DEMO_UUIDS.TIN_02, role: 'supporting' },
    ];
    for (const l of tinLinks) {
        const tinRow = await safeQuery(pool, 'SELECT id FROM data.c3_technology_interaction WHERE uuid = $1', [l.tin_uuid], `lookup tin ${l.tin_uuid}`);
        if (!tinRow?.rows?.[0]) continue;
        await safeQuery(pool, `
            INSERT INTO data.c3_capability_tin_link (capability_uuid, c3_tin_id, link_role, created_by)
            VALUES ($1, $2, $3, 'demo-seed')
            ON CONFLICT DO NOTHING
        `, [l.capability_uuid, tinRow.rows[0].id, l.role], `cap_tin_link:${l.capability_uuid}`);
    }

    // Data Objects linked to capabilities: two links for each capability.
    const doLinks = [
        // Capability (CP)
        { capability_uuid: DEMO_UUIDS.CAP_CP, do_uuid: DEMO_UUIDS.DO_01, role: 'primary' },
        { capability_uuid: DEMO_UUIDS.CAP_CP, do_uuid: DEMO_UUIDS.DO_02, role: 'supporting' },
        // Communication Service (CO)
        { capability_uuid: DEMO_UUIDS.CAP_CO, do_uuid: DEMO_UUIDS.DO_02, role: 'primary' },
        { capability_uuid: DEMO_UUIDS.CAP_CO, do_uuid: DEMO_UUIDS.DO_01, role: 'supporting' },
        // Business Process (BP)
        { capability_uuid: DEMO_UUIDS.CAP_BP, do_uuid: DEMO_UUIDS.DO_01, role: 'primary' },
        { capability_uuid: DEMO_UUIDS.CAP_BP, do_uuid: DEMO_UUIDS.DO_02, role: 'supporting' },
        // Business Role (BR)
        { capability_uuid: DEMO_UUIDS.CAP_BR, do_uuid: DEMO_UUIDS.DO_01, role: 'primary' },
        { capability_uuid: DEMO_UUIDS.CAP_BR, do_uuid: DEMO_UUIDS.DO_02, role: 'supporting' },
        // COI Service (CI)
        { capability_uuid: DEMO_UUIDS.CAP_CI, do_uuid: DEMO_UUIDS.DO_01, role: 'primary' },
        { capability_uuid: DEMO_UUIDS.CAP_CI, do_uuid: DEMO_UUIDS.DO_02, role: 'supporting' },
        // Core Service (CR)
        { capability_uuid: DEMO_UUIDS.CAP_CR, do_uuid: DEMO_UUIDS.DO_02, role: 'primary' },
        { capability_uuid: DEMO_UUIDS.CAP_CR, do_uuid: DEMO_UUIDS.DO_01, role: 'supporting' },
        // Information Product (IP)
        { capability_uuid: DEMO_UUIDS.CAP_IP, do_uuid: DEMO_UUIDS.DO_02, role: 'primary' },
        { capability_uuid: DEMO_UUIDS.CAP_IP, do_uuid: DEMO_UUIDS.DO_01, role: 'supporting' },
        // User Application (UA)
        { capability_uuid: DEMO_UUIDS.CAP_UA, do_uuid: DEMO_UUIDS.DO_02, role: 'primary' },
        { capability_uuid: DEMO_UUIDS.CAP_UA, do_uuid: DEMO_UUIDS.DO_01, role: 'supporting' },
        { capability_uuid: DEMO_UUIDS.CAP_BP_L4, do_uuid: DEMO_UUIDS.DO_01, role: 'primary' },
        { capability_uuid: DEMO_UUIDS.CAP_CI_L4, do_uuid: DEMO_UUIDS.DO_01, role: 'primary' },
        { capability_uuid: DEMO_UUIDS.CAP_UA_L4, do_uuid: DEMO_UUIDS.DO_02, role: 'primary' },
    ];
    for (const l of doLinks) {
        const doRow = await safeQuery(pool, 'SELECT id FROM data.c3_data_object WHERE uuid = $1', [l.do_uuid], `lookup do ${l.do_uuid}`);
        if (!doRow?.rows?.[0]) continue;
        await safeQuery(pool, `
            INSERT INTO data.c3_capability_data_object_link (capability_uuid, c3_data_object_id, link_role, created_by)
            VALUES ($1, $2, $3, 'demo-seed')
            ON CONFLICT DO NOTHING
        `, [l.capability_uuid, doRow.rows[0].id, l.role], `cap_do_link:${l.capability_uuid}`);
    }

    // C3 Services linked to capabilities: each capability has a C3 Service link.
    const svcLinks = [
        { capability_uuid: DEMO_UUIDS.CAP_CP, c3svc_uuid: DEMO_UUIDS.C3SVC_01, role: 'supporting' },
        { capability_uuid: DEMO_UUIDS.CAP_CO, c3svc_uuid: DEMO_UUIDS.C3SVC_01, role: 'primary' },
        { capability_uuid: DEMO_UUIDS.CAP_BP, c3svc_uuid: DEMO_UUIDS.C3SVC_01, role: 'supporting' },
        { capability_uuid: DEMO_UUIDS.CAP_BR, c3svc_uuid: DEMO_UUIDS.C3SVC_01, role: 'supporting' },
        { capability_uuid: DEMO_UUIDS.CAP_CI, c3svc_uuid: DEMO_UUIDS.C3SVC_01, role: 'primary' },
        { capability_uuid: DEMO_UUIDS.CAP_CR, c3svc_uuid: DEMO_UUIDS.C3SVC_01, role: 'supporting' },
        { capability_uuid: DEMO_UUIDS.CAP_IP, c3svc_uuid: DEMO_UUIDS.C3SVC_01, role: 'supporting' },
        { capability_uuid: DEMO_UUIDS.CAP_UA, c3svc_uuid: DEMO_UUIDS.C3SVC_01, role: 'supporting' },
        { capability_uuid: DEMO_UUIDS.CAP_BP_L4, c3svc_uuid: DEMO_UUIDS.C3SVC_01, role: 'supporting' },
        { capability_uuid: DEMO_UUIDS.CAP_CI_L4, c3svc_uuid: DEMO_UUIDS.C3SVC_01, role: 'primary' },
        { capability_uuid: DEMO_UUIDS.CAP_UA_L4, c3svc_uuid: DEMO_UUIDS.C3SVC_01, role: 'supporting' },
    ];
    for (const l of svcLinks) {
        const svcRow = await safeQuery(pool, 'SELECT id FROM data.c3_service WHERE uuid = $1', [l.c3svc_uuid], `lookup c3svc ${l.c3svc_uuid}`);
        if (!svcRow?.rows?.[0]) continue;
        await safeQuery(pool, `
            INSERT INTO data.c3_capability_c3_service_link (capability_uuid, c3_service_id, link_role, created_by)
            VALUES ($1, $2, $3, 'demo-seed')
            ON CONFLICT DO NOTHING
        `, [l.capability_uuid, svcRow.rows[0].id, l.role], `cap_svc_link:${l.capability_uuid}`);
    }
    logger.info('demo-seed: capability entity links OK');
}

function buildDemoGovernanceFixtures() {
    return {
        readinessExceptions: [
            {
                service_id: 'DEMO-RPA-004',
                rule_key: 'requestable_service_has_pricing',
                reason: 'Demo exception: pricing is approved during pilot automation governance.',
                expires_at: '2026-06-30T00:00:00Z',
                approved_by: 'governance-board@example.org',
            },
        ],
        reviews: [
            { service_id: 'DEMO-DOC-006', review_type: 'publish_readiness', status: 'pending', requested_by: 'demo-seed', assigned_to: 'workspace.owner@example.org', due_at: '2026-05-03T00:00:00Z' },
            { service_id: 'DEMO-RPA-004', review_type: 'automation_governance', status: 'in_review', requested_by: 'demo-seed', assigned_to: 'nina.automation@example.org', due_at: '2026-05-14T00:00:00Z' },
            { service_id: 'DEMO-LRG-005', review_type: 'retirement_plan', status: 'in_review', requested_by: 'demo-seed', assigned_to: 'david.prochazka@example.org', due_at: '2026-05-20T00:00:00Z' },
            { service_id: 'DEMO-OBS-007', review_type: 'mission_critical_review', status: 'approved', requested_by: 'demo-seed', assigned_to: 'karel.novak@example.org', due_at: '2026-04-20T00:00:00Z', completed_at: '2026-04-21T00:00:00Z' },
        ],
        decisions: [
            { service_id: 'DEMO-OBS-007', decision_type: 'publish', decision: 'approved', rationale: 'Mission-critical observability service has owner, SLA, and dependency evidence.', decided_by: 'governance-board@example.org', decided_at: '2026-04-21T10:00:00Z' },
            { service_id: 'DEMO-RPA-004', decision_type: 'publish', decision: 'deferred', rationale: 'Primary capability mapping is incomplete until automation capability evidence is connected.', decided_by: 'governance-board@example.org', decided_at: '2026-04-22T10:00:00Z' },
            { service_id: 'DEMO-LRG-005', decision_type: 'retirement', decision: 'approved', rationale: 'Legacy gateway can retire after final report consumers migrate to DAP.', decided_by: 'governance-board@example.org', decided_at: '2026-04-23T10:00:00Z' },
            { service_id: 'DEMO-DOC-006', decision_type: 'publish', decision: 'rejected', rationale: 'Service owner and SLA evidence are missing.', decided_by: 'governance-board@example.org', decided_at: '2026-04-24T10:00:00Z' },
        ],
    };
}

async function seedGovernanceWorkflow(pool) {
    const fixtures = buildDemoGovernanceFixtures();
    for (const item of fixtures.readinessExceptions) {
        await safeQuery(pool, `
            INSERT INTO data.readiness_exception (service_id, rule_key, reason, expires_at, approved_by)
            SELECT sc.id, $2, $3, $4, $5
            FROM data.service_catalog sc
            WHERE sc.service_id = $1 AND sc.is_deleted = FALSE
            ON CONFLICT (service_id, rule_key) DO UPDATE SET
                reason = EXCLUDED.reason,
                expires_at = EXCLUDED.expires_at,
                approved_by = EXCLUDED.approved_by
        `, [item.service_id, item.rule_key, item.reason, item.expires_at, item.approved_by], `readiness_exception:${item.service_id}:${item.rule_key}`);
    }

    for (const review of fixtures.reviews) {
        await safeQuery(pool, `
            INSERT INTO data.governance_review (
                service_id, review_type, status, requested_by, assigned_to, due_at, completed_at
            )
            SELECT sc.id, $2::varchar(80), $3::varchar(40), $4::varchar(255), $5::varchar(255), $6::timestamptz, $7::timestamptz
            FROM data.service_catalog sc
            WHERE sc.service_id = $1 AND sc.is_deleted = FALSE
              AND NOT EXISTS (
                  SELECT 1
                  FROM data.governance_review existing
                  WHERE existing.service_id = sc.id
                    AND existing.review_type = $2::varchar(80)
                    AND existing.status = $3::varchar(40)
              )
        `, [review.service_id, review.review_type, review.status, review.requested_by, review.assigned_to, review.due_at, review.completed_at ?? null], `governance_review:${review.service_id}:${review.review_type}`);
    }

    for (const decision of fixtures.decisions) {
        await safeQuery(pool, `
            INSERT INTO data.governance_decision (
                service_id, decision_type, decision, rationale, decided_by, decided_at
            )
            SELECT sc.id, $2::varchar(80), $3::varchar(40), $4::text, $5::varchar(255), $6::timestamptz
            FROM data.service_catalog sc
            WHERE sc.service_id = $1 AND sc.is_deleted = FALSE
              AND NOT EXISTS (
                  SELECT 1
                  FROM data.governance_decision existing
                  WHERE existing.service_id = sc.id
                    AND existing.decision_type = $2::varchar(80)
                    AND existing.decision = $3::varchar(40)
                    AND existing.decided_at = $6::timestamptz
              )
        `, [decision.service_id, decision.decision_type, decision.decision, decision.rationale, decision.decided_by, decision.decided_at], `governance_decision:${decision.service_id}:${decision.decision_type}`);
    }

    logger.info('demo-seed: governance workflow OK');
}

// ── MAIN EXPORT ──────────────────────────────────────────────────────────────────
async function seedDemoData(pool, options = {}) {
    logger.info('demo-seed: starting demo data seeding...');
    try {
        const locale = resolveDemoSeedLocale(options?.locale);
        await seedReferenceData(pool);
        await seedServices(pool, locale);
        await seedPortfolioAssignments(pool);
        await seedOfferings(pool);
        await seedDomainAvailability(pool);
        await seedRoleAssignments(pool);
        await seedFlavours(pool);
        await seedFlavourSla(pool);
        await seedRelations(pool);
        // C3 section: safely skipped when C3 is not activated.
        await seedC3Taxonomy(pool);
        await seedC3CapabilityBuilder(pool);
        await seedC3Entities(pool);
        await seedServiceC3Mapping(pool);
        await seedCapabilityEntityLinks(pool);
        await seedGovernanceWorkflow(pool);
        logger.info('demo-seed: ✅ done — 8 demo services + governance cockpit fixtures created');
        return { ok: true };
    } catch (err) {
        logger.error(`demo-seed: ❌ failed — ${err.message}`);
        return { ok: false, error: err.message };
    }
}

async function removeDemoData(pool) {
    logger.info('demo-seed: removing demo data...');
    try {
        // Delete C3 entity links.
        for (const uuid of Object.values(DEMO_UUIDS)) {
            await safeQuery(pool, 'DELETE FROM data.c3_capability_application_link WHERE capability_uuid = $1', [uuid]);
            await safeQuery(pool, 'DELETE FROM data.c3_capability_tin_link WHERE capability_uuid = $1', [uuid]);
            await safeQuery(pool, 'DELETE FROM data.c3_capability_data_object_link WHERE capability_uuid = $1', [uuid]);
            await safeQuery(pool, 'DELETE FROM data.c3_capability_c3_service_link WHERE capability_uuid = $1', [uuid]);
        }
        // Delete C3 entity records.
        for (const uuid of [DEMO_UUIDS.APP_01, DEMO_UUIDS.APP_02]) {
            await safeQuery(pool, 'DELETE FROM data.c3_application WHERE uuid = $1', [uuid]);
        }
        for (const uuid of [DEMO_UUIDS.TIN_01, DEMO_UUIDS.TIN_02]) {
            await safeQuery(pool, 'DELETE FROM data.c3_technology_interaction WHERE uuid = $1', [uuid]);
        }
        for (const uuid of [DEMO_UUIDS.DO_01, DEMO_UUIDS.DO_02]) {
            await safeQuery(pool, 'DELETE FROM data.c3_data_object WHERE uuid = $1', [uuid]);
        }
        await safeQuery(pool, 'DELETE FROM data.c3_service WHERE uuid = $1', [DEMO_UUIDS.C3SVC_01]);
        // C3 taxonomy
        for (const uuid of Object.values(DEMO_UUIDS)) {
            await safeQuery(pool, 'DELETE FROM data.c3_taxonomy WHERE uuid = $1', [uuid]);
        }
        // C3 capability builder entries (L1/L2 hierarchy + L3 chips + L4 sub-chips for both spirals)
        await safeQuery(pool, `
            DELETE FROM data.c3_capability_builder
            WHERE page_id IN (
                -- Spiral_7 L1
                'DEMO-BP-L1-S7','DEMO-BR-L1-S7','DEMO-CP-L1-S7','DEMO-CI-L1-S7',
                'DEMO-CO-L1-S7','DEMO-CR-L1-S7','DEMO-IP-L1-S7','DEMO-UA-L1-S7',
                -- Spiral_7 L2
                'DEMO-BP-L2-S7','DEMO-BR-L2-S7','DEMO-CP-L2-S7','DEMO-CI-L2-S7',
                'DEMO-CO-L2-S7','DEMO-CR-L2-S7','DEMO-IP-L2-S7','DEMO-UA-L2-S7',
                -- Spiral_7 L3
                'DEMO-BP-001','DEMO-BR-001','DEMO-CP-001','DEMO-CI-001',
                'DEMO-CO-001','DEMO-CR-S7','DEMO-IP-S7','DEMO-UA-S7',
                -- Spiral_7 L4
                'DEMO-BP-010','DEMO-CI-010','DEMO-UA-010',
                -- Spiral_6 L1
                'DEMO-BP-L1-S6','DEMO-BR-L1-S6','DEMO-CP-L1-S6','DEMO-CI-L1-S6',
                'DEMO-CO-L1-S6','DEMO-CR-L1-S6','DEMO-IP-L1-S6','DEMO-UA-L1-S6',
                -- Spiral_6 L2
                'DEMO-BP-L2-S6','DEMO-BR-L2-S6','DEMO-CP-L2-S6','DEMO-CI-L2-S6',
                'DEMO-CO-L2-S6','DEMO-CR-L2-S6','DEMO-IP-L2-S6','DEMO-UA-L2-S6',
                -- Spiral_6 L3
                'DEMO-BP-S6','DEMO-BR-S6','DEMO-CP-S6','DEMO-CI-S6',
                'DEMO-CO-S6','DEMO-CR-001','DEMO-IP-001','DEMO-UA-001',
                -- Spiral_6 L4
                'DEMO-BP-010-S6','DEMO-CI-010-S6','DEMO-UA-010-S6'
            )
        `, [], 'c3_builder:remove');
        // Flavour-specific SLA overrides (linked to demo services)
        await safeQuery(pool, `
            DELETE FROM data.service_sla
            WHERE service_id IN (
                SELECT id FROM data.service_catalog
                WHERE service_id LIKE 'DEMO-%'
            ) AND source_field = 'demo-seed'
        `, [], 'service_sla:remove');
        await safeQuery(pool, `
            DELETE FROM data.readiness_exception
            WHERE service_id IN (SELECT id FROM data.service_catalog WHERE service_id LIKE 'DEMO-%')
        `, [], 'readiness_exception:remove');
        await safeQuery(pool, `
            DELETE FROM data.governance_decision
            WHERE service_id IN (SELECT id FROM data.service_catalog WHERE service_id LIKE 'DEMO-%')
        `, [], 'governance_decision:remove');
        await safeQuery(pool, `
            DELETE FROM data.governance_review
            WHERE service_id IN (SELECT id FROM data.service_catalog WHERE service_id LIKE 'DEMO-%')
        `, [], 'governance_review:remove');
        await safeQuery(pool, `
            DELETE FROM data.service_offering
            WHERE service_id IN (SELECT id FROM data.service_catalog WHERE service_id LIKE 'DEMO-%')
        `, [], 'service_offering:remove');
        // Services
        await pool.query(`
            UPDATE data.service_catalog SET is_deleted = TRUE
            WHERE service_id LIKE 'DEMO-%'
        `);
        logger.info('demo-seed: ✅ demo data removed');
        return { ok: true };
    } catch (err) {
        logger.error(`demo-seed: ❌ remove failed — ${err.message}`);
        return { ok: false, error: err.message };
    }
}

module.exports = {
    seedDemoData,
    removeDemoData,
    DEMO_UUIDS,
    buildDemoFlavours,
    buildDemoGovernanceFixtures,
    buildDemoOfferings,
    buildDemoRelations,
    buildDemoServiceC3Mappings,
    buildDemoServices,
    resolveDemoSeedLocale,
};
