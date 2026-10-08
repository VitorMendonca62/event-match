import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProfileSocialLinksField } from '../../src/features/profile/components/profile-social-links-field';
import { ownProfileSchema, profilePreviewSchema, updateProfileSchema, type OwnProfile } from '../../src/features/profile/contracts';

const interestIds = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
const base: OwnProfile = {
  revision: 1, displayName: 'Ana', location: { ufCode: 'PE', municipalityCode: '2611606', municipalityName: 'Recife' }, usageIntents: ['friendship'], interests: interestIds.map((id, index) => ({ id, slug: `interest-${index}`, label: `Interesse ${index}` })),
  presentation: null, photoVisibility: 'private', presentationVisibility: 'private', photo: null, pronounSelection: null, customPronouns: null,
  pronounsVisibility: 'private', profession: null, professionVisibility: 'private', languages: [], languagesVisibility: 'private', activityPreferences: [], activityPreferencesVisibility: 'private', availabilitySlots: [], preferredDistance: null,
  socialLinks: [], completion: { complete: false, completedCount: 4, totalCount: 6, missing: ['photo', 'presentation'] },
};

describe('profile social links field (SDD-020 / ADR-049)', () => {
  test('renders one fixed input per provider and one future-sharing control', () => {
    const markup = renderToStaticMarkup(<ProfileSocialLinksField initial={{ ...base, socialLinks: [{ id: crypto.randomUUID(), provider: 'instagram', identifier: 'ana', position: 1, visibility: 'private', url: 'https://www.instagram.com/ana' }] }} onDirty={() => {}} />);
    expect(markup).toContain('Presença social (opcional)');
    expect(markup).toContain('O EventMatch não verifica esses perfis');
    expect(markup).toContain('Identificador ou link do perfil');
    expect(markup).toContain('Instagram');
    expect(markup).toContain('LinkedIn');
    expect(markup).toContain('>X</span>');
    expect(markup).toContain('placeholder="@pessoa ou instagram.com/pessoa"');
    expect(markup).toContain('placeholder="@pessoa ou linkedin.com/in/pessoa"');
    expect(markup).toContain('placeholder="@pessoa ou x.com/pessoa"');
    expect(markup).not.toContain('Use seu nome de usuário, como @pessoa, ou cole o endereço do perfil.');
    expect(markup).not.toContain('Somente o identificador normalizado será guardado.');
    expect(markup).toContain('Compartilhar redes sociais futuramente?');
    expect(markup).toContain('Ative para mostrar a pessoas autenticadas quando esse recurso estiver disponível.');
    expect(markup).not.toContain('Mover para cima');
    expect(markup).not.toContain('Mover para baixo');
    expect(markup).not.toContain('Adicionar perfil social');
    expect(markup).not.toContain('Remover Instagram');
    expect(markup).toContain('name="socialLinks"');
    expect(markup).toContain('&quot;visibility&quot;:&quot;private&quot;');
    expect(markup).toContain('Endereço derivado:');
  });

  test('keeps response and edit contracts strict and preview only accepts derived links', () => {
    const link = { id: crypto.randomUUID(), provider: 'x' as const, identifier: 'ana_silva', position: 1, visibility: 'authenticated' as const, url: 'https://x.com/ana_silva' };
    expect(ownProfileSchema.safeParse({ ...base, socialLinks: [link] }).success).toBeTrue();
    expect(ownProfileSchema.safeParse({ ...base, socialLinks: [{ ...link, visibility: 'public' }] }).success).toBeTrue();
    expect(profilePreviewSchema.safeParse({ displayName: 'Ana', location: base.location, usageIntents: ['friendship'], interests: [], socialLinks: [{ provider: 'x', identifier: 'ana_silva', url: link.url }] }).success).toBeTrue();
    expect(profilePreviewSchema.safeParse({ displayName: 'Ana', location: base.location, usageIntents: ['friendship'], interests: [], socialLinks: [{ ...link }] }).success).toBeFalse();
    const body = { revision: 1, displayName: 'Ana', ufCode: 'PE', municipalityCode: '2611606', usageIntents: ['friendship'], interestIds, presentation: null, photoVisibility: 'private', presentationVisibility: 'private', pronounSelection: null, customPronouns: null, pronounsVisibility: 'private', profession: null, professionVisibility: 'private', languageCodes: [], languagesVisibility: 'private', activityPreferenceCodes: [], activityPreferencesVisibility: 'private', availabilitySlots: [], preferredDistance: null, socialLinks: [{ provider: 'x', identifierOrUrl: 'https://x.com/ana_silva', position: 1, visibility: 'private' }] };
    expect(updateProfileSchema.safeParse(body).success).toBeTrue();
    expect(updateProfileSchema.safeParse({ ...body, socialLinks: [{ ...body.socialLinks[0], visibility: 'public' }] }).success).toBeFalse();
    expect(updateProfileSchema.safeParse({ ...body, socialLinks: [{ ...body.socialLinks[0], provider: 'x' }, { ...body.socialLinks[0], provider: 'x', position: 2 }] }).success).toBeFalse();
  });
});
