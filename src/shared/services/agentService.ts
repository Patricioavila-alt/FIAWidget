// ============================================================
// agentService — barrel re-export
// Centraliza todos los servicios de la API FiA.
//
// Uso:
//   import { getAuthToken }         from '@/shared/services/agentService';
//   import { FiAChatSession }       from '@/shared/services/agentService';
//   import { validatePrescription } from '@/shared/services/agentService';
// ============================================================

export { getAuthToken, BASE_URL }                from './authService';
export { FiAChatSession }                        from './chatSession';
export type { ChatCallbacks }                    from './chatSession';
export { validatePrescription }                  from './validateService';
export type {
  ValidateRequest,
  ValidateNode,
  ValidateVerdict,
  ValidateCallbacks,
}                                                from './validateService';
