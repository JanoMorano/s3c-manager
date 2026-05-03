'use client';

import { useEffect, useId, useState } from 'react';
import { apiFetch } from '@/features/services/api/services.api';
import styles from './Picker.module.css';

export interface PickerOption {
  value: string;
  label: string;
  description?: string;
}

interface PickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  scope?: string;
  required?: boolean;
}

interface EntityPickerProps extends PickerProps {
  kind: 'user' | 'service' | 'capability' | 'c3';
}

function normalizeText(value: unknown) {
  return String(value ?? '').trim();
}

function optionFromUser(row: Record<string, unknown>): PickerOption | null {
  const email = normalizeText(row.email);
  const username = normalizeText(row.username);
  const display = normalizeText(row.display_name) || username || email;
  const value = email || username;
  if (!value) return null;
  return { value, label: display, description: email && email !== display ? email : username };
}

function optionFromService(row: Record<string, unknown>): PickerOption | null {
  const serviceId = normalizeText(row.service_id);
  const title = normalizeText(row.title);
  if (!serviceId) return null;
  return { value: serviceId, label: title || serviceId, description: title ? serviceId : undefined };
}

function optionFromCapability(row: Record<string, unknown>): PickerOption | null {
  const slug = normalizeText(row.slug);
  const uuid = normalizeText(row.uuid);
  const code = normalizeText(row.code ?? row.external_id);
  const title = normalizeText(row.title ?? row.name);
  const value = slug || uuid || code || title;
  if (!value) return null;
  return { value, label: title || code || value, description: code || uuid || slug };
}

function optionFromC3(row: Record<string, unknown>): PickerOption | null {
  const uuid = normalizeText(row.uuid);
  const code = normalizeText(row.external_id ?? row.code ?? row.source_external_id);
  const title = normalizeText(row.title);
  const value = uuid || code;
  if (!value) return null;
  return { value, label: title || code || value, description: code || uuid };
}

function extractRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (payload && typeof payload === 'object') {
    const object = payload as Record<string, unknown>;
    for (const key of ['items', 'rows', 'data', 'capabilities', 'results']) {
      if (Array.isArray(object[key])) return object[key] as Record<string, unknown>[];
    }
  }
  return [];
}

function endpointFor(kind: EntityPickerProps['kind'], query: string) {
  const q = encodeURIComponent(query);
  if (kind === 'user') return '/api/v1/admin/users';
  if (kind === 'service') return `/api/v1/services?limit=25${q ? `&search=${q}` : ''}`;
  if (kind === 'capability') return `/api/v1/capabilities/coverage${q ? `?search=${q}` : ''}`;
  return `/api/v1/taxonomy/c3?limit=25${q ? `&search=${q}` : ''}`;
}

function mapOption(kind: EntityPickerProps['kind'], row: Record<string, unknown>) {
  if (kind === 'user') return optionFromUser(row);
  if (kind === 'service') return optionFromService(row);
  if (kind === 'capability') return optionFromCapability(row);
  return optionFromC3(row);
}

function defaultLabel(kind: EntityPickerProps['kind']) {
  if (kind === 'user') return 'User';
  if (kind === 'service') return 'Service';
  if (kind === 'capability') return 'Capability';
  return 'C3 entity';
}

function EntityPicker({ kind, value, onChange, label, placeholder, required }: EntityPickerProps) {
  const [options, setOptions] = useState<PickerOption[]>([]);
  const [loading, setLoading] = useState(false);
  const listId = `${kind}-picker-${useId().replaceAll(':', '')}`;

  useEffect(() => {
    let cancelled = false;
    const query = value.trim();
    setLoading(true);
    apiFetch<unknown>(endpointFor(kind, query))
      .then((payload) => {
        if (cancelled) return;
        const mapped = extractRows(payload).map((row) => mapOption(kind, row)).filter(Boolean) as PickerOption[];
        setOptions(mapped.slice(0, 25));
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [kind, value]);

  return (
    <label className={styles.field}>
      <span className={styles.label}>{label ?? defaultLabel(kind)}{required ? ' *' : ''}</span>
      <input
        className={styles.input}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        list={listId}
        required={required}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={`${option.value}-${option.label}`} value={option.value}>
            {option.description ? `${option.label} · ${option.description}` : option.label}
          </option>
        ))}
      </datalist>
      {loading ? <span className={styles.hint}>Searching...</span> : null}
    </label>
  );
}

export function UserPicker(props: PickerProps) {
  return <EntityPicker kind="user" placeholder="owner@example.com" {...props} />;
}

export function ServicePicker(props: PickerProps) {
  return <EntityPicker kind="service" placeholder="SVC-IAM" {...props} />;
}

export function CapabilityPicker(props: PickerProps) {
  return <EntityPicker kind="capability" placeholder="identity-management" {...props} />;
}

export function C3Picker(props: PickerProps) {
  return <EntityPicker kind="c3" placeholder="C3 UUID or code" {...props} />;
}
