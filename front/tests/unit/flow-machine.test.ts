import { describe, expect, test } from 'bun:test';

import { FLOW_STAGES } from '../../src/features/registration/contracts';
import { nextLocalStep, previousStep, reconcileStep, stepForStage } from '../../src/features/registration/flow-machine';

describe('flow machine', () => {
  test('maps every backend stage to its step', () => {
    expect(FLOW_STAGES.map((stage) => stepForStage(stage))).toEqual([
      'contact',
      'otp',
      'password',
      'required_data',
      'interests',
      null,
    ]);
    expect(stepForStage(null)).toBe('birth');
  });

  test('the remote stage dominates a local step that is ahead of it', () => {
    expect(reconcileStep('contact_verified', 'review')).toBe('password');
    expect(reconcileStep(null, 'interests')).toBe('birth');
  });

  test('local substeps are kept only inside account_incomplete', () => {
    expect(reconcileStep('account_incomplete', 'interests')).toBe('interests');
    expect(reconcileStep('account_incomplete', 'review')).toBe('review');
    expect(reconcileStep('account_incomplete', 'password')).toBe('interests');
  });

  test('back navigation never reverts a persisted transition', () => {
    expect(previousStep('review')).toBe('interests');
    for (const step of ['birth', 'contact', 'otp', 'password', 'required_data', 'interests'] as const) {
      expect(previousStep(step)).toBeNull();
    }
    expect(nextLocalStep('interests')).toBe('review');
    expect(nextLocalStep('review')).toBeNull();
  });
});
