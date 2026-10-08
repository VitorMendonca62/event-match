import { describe, expect, test } from 'bun:test';
import { ProfileError } from '../../../src/modules/profiles/domain/errors/profile.error';
import { normalizeSocialLinkDrafts, parseSocialLink, toSocialProfileUrl } from '../../../src/modules/profiles/domain/value-objects/social-link';

const id = '00000000-0000-4000-8000-000000000001';
const draft = (provider: string, identifierOrUrl: string, position = 1, visibility = 'private') => ({ id, provider, identifierOrUrl, position, visibility });

describe('social links (ADR-049)', () => {
  test('normalizes identifiers and approved profile URLs without persisting the URL', () => {
    expect(parseSocialLink({ provider: 'instagram', identifierOrUrl: ' @Pessoa.Exemplo ' })).toEqual({ provider: 'instagram', canonicalIdentifier: 'pessoa.exemplo' });
    expect(parseSocialLink({ provider: 'linkedin', identifierOrUrl: 'https://www.linkedin.com/in/Pessoa-Exemplo/' })).toEqual({ provider: 'linkedin', canonicalIdentifier: 'pessoa-exemplo' });
    expect(parseSocialLink({ provider: 'x', identifierOrUrl: 'https://x.com/Pessoa_Exemplo' })).toEqual({ provider: 'x', canonicalIdentifier: 'pessoa_exemplo' });
    const [link] = normalizeSocialLinkDrafts([draft('instagram', 'https://instagram.com/Pessoa.Exemplo')], () => id);
    expect(link).toMatchObject({ provider: 'instagram', canonicalIdentifier: 'pessoa.exemplo', id });
    expect(toSocialProfileUrl(link)).toBe('https://www.instagram.com/pessoa.exemplo');
  });

  test('rejects foreign hosts, redirects, credentials, ports, queries, fragments, schemes and paths', () => {
    const invalid = [
      'http://instagram.com/pessoa', 'https://evil-instagram.com/pessoa', 'https://sub.instagram.com/pessoa',
      'https://instagram.com.evil.test/pessoa', 'https://user:secret@instagram.com/pessoa', 'https://instagram.com:443/pessoa',
      'https://instagram.com/pessoa?utm_source=eventmatch', 'https://instagram.com/pessoa#bio',
      'https://instagram.com/pessoa/extra', 'https://instagram.com/p/abc', 'javascript:alert(1)',
    ];
    for (const identifierOrUrl of invalid) expect(() => parseSocialLink({ provider: 'instagram', identifierOrUrl })).toThrow(ProfileError);
    expect(() => parseSocialLink({ provider: 'whatsapp', identifierOrUrl: 'pessoa' })).toThrow(ProfileError);
  });

  test('enforces one provider, stable positions, private/authenticated audience and three-link limit', () => {
    const valid = [
      { ...draft('instagram', 'ana', 1), id },
      { ...draft('linkedin', 'ana-silva', 2), id: '00000000-0000-4000-8000-000000000002' },
      { ...draft('x', 'ana_silva', 3), id: '00000000-0000-4000-8000-000000000003', visibility: 'authenticated' },
    ];
    expect(normalizeSocialLinkDrafts(valid, () => crypto.randomUUID())).toHaveLength(3);
    expect(() => normalizeSocialLinkDrafts([{ ...valid[0], position: 2 }, { ...valid[1], position: 2 }], () => crypto.randomUUID())).toThrow(ProfileError);
    expect(() => normalizeSocialLinkDrafts([{ ...valid[0], provider: 'x' }, { ...valid[1], provider: 'x', id: '00000000-0000-4000-8000-000000000002' }], () => crypto.randomUUID())).toThrow(ProfileError);
    expect(() => normalizeSocialLinkDrafts([{ ...valid[0], visibility: 'public' }], () => crypto.randomUUID())).toThrow(ProfileError);
    expect(() => normalizeSocialLinkDrafts([...valid, { ...valid[0], id: '00000000-0000-4000-8000-000000000004', provider: 'instagram', position: 4 }], () => crypto.randomUUID())).toThrow(ProfileError);
  });
});
