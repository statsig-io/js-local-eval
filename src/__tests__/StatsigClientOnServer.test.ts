/**
 * @jest-environment node
 */

import StatsigClient from '../StatsigClient';
import { EvaluationReason } from '../EvaluationMetadata';
import * as TestData from './other_config_spec.json';

describe('Verify behavior of StatsigClient outside of browser environment', () => {
  const user = { userID: "test", email: 'tore@statsig.com' };
  test('Client ignores window undefined if specified in options', async () => {
    expect.assertions(8);

    // @ts-ignore
    global.fetch = jest.fn((url, params) => {
      if (url.toString().includes('rgstr')) {
        return Promise.resolve({ ok: true });
      }
      if (url.toString().includes('download_config_specs')) {
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(JSON.stringify(TestData)),
        });
      }
    });

    // verify window is undefined
    expect(typeof window).toBe('undefined');

    const client = new StatsigClient(
      'client-xyz',
      { ignoreWindowUndefined: true },
    );

    await client.initializeAsync();
    // flush interval is setup
    // @ts-ignore
    expect(client._logger._flushInterval).not.toBeNull();

    // initialized from network (fetch mock)
    expect(client.checkGate(user, 'test_gate')).toBe(false);
    expect(client.checkGate(user, 'i_dont_exist')).toBe(false);
    expect(client.checkGate(user, 'always_on_gate')).toBe(true);
    expect(client.checkGate(user, 'on_for_statsig_email')).toBe(true);
    expect(client.getConfig(user, 'test_config').get('number', 10)).toEqual(7);
    expect(client.getConfig(user, 'test_config')._evaluationDetails).toEqual({
      reason: EvaluationReason.Network,
      time: expect.any(Number),
    });

    client.shutdown();
  });
});
