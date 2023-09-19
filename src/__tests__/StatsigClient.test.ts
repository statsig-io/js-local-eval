/**
 * @jest-environment jsdom
 */

import StatsigClient from '../StatsigClient';
import LocalStorageMock from './LocalStorageMock';
import { DEFAULT_EVENT_LOGGING_API, DEFAULT_CONFIG_SPEC_API } from '../StatsigSDKOptions';

import { getHashValue } from '../utils/Hashing';

describe('Verify behavior of StatsigClient', () => {
  const sdkKey = 'client-clienttestkey';
  let expectedEndpoint = '';
  const baseInitResponse = {
    feature_gates: {
      [getHashValue('test_gate')]: {
        value: true,
        rule_id: 'ruleID123',
      },
    },
    dynamic_configs: {
      [getHashValue('test_config')]: {
        value: {
          num: 4,
        },
      },
    },
    has_updates: true,
    time: 123456789,
  };

  let respObject: any = baseInitResponse;

  var parsedRequestBody: {
    events: Record<string, any>[];
    statsigMetadata: Record<string, any>;
  } | null;
  // @ts-ignore
  global.fetch = jest.fn((url, params) => {
    if (!url.toString().includes('download_config_specs')) {
      if (expectedEndpoint !== url.toString()) {
        return Promise.reject(new Error('invalid initialize endpoint'));
      }
    }

    parsedRequestBody = JSON.parse(params?.body as string);
    return Promise.resolve({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(respObject)),
    });
  });

  const localStorage = new LocalStorageMock();
  // @ts-ignore
  Object.defineProperty(window, 'localStorage', {
    value: localStorage,
  });

  beforeEach(() => {
    jest.resetModules();
    parsedRequestBody = null;
    expectedEndpoint = `${DEFAULT_CONFIG_SPEC_API}download_config_specs/${sdkKey}.json`;
    window.localStorage.clear();
  });

  test('Test constructor will populate from cache on create', () => {
    expect.assertions(4);
    const client = new StatsigClient(sdkKey);
    expect(() => {
      client.checkGate({}, 'gate');
    }).not.toThrow();
    expect(() => {
      client.getConfig({}, 'config');
    }).not.toThrow();
    expect(() => {
      client.getExperiment({}, 'experiment');
    }).not.toThrow();
    expect(() => {
      client.logEvent({}, 'event');
    }).not.toThrow();
  });

  test('that overriding config spec api does not override log event', async () => {
    expect.assertions(2);
    const statsig = new StatsigClient(
      sdkKey,
      {
        configSpecAPI: 'https://statsig.jkw.com/v1/test/download_config_specs/client-123',
      },
    );
    expectedEndpoint = 'https://statsig.jkw.com/v1/test/download_config_specs/client-123';

    await statsig.initializeAsync();

    expect(statsig._options.configSpecAPI).toEqual(expectedEndpoint);
    expect(statsig._options.eventLoggingAPI).toEqual(DEFAULT_EVENT_LOGGING_API);
  });

  test('that overriding log event api does not override config spec', async () => {
    expect.assertions(2);
    const statsig = new StatsigClient(
      sdkKey,
      {
        eventLoggingAPI: 'https://statsig.jkw.com/v1',
      },
    );

    await statsig.initializeAsync();

    expect(statsig._options.configSpecAPI).toEqual(DEFAULT_CONFIG_SPEC_API);
    expect(statsig._options.eventLoggingAPI).toEqual(
      'https://statsig.jkw.com/v1',
    );
  });

  test('that overrideStableID works for local storage', async () => {
    expect.assertions(4);
    jest.useFakeTimers();
    const statsig = new StatsigClient(sdkKey);
    await statsig.initializeAsync();
    expect(statsig.getStableID()).not.toBeNull();

    const statsig2 = new StatsigClient(sdkKey, {
      overrideStableID: '123',
    });
    expect(statsig2.getStableID()).toEqual('123');

    const statsig3 = new StatsigClient(sdkKey, {
      overrideStableID: '456',
    });
    await statsig3.initializeAsync();
    expect(statsig3.getStableID()).toEqual('456');

    const statsig4 = new StatsigClient(sdkKey);
    await statsig4.initializeAsync();
    expect(statsig4.getStableID()).toEqual('456');
  });

  test('that localMode supports a dummy statsig', async () => {
    expect.assertions(3);
    parsedRequestBody = null;
    const statsig = new StatsigClient(
      sdkKey,
      {
        localMode: true,
      },
    );
    await statsig.initializeAsync();
    expect(parsedRequestBody).toBeNull(); // never issued the request

    expect(statsig.checkGate({}, 'test_gate')).toEqual(false);
    expect(statsig.getConfig({}, 'test_config').getValue()).toEqual({});
  });
});
