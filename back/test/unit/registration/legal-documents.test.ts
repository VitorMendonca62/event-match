import { beforeEach, describe, expect, test } from 'bun:test';

import { LegalDocumentText } from '../../../src/modules/registration/domain/value-objects/legal-document-text';
import {
  ADULT_BIRTH_DATE,
  createIncompleteAccount,
  createRegistrationHarness,
  DOCUMENTS,
  INTEREST_IDS,
  seedCatalogAndTerms,
  type RegistrationHarness,
} from '../../support/registration-fakes';

const ARTIFACT = '---\nkind: terms\nversion: 1.0.0\n---\n\n# Termos\n\nTexto.\n';

describe('LegalDocumentText', () => {
  test('separates the frontmatter from the body and keeps the body verbatim', () => {
    expect(LegalDocumentText.fromArtifact(ARTIFACT).body).toBe('# Termos\n\nTexto.\n');
  });

  test('accepts an artifact without frontmatter and ignores a BOM', () => {
    expect(LegalDocumentText.fromArtifact('﻿  # Só corpo\n').body).toBe('# Só corpo\n');
  });

  test('rejects an unterminated frontmatter and an empty body with a typed error', () => {
    expect(() => LegalDocumentText.fromArtifact('---\nkind: terms\n# sem fim')).toThrow(
      expect.objectContaining({ code: 'INVALID_LEGAL_DOCUMENT' }),
    );
    expect(() => LegalDocumentText.fromArtifact('---\nkind: terms\n---\n \n')).toThrow(
      expect.objectContaining({ code: 'INVALID_LEGAL_DOCUMENT' }),
    );
  });
});

describe('current legal documents (ADR-028)', () => {
  let harness: RegistrationHarness;
  const days = (count: number) => new Date(harness.clock.now().getTime() + count * 86_400_000);

  beforeEach(() => {
    harness = createRegistrationHarness();
    seedCatalogAndTerms(harness);
  });

  test('lists the body without frontmatter, using the injected clock', async () => {
    harness.database.state.termsDocuments.set(DOCUMENTS.terms, {
      kind: 'terms',
      status: 'approved',
      version: '1.0.0',
      effectiveAt: days(-1),
      content: ARTIFACT,
    });

    const documents = await harness.legalDocuments.execute({ locale: 'pt-BR' });

    expect(documents).toHaveLength(3);
    expect(documents.find((document) => document.id === DOCUMENTS.terms)).toEqual({
      id: DOCUMENTS.terms,
      kind: 'terms',
      version: '1.0.0',
      locale: 'pt-BR',
      effectiveAt: days(-1),
      body: '# Termos\n\nTexto.\n',
    });
    expect(documents.every((document) => !('content' in document))).toBe(true);
  });

  test('offers only the newest effective version, never placeholder, retired or future ones', async () => {
    const state = harness.database.state.termsDocuments;
    state.set(DOCUMENTS.terms, { kind: 'terms', status: 'retired', effectiveAt: days(-10) });
    state.set('10000000-0000-7000-8000-0000000000a1', { kind: 'terms', status: 'approved', effectiveAt: days(-2) });
    state.set('10000000-0000-7000-8000-0000000000a2', { kind: 'terms', status: 'approved', effectiveAt: days(3) });
    state.set('10000000-0000-7000-8000-0000000000a3', { kind: 'terms', status: 'placeholder', effectiveAt: days(-1) });

    const documents = await harness.legalDocuments.execute({ locale: 'pt-BR' });

    expect(documents.filter((document) => document.kind === 'terms').map((document) => document.id)).toEqual([
      '10000000-0000-7000-8000-0000000000a1',
    ]);
    expect(documents).toHaveLength(3);
  });

  test('a kind without an effective version stays absent so the step remains blocked', async () => {
    harness.database.state.termsDocuments.delete(DOCUMENTS.privacy);

    const documents = await harness.legalDocuments.execute({ locale: 'pt-BR' });

    expect(documents.map((document) => document.kind).sort()).toEqual(['community_rules', 'terms']);
  });

  test('activation rejects a superseded document id and records nothing', async () => {
    const accountId = await createIncompleteAccount(harness);
    const newer = '10000000-0000-7000-8000-0000000000b1';
    harness.database.state.termsDocuments.set(newer, { kind: 'terms', status: 'approved', effectiveAt: days(-1) });
    harness.database.state.termsDocuments.get(DOCUMENTS.terms)!.effectiveAt = days(-5);

    await expect(
      harness.complete.execute({
        accountId,
        birthDate: ADULT_BIRTH_DATE,
        interestIds: INTEREST_IDS,
        documentIds: Object.values(DOCUMENTS),
      }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_CANNOT_BE_ACTIVATED' });
    expect(harness.database.state.acceptances.size).toBe(0);

    await expect(
      harness.complete.execute({
        accountId,
        birthDate: ADULT_BIRTH_DATE,
        interestIds: INTEREST_IDS,
        documentIds: [newer, DOCUMENTS.privacy, DOCUMENTS.community_rules],
      }),
    ).resolves.toEqual({ accountId, status: 'active' });
    expect(harness.database.state.acceptances.size).toBe(3);
  });

  test('activation rejects a future version even when approved', async () => {
    const accountId = await createIncompleteAccount(harness);
    harness.database.state.termsDocuments.set(DOCUMENTS.terms, { kind: 'terms', status: 'approved', effectiveAt: days(1) });

    await expect(
      harness.complete.execute({
        accountId,
        birthDate: ADULT_BIRTH_DATE,
        interestIds: INTEREST_IDS,
        documentIds: Object.values(DOCUMENTS),
      }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_CANNOT_BE_ACTIVATED' });
  });
});
