/**
 * @jest-environment jsdom
 */

import Statsig from '..';
import * as TestData from './basic_config_spec.json';

describe('ExposureLogging', () => {
  let events: {
    eventName: string;
    metadata: { gate?: string; config?: string; isManualExposure?: string };
  }[] = [];

  beforeEach(async () => {
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
        text: () =>
          Promise.resolve(
            JSON.stringify(TestData),
          ),
      });
    });

    events = [];

    // @ts-ignore
    Statsig.instance = null;
    await Statsig.initializeAsync(
      'client-key',
      { initTimeoutMs: 1 },
    );

    // @ts-ignore
    Statsig.instance._options.loggingBufferMaxSize = 1;
  });

  afterEach(() => {
    Statsig.shutdown();
  });

  describe('standard use', () => {
    it('logs gate exposures', async () => {
      Statsig.checkGate({}, 'a_gate');
      expect(events.length).toBe(1);
      expect(events[0].metadata.gate).toEqual('a_gate');
      expect(events[0].metadata.isManualExposure).toBeUndefined();
      expect(events[0].eventName).toEqual('statsig::gate_exposure');
    });

    it('logs config exposures', async () => {
      Statsig.getConfig({}, 'a_config');
      expect(events.length).toBe(1);
      expect(events[0].metadata.config).toEqual('a_config');
      expect(events[0].metadata.isManualExposure).toBeUndefined();
      expect(events[0].eventName).toEqual('statsig::config_exposure');
    });

    it('logs experiment exposures', async () => {
      Statsig.getExperiment({}, 'an_experiment');
      expect(events.length).toBe(1);
      expect(events[0].metadata.config).toEqual('an_experiment');
      expect(events[0].metadata.isManualExposure).toBeUndefined();
      expect(events[0].eventName).toEqual('statsig::config_exposure');
    });

    it('logs layer exposures', async () => {
      const layer = Statsig.getLayer({}, 'layer');
      layer.get('a_string', "default");
      expect(events.length).toBe(1);
      expect(events[0].metadata.config).toEqual('layer');
      expect(events[0].metadata.isManualExposure).toBeUndefined();
      expect(events[0].eventName).toEqual('statsig::layer_exposure');
    });
  });
});
