'use client';

import { proxyInterestCatalog } from '@/shared/server/catalog-bff';
import { proxyProfile } from '@/shared/server/profile-bff';

export default function ServerOnlyBoundaryFixture() {
  void proxyInterestCatalog;
  void proxyProfile;
  return <p>server-only boundary fixture</p>;
}
