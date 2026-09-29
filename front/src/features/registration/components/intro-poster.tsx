import { ButtonLink } from '@/components/server/ui/button';
import { BrandMark } from '@/components/server/ui/brand-mark';
import { CalendarIcon, HeartOffIcon, PeopleIcon, PinIcon, SproutIcon } from '@/components/server/ui/icons';
import { CityPosterArt } from '@/components/server/city-poster-art';

import { PosterHeadline } from './poster-headline';

const PILLARS = [
  { Icon: PeopleIcon, title: 'Conheça pessoas', detail: 'Com interesses em comum', tone: 'text-primary' },
  { Icon: CalendarIcon, title: 'Participe de atividades gratuitas', detail: 'Encontros locais, na vida real', tone: 'text-warning' },
  { Icon: PinIcon, title: 'Descubra sua cidade', detail: 'Novos lugares, novas histórias', tone: 'text-primary' },
  { Icon: SproutIcon, title: 'Construa sua vida social', detail: 'Mais convívio no seu dia a dia', tone: 'text-warning' },
] as const;

/**
 * First contact with EventMatch (Convite Cívico): explains purpose, 18+ and the non-dating stance
 * before any personal data is requested. The only action is “Começar meu cadastro”.
 */
export function IntroPoster() {
  return (
    <main className="relative mx-auto grid min-h-dvh max-w-7xl grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12 lg:px-10">
      <header className="relative z-10 flex items-start justify-between gap-4 px-5 pt-8 sm:px-8 lg:col-span-2 lg:px-0">
        <BrandMark className="min-w-0" />
        <p className="max-w-[7rem] shrink-0 text-balance border-b-2 border-primary pb-2 text-right text-[0.625rem] font-bold uppercase leading-relaxed tracking-[0.16em] text-foreground sm:max-w-[10rem] sm:text-xs sm:tracking-[0.24em]">
          A vida social também acontece aqui
        </p>
      </header>

      <div className="relative -mt-2 overflow-hidden lg:order-2 lg:mt-0 lg:flex lg:items-end lg:self-stretch">
        <CityPosterArt />
      </div>

      <section
        aria-labelledby="intro-title"
        className="relative z-10 flex flex-col gap-8 px-5 pb-10 sm:px-8 lg:order-1 lg:justify-center lg:px-0 lg:pb-16"
      >
        <PosterHeadline
          id="intro-title"
          lead="Interesses em comum."
          accent="Mais vida na sua cidade."
          className="-mt-6 lg:mt-0"
        />
        <p className="max-w-[46ch] text-lg leading-relaxed text-foreground sm:text-xl">
          O EventMatch conecta pessoas adultas (18+) para viver atividades locais, fazer amizades, ter
          companhia e descobrir a cidade juntas.
        </p>

        <ul className="grid border-t border-border sm:grid-cols-2 sm:gap-x-8">
          {PILLARS.map(({ Icon, title, detail, tone }) => (
            <li key={title} className="flex items-center gap-4 border-b border-border py-3.5">
              <Icon className={`size-7 shrink-0 ${tone}`} strokeWidth={2.2} />
              <span className="min-w-0">
                <span className="block text-sm font-bold uppercase leading-snug text-foreground">{title}</span>
                <span className="block text-sm leading-snug text-muted-foreground">{detail}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-5 rounded-2xl border border-border bg-surface p-5">
          <span className="grid size-16 shrink-0 place-items-center rounded-full border-2 border-primary text-foreground">
            <HeartOffIcon className="size-8" />
          </span>
          <span aria-hidden className="h-12 w-px shrink-0 bg-border" />
          <p className="text-muted-foreground">
            <strong className="block text-lg font-bold text-foreground">Não é app de namoro.</strong>
            Aqui o foco é amizade, convivência e experiências na vida real.
          </p>
        </div>

        <ButtonLink href="/cadastro" wide forward>
          Começar meu cadastro
        </ButtonLink>

        <footer className="space-y-1 text-center text-sm text-muted-foreground">
          <p>Só para maiores de 18 anos.</p>
          <p>Um convívio mais diverso, ativo e humano começa aqui.</p>
          <span aria-hidden className="mx-auto mt-4 block h-0.5 w-8 bg-primary" />
        </footer>
      </section>
    </main>
  );
}
