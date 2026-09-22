import { describe, expect, test } from 'bun:test';
import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';

import { QueryProvider } from '../../src/components/client/query-provider';

function QueryClientProbe() {
  const queryClient = useQueryClient();

  return <span>{queryClient instanceof QueryClient ? 'available' : 'missing'}</span>;
}

describe('QueryProvider', () => {
  test('makes a query client available without executing a query', () => {
    const markup = renderToStaticMarkup(
      <QueryProvider>
        <QueryClientProbe />
      </QueryProvider>,
    );

    expect(markup).toBe('<span>available</span>');
  });
});
