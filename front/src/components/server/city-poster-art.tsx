import { cn } from '@/shared/ui/cn';

/**
 * Replaceable art slot for the “Convite Cívico” poster: flat urban planes (towers, banners, a
 * viaduct, stairs and tree masses) in the semantic palette. Pure geometry, no figures; the final
 * approved illustration replaces this component without layout changes (surface brief).
 */
export function CityPosterArt({ className }: Readonly<{ className?: string }>) {
  return (
    <svg
      viewBox="0 0 390 340"
      aria-hidden
      focusable={false}
      className={cn('block h-auto w-full', className)}
    >
      <defs>
        <pattern id="poster-windows" width="12" height="15" patternUnits="userSpaceOnUse">
          <rect x="3" y="3" width="5" height="8" fill="var(--background)" opacity="0.88" />
        </pattern>
        <pattern id="poster-halftone" width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1.1" fill="var(--foreground)" opacity="0.16" />
        </pattern>
      </defs>

      {/* Tree masses behind the skyline */}
      <g fill="var(--warning)">
        <circle cx="22" cy="176" r="30" />
        <circle cx="58" cy="158" r="26" />
        <circle cx="12" cy="214" r="26" />
        <circle cx="96" cy="206" r="22" />
        <circle cx="344" cy="226" r="14" opacity="0.9" />
        <circle cx="296" cy="232" r="12" opacity="0.9" />
      </g>

      {/* Skyline */}
      <g fill="var(--foreground)">
        <rect x="40" y="132" width="52" height="150" />
        <rect x="96" y="92" width="62" height="190" />
        <rect x="156" y="14" width="92" height="268" />
        <rect x="246" y="104" width="56" height="178" />
        <rect x="300" y="146" width="42" height="136" />
      </g>
      <g fill="url(#poster-windows)">
        <rect x="46" y="140" width="40" height="120" />
        <rect x="102" y="100" width="50" height="150" />
        <rect x="162" y="24" width="14" height="240" />
        <rect x="252" y="112" width="44" height="150" />
        <rect x="306" y="154" width="30" height="110" />
      </g>

      {/* Carmine banner on the tower */}
      <rect x="178" y="52" width="66" height="164" fill="var(--primary)" />
      <g
        fill="var(--foreground)"
        style={{ fontFamily: 'var(--font-poster), sans-serif', fontStretch: '75%' }}
        fontWeight="800"
        fontSize="8"
      >
        <text x="188" y="76">MAIS</text>
        <text x="188" y="92" textLength="51" lengthAdjust="spacingAndGlyphs">ENCONTROS</text>
        <text x="188" y="112">MAIS</text>
        <text x="188" y="128" textLength="46" lengthAdjust="spacingAndGlyphs">HISTÓRIAS</text>
        <text x="188" y="148">UMA</text>
        <text x="188" y="164" textLength="30" lengthAdjust="spacingAndGlyphs">CIDADE</text>
        <text x="188" y="180" textLength="38" lengthAdjust="spacingAndGlyphs">MAIS VIVA</text>
      </g>
      <rect x="188" y="194" width="18" height="3" fill="var(--foreground)" />

      {/* Amber banner on the lamp post */}
      <rect x="322" y="150" width="44" height="84" fill="var(--warning)" />
      <g
        fill="var(--background)"
        style={{ fontFamily: 'var(--font-poster), sans-serif', fontStretch: '75%' }}
        fontWeight="800"
        fontSize="7.4"
      >
        <text x="327" y="168" textLength="33" lengthAdjust="spacingAndGlyphs">PESSOAS</text>
        <text x="328" y="184" textLength="22" lengthAdjust="spacingAndGlyphs">IDEIAS</text>
        <text x="328" y="200" textLength="31" lengthAdjust="spacingAndGlyphs">LUGARES</text>
        <text x="328" y="216" textLength="29" lengthAdjust="spacingAndGlyphs">JUNTOS</text>
      </g>
      <rect x="370" y="104" width="6" height="196" fill="var(--foreground)" />
      <rect x="363" y="94" width="20" height="12" rx="3" fill="var(--foreground)" />

      {/* Viaduct */}
      <rect x="150" y="238" width="240" height="14" fill="var(--foreground)" />
      <g fill="var(--foreground)" opacity="0.9">
        <rect x="160" y="252" width="9" height="34" />
        <rect x="204" y="252" width="9" height="34" />
        <rect x="248" y="252" width="9" height="34" />
        <rect x="292" y="252" width="9" height="34" />
        <rect x="336" y="252" width="9" height="34" />
      </g>

      {/* Public stairs in the foreground */}
      <polygon points="0,236 390,300 390,340 0,340" fill="var(--card)" />
      <polygon points="0,236 390,300 390,340 0,340" fill="url(#poster-halftone)" />
      <g stroke="var(--border)" strokeWidth="3">
        <line x1="0" y1="262" x2="390" y2="318" />
        <line x1="0" y1="290" x2="390" y2="334" />
        <line x1="0" y1="318" x2="390" y2="350" />
      </g>
    </svg>
  );
}
