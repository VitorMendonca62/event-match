import type { FlowStage } from './contracts';

/**
 * Explicit step machine of the registration journey (SDD-010 §4.4). The backend stage is always
 * authoritative; local steps only subdivide `account_incomplete` (documents → interests → review).
 */
export const STEPS = [
  'birth',
  'contact',
  'otp',
  'password',
  'required_data',
  'legal',
  'interests',
  'review',
] as const;
export type Step = (typeof STEPS)[number];

export const STEP_LABELS: Record<Step, string> = {
  birth: 'Idade',
  contact: 'E-mail',
  otp: 'Código',
  password: 'Senha',
  required_data: 'Seus dados',
  legal: 'Documentos',
  interests: 'Interesses',
  review: 'Revisão',
};

const LOCAL_SUBSTEPS: readonly Step[] = ['legal', 'interests', 'review'];

/** Step a remote stage lands on; `null` when the journey has ended (`completed`). */
export function stepForStage(stage: FlowStage | null): Step | null {
  switch (stage) {
    case null:
      return 'birth';
    case 'age_eligible':
      return 'contact';
    case 'verification_pending':
      return 'otp';
    case 'contact_verified':
      return 'password';
    case 'registration_in_progress':
      return 'required_data';
    case 'account_incomplete':
      return 'legal';
    case 'completed':
      return null;
  }
}

/**
 * Reconciles a remote stage with the step remembered locally. The local step wins only when it is a
 * substep of the same remote stage; it never moves the journey ahead of the backend.
 */
export function reconcileStep(stage: FlowStage | null, localStep: Step | undefined): Step | null {
  const remote = stepForStage(stage);
  if (remote === 'legal' && localStep && LOCAL_SUBSTEPS.includes(localStep)) return localStep;
  return remote;
}

export function stepIndex(step: Step): number {
  return STEPS.indexOf(step);
}

/** Back navigation exists only between local substeps; persisted transitions are never reverted. */
export function previousStep(step: Step): Step | null {
  if (step === 'interests') return 'legal';
  if (step === 'review') return 'interests';
  return null;
}

export function nextLocalStep(step: Step): Step | null {
  if (step === 'legal') return 'interests';
  if (step === 'interests') return 'review';
  return null;
}
