import { describe, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { LocationField } from '../../src/features/location/components/location-field';

const federativeUnits = [
  { code: 'DF' as const, name: 'Distrito Federal' },
  { code: 'PE' as const, name: 'Pernambuco' },
];

function render(props: Partial<Parameters<typeof LocationField>[0]> = {}) {
  return renderToStaticMarkup(
    <LocationField federativeUnits={federativeUnits} onChange={() => {}} {...props} />,
  );
}

describe('location field (SDD-023)', () => {
  test('keeps the municipality unavailable until a federative unit is selected', () => {
    const markup = render();

    expect(markup).toContain('Onde você mora?');
    expect(markup).toContain('Não pedimos endereço, bairro, CEP ou sua localização do aparelho.');
    expect(markup).toMatch(/name="municipalityQuery"[^>]*disabled|disabled[^>]*name="municipalityQuery"/);
    expect(markup).toContain('Escolha primeiro seu estado');
    expect(markup).toContain('Digite pelo menos duas letras para buscar.');
  });

  test('preserves an initial structured location without serializing a municipality catalog', () => {
    const markup = render({
      initialUfCode: 'DF',
      initialMunicipalityCode: '5300108',
      initialMunicipalityName: 'Brasília',
    });

    expect(markup).toContain('value="DF" selected=""');
    expect(markup).toContain('value="Brasília"');
    expect(markup).toContain('name="municipalityCode" value="5300108"');
    expect(markup).not.toContain('role="option"');
  });

  test('exposes the combobox and its live feedback with labels and no component-local colors', () => {
    const markup = render({ initialUfCode: 'PE' });

    expect(markup).toContain('role="combobox"');
    expect(markup).toContain('aria-autocomplete="list"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('aria-controls=');
    expect(markup).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });
});
