import {
  envelopeSchema,
  type FlowStage,
  interestListDataSchema,
  legalDocumentListDataSchema,
  snapshotDataSchema,
} from '../../features/registration/contracts';
import type { Catalog, InterestOption, LegalDocumentView } from '../../features/registration/view-models';
import type { BffEnv } from '../config/bff-env.server';
import { callBackend } from './backend-client';

export type RegistrationView = Readonly<{
  stage: FlowStage | null;
  expiresAt?: string;
  nextResendAt?: string;
  /** A continuation cookie existed but the backend no longer accepts it. */
  sessionExpired: boolean;
  documents: Catalog<LegalDocumentView>;
  interests: Catalog<InterestOption>;
}>;

type Deps = Readonly<{ env: BffEnv; fetchImpl?: typeof fetch }>;

async function fetchDocuments(deps: Deps): Promise<Catalog<LegalDocumentView>> {
  const upstream = await callBackend(
    { method: 'GET', path: '/registration/legal-documents?locale=pt-BR', internal: true },
    deps.env,
    deps.fetchImpl,
  );
  const envelope = envelopeSchema.safeParse(upstream.body);
  const data = upstream.status === 200 && envelope.success ? legalDocumentListDataSchema.safeParse(envelope.data.data) : undefined;
  if (!data?.success) return { status: 'unavailable' };
  // Only the fields the UI renders are serialized (`server-serialization`).
  return {
    status: 'ready',
    items: data.data.documents.map(({ id, kind, version, effectiveAt }) => ({ id, kind, version, effectiveAt })),
  };
}

async function fetchInterests(deps: Deps): Promise<Catalog<InterestOption>> {
  const upstream = await callBackend(
    { method: 'GET', path: '/catalog/interests?locale=pt-BR', internal: false },
    deps.env,
    deps.fetchImpl,
  );
  const envelope = envelopeSchema.safeParse(upstream.body);
  const data = upstream.status === 200 && envelope.success ? interestListDataSchema.safeParse(envelope.data.data) : undefined;
  if (!data?.success) return { status: 'unavailable' };
  return { status: 'ready', items: data.data.interests.map(({ id, label }) => ({ id, label })) };
}

const DEFERRED = { status: 'deferred' } as const;

/**
 * Server-side view of `/cadastro`. With a continuation, the snapshot and both catalogs start
 * together (`async-parallel`); the catalogs are awaited only on the stage that uses them
 * (`async-defer-await`). Without a continuation nothing is fetched.
 */
export async function loadRegistrationView(continuation: string | undefined, deps: Deps): Promise<RegistrationView> {
  if (!continuation) {
    return { stage: null, sessionExpired: false, documents: DEFERRED, interests: DEFERRED };
  }

  const snapshotPromise = callBackend(
    { method: 'GET', path: '/registration', internal: true, continuation },
    deps.env,
    deps.fetchImpl,
  );
  const catalogsPromise = Promise.all([fetchDocuments(deps), fetchInterests(deps)]);

  const snapshot = await snapshotPromise;
  const envelope = envelopeSchema.safeParse(snapshot.body);
  const data = snapshot.status === 200 && envelope.success ? snapshotDataSchema.safeParse(envelope.data.data) : undefined;

  if (!data?.success) {
    void catalogsPromise;
    return { stage: null, sessionExpired: snapshot.status === 401, documents: DEFERRED, interests: DEFERRED };
  }

  const { stage, expiresAt, nextResendAt } = data.data;
  const base = { stage, expiresAt, ...(nextResendAt ? { nextResendAt } : {}), sessionExpired: false };
  if (stage !== 'account_incomplete') {
    void catalogsPromise;
    return { ...base, documents: DEFERRED, interests: DEFERRED };
  }
  const [documents, interests] = await catalogsPromise;
  return { ...base, documents, interests };
}
