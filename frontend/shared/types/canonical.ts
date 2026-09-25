/**
 * §7 Canonical data contract — single source of truth
 * Frontend never resolves parallel naming (service_type / serviceType / CF - Service Type).
 * All API responses map to these types via service.mapper.ts.
 */

export type ServiceStatus    = 'active' | 'planned' | 'retired' | 'deprecated' | 'draft';
export type ServiceType      = 'CF' | 'CFS' | 'ES' | 'SS' | 'MS' | 'AS';
export type AvailabilityLevel = 'high' | 'medium' | 'low';
export type Domain = 'NEXUS' | 'VERTEX' | 'ORBIT' | 'PULSE' | 'RELAY' | 'CLOUD' | 'GRID' | 'PRISM' | 'HELIX' | 'ZENITH' | 'APEX' | 'VORTEX' | 'MATRIX';
/** Relation type codes are defined in shared/service-catalogue/relationTypes.json (see features/services/relationTypes.ts). */
export type RelationType = string;

export interface PersonRef {
  id?: string;
  name: string;
  email?: string;
}

export interface GroupRef {
  id?: string;
  name: string;
}
