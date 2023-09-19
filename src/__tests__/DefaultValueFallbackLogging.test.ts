/**
 * @jest-environment jsdom
 */

import Statsig, { DynamicConfig, StatsigUser } from '..';
import * as TestData from './other_config_spec.json';

const user: StatsigUser = {
  userID: 'a-user',
};

describe('On Default Value Fallback', () => {
  let events: {
    eventName: string;
    time: number;
    metadata: { gate?: string; config?: string; isManualExposure?: string };
  }[] = [];
  let config: DynamicConfig;

  beforeAll(async () => {
    // @ts-ignore
    global.fetch = jest.fn((url, params) => {
      if (url.toString().includes('rgstr')) {
        const newEvents: typeof events = JSON.parse(params?.body as string)[
          'events'
        ];
        events.push(...newEvents);
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify(TestData)),
      });
    });
  });

  beforeEach(async () => {
    // @ts-ignore
    Statsig.instance = null;
    await Statsig.initializeAsync('client-key');

    // @ts-ignore
    Statsig.instance._options.loggingBufferMaxSize = 1;
    config = Statsig.getConfig(user, 'test_config');
    events = [];
  });

  it('logs an event when falling back to default value', async () => {
    expect(config.get('number', 'a_string')).toEqual('a_string');
    Statsig.shutdown();
    expect(events.length).toBe(1);

    const event = events[0];
    expect(event).toMatchObject({
      eventName: 'statsig::default_value_type_mismatch',
      metadata: {
        defaultValueType: 'string',
        name: 'test_config',
        parameter: 'number',
        ruleID: 'default',
        valueType: 'number',
      },
    });
  });

  it('logs an event when the typeguard fails', async () => {
    config.get('boolean', 'a_string', (_v): _v is string => false);
    Statsig.shutdown();
    expect(events.length).toBe(1);

    const event = events[0];
    expect(event).toMatchObject({
      eventName: 'statsig::default_value_type_mismatch',
      metadata: {
        defaultValueType: 'string',
        name: 'test_config',
        parameter: 'boolean',
        ruleID: 'default',
        valueType: 'boolean',
      },
    });
  });

  it('does not log when returning the correct value', async () => {
    config.get('number', 0);
    Statsig.shutdown();
    expect(events.length).toBe(0);
  });

  it('does not log when type guard succeeds', async () => {
    config.get('number', 0, (_v): _v is number => true);
    Statsig.shutdown();
    expect(events.length).toBe(0);
  });
});
