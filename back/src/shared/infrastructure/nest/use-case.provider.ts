import type { FactoryProvider, InjectionToken } from '@nestjs/common';

type Constructor<T> = new (...dependencies: never[]) => T;

/**
 * Registers a framework-free application class (use case or application service) in the Nest
 * container; `inject` lists its constructor dependencies in order.
 */
export function useCaseProvider<T>(
  useCase: Constructor<T>,
  inject: InjectionToken[],
): FactoryProvider<T> {
  return {
    provide: useCase,
    inject,
    useFactory: (...dependencies: unknown[]) => new useCase(...(dependencies as never[])),
  };
}
