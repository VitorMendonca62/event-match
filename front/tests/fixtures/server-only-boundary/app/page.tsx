'use client';

import { proxyInterestCatalog } from '@/shared/server/catalog-bff';

export default function ServerOnlyBoundaryFixture() {
  void proxyInterestCatalog;
  return <p>server-only boundary fixture</p>;
}
