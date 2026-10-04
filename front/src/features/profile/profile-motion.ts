export function profileScrollBehavior(prefersReducedMotion: boolean): ScrollBehavior {
  return prefersReducedMotion ? 'auto' : 'smooth';
}
