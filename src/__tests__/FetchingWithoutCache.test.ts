/**
 * @jest-environment jsdom
 */
import Statsig from '..';
import * as TestData from './basic_config_spec.json';

describe('Fetch Without Cache', () => {
  let request: { input: RequestInfo | URL; init?: RequestInit } | null = null;

  (global as any).fetch = jest.fn(
    (input: RequestInfo | URL, init?: RequestInit) => {
      if (input.toString().includes('download_config_specs')) {
        request = { input, init };
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(JSON.stringify(TestData)),
        });
      }

      return Promise.resolve({});
    },
  );

  it('makes requests without browser caching (reload)', async () => {
    await Statsig.initializeAsync('client-key');
    expect(request?.init?.cache).toBe('reload');
  });
});
