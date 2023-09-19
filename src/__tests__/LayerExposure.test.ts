/**
 * @jest-environment jsdom
 */

import Statsig from '../index';
import { EvaluationReason } from '../EvaluationMetadata';
import * as TestData from './basic_config_spec.json';

type Indexable = {
  [key: string]: (_arg0: string, _arg1: any) => any;
};

describe('Layer Exposure Logging', () => {
  let response = TestData;
  var logs: {
    events: Record<string, any>[];
  };

  beforeAll(async () => {
    // @ts-ignore
    global.fetch = jest.fn((url, params) => {
      if (url.toString().includes('rgstr')) {
        logs = JSON.parse(params?.body as string);
        return Promise.resolve({ ok: true, text: () => Promise.resolve('{}') });
      }

      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(TestData)),
      });
    });
  });

  beforeEach(() => {
    logs = {
      events: [],
    };
    response = TestData;
  });

  it('does not log on invalid types', async () => {
    // @ts-ignore
    response.layer_configs[0].defaultValue = {
      an_int: 99,
    };

    await Statsig.initializeAsync('client-key');

    let layer = Statsig.getLayer({}, 'layer');
    layer.get('an_int', '');
    Statsig.shutdown();

    expect(logs).toEqual({
      events: [],
    });
  });

  describe.each([['getValue'], ['get']])('with method "%s"', (method) => {
    it('does not log a non-existent key', async () => {
      await Statsig.initializeAsync('client-key', null);

      let layer = Statsig.getLayer(
        { userID: 'tore' },
        'layer',
      ) as unknown as Indexable;
      layer[method]('a_nonexistant_key', 0);
      Statsig.shutdown();

      expect(logs).toEqual({
        events: [],
      });
    });

    it('logs layers without an allocated experiment correctly', async () => {
      await Statsig.initializeAsync('client-key');

      let layer = Statsig.getLayer(
        { userID: 'xin' },
        'layer',
      ) as unknown as Indexable;
      expect(layer[method]('an_int', 0)).toEqual(8);
      Statsig.shutdown();

      expect(logs['events'].length).toEqual(1);

      expect(logs['events'][0]).toEqual(
        expect.objectContaining({
          eventName: 'statsig::layer_exposure',
          metadata: {
            config: 'layer',
            ruleID: '2B3nzQ8DTDCxlSf0YOaTan',
            allocatedExperiment: 'the_allocated_experiment',
            parameterName: 'an_int',
            isExplicitParameter: 'true',
            reason: EvaluationReason.Network,
            time: expect.any(Number),
          },
          secondaryExposures: [],
        }),
      );
    });

    it('logs explicit and implicit parameters correctly', async () => {
      await Statsig.initializeAsync('client-key');

      let layer = Statsig.getLayer(
        { userID: 'xin', email: 'support@statsig.com' },
        'layer',
      ) as unknown as Indexable;
      layer[method]('an_int', 0);
      layer[method]('a_string', '');
      Statsig.shutdown();

      expect(logs['events'].length).toEqual(2);
      expect(logs['events'][0]).toEqual(
        expect.objectContaining({
          user: expect.objectContaining({
            userID: 'xin',
            email: 'support@statsig.com',
          }),
          metadata: {
            config: 'layer',
            ruleID: '2B3nzQ8DTDCxlSf0YOaTan',
            allocatedExperiment: 'the_allocated_experiment',
            parameterName: 'an_int',
            isExplicitParameter: 'true',
            reason: EvaluationReason.Network,
            time: expect.any(Number),
          },
          secondaryExposures: [],
        }),
      );

      expect(logs['events'][1]).toEqual(
        expect.objectContaining({
          metadata: {
            config: 'layer',
            ruleID: '2B3nzQ8DTDCxlSf0YOaTan',
            allocatedExperiment: '',
            parameterName: 'a_string',
            isExplicitParameter: 'false',
            reason: EvaluationReason.Network,
            time: expect.any(Number),
          },
          secondaryExposures: [],
        }),
      );
    });

    it('logs different object types correctly', async () => {
      response.layer_configs[0].defaultValue = {
        // @ts-ignore
        a_bool: true,
        an_int: 99,
        a_double: 1.23,
        a_long: 1,
        a_string: 'value',
        // @ts-ignore
        an_array: ['a', 'b'],
        an_object: { key: 'value' },
      };

      await Statsig.initializeAsync('client-key', null);

      let layer = Statsig.getLayer(
        { userID: 'tore' },
        'layer',
      ) as unknown as Indexable;
      layer[method]('a_bool', false);
      layer[method]('an_int', 0);
      layer[method]('a_double', 0.0);
      layer[method]('a_long', 0);
      layer[method]('a_string', '');
      layer[method]('an_array', []);
      layer[method]('an_object', {});
      Statsig.shutdown();

      expect(logs['events'].length).toEqual(7);

      expect(logs['events'][0]['metadata']['parameterName']).toEqual('a_bool');
      expect(logs['events'][1]['metadata']['parameterName']).toEqual('an_int');
      expect(logs['events'][2]['metadata']['parameterName']).toEqual(
        'a_double',
      );
      expect(logs['events'][3]['metadata']['parameterName']).toEqual('a_long');
      expect(logs['events'][4]['metadata']['parameterName']).toEqual(
        'a_string',
      );
      expect(logs['events'][5]['metadata']['parameterName']).toEqual(
        'an_array',
      );
      expect(logs['events'][6]['metadata']['parameterName']).toEqual(
        'an_object',
      );
    });

    it('does not log when shutdown', async () => {
      await Statsig.initializeAsync('client-key', null);

      let layer = Statsig.getLayer(
        { userID: 'xin' },
        'layer',
      ) as unknown as Indexable;
      Statsig.shutdown();

      layer[method]('an_int', 77);

      expect(logs).toEqual({
        events: [],
      });
    });
  });
});
