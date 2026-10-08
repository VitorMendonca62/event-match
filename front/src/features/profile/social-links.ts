import { SOCIAL_PROVIDERS, type SocialProvider } from './contracts';
import { SOCIAL_PROVIDER_LABELS } from './messages';

export const SOCIAL_PROVIDER_OPTIONS: readonly Readonly<{ value: SocialProvider; label: string }>[] = SOCIAL_PROVIDERS.map((value) => ({
  value,
  label: SOCIAL_PROVIDER_LABELS[value],
}));
