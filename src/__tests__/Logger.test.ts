/**
 * @jest-environment jsdom
 */

import 'core-js';

import LogEvent from '../LogEvent';
import StatsigClient from '../StatsigClient';
import StatsigLogger from '../StatsigLogger';
import makeLogEvent from '../LogEvent';

describe('Verify behavior of StatsigLogger', () => {
  const sdkKey = 'client-loggertestkey';
  const waitAllPromises = () => new Promise(setImmediate);
  //@ts-ignore
  global.fetch = jest.fn((url) => {
    if (url && typeof url === 'string' && url.includes('rgstr')) {
      if (url !== 'https://events.statsigapi.net/v1/rgstr') {
        fail('invalid logevent endpoint');
      }
      return Promise.resolve({
        ok: false,
        text: () => 'error',
      });
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            gates: {},
            feature_gates: {
              '3114454104': {
                value: true,
                rule_id: 'ruleID123',
              },
            },
            dynamic_configs: {
              '3591394191': {
                value: { bool: true },
                rule_id: 'default',
              },
            },
            configs: {},
          }),
        ),
    });
  });
  beforeEach(() => {
    expect.hasAssertions();
  });

  test('Test constructor', () => {
    expect.assertions(11);
    const user = { userID: 'user_key' };
    const client = new StatsigClient(sdkKey);
    const logger = client._logger;
    const spyOnFlush = jest.spyOn(logger, 'flush');
    const spyOnLog = jest.spyOn(logger, 'log');

    // @ts-ignore
    expect(client._logger._flushInterval).not.toBeNull();

    // @ts-ignore trust me, the method exists
    const spyOnFailureLog = jest.spyOn(logger, '_newFailedRequest');
    const spyOnErrorBoundary = jest.spyOn(client._errorBoundary, '_logError');

    const makeSimpleLogEvent = (name: string) =>
      makeLogEvent(name, {}, client._identity._statsigMetadata, null, null);

    return client.initializeAsync().then(async () => {
      logger.log(makeSimpleLogEvent('event'));
      logger.log(makeSimpleLogEvent('event'));
      logger.log(makeSimpleLogEvent('event'));
      client.checkGate(user, 'test_gate');
      client.checkGate(user, 'test_gate');
      client.checkGate(user, 'test_gate');
      logger.log(makeSimpleLogEvent('event'));
      client.getExperiment(user, 'test_config');
      client.getExperiment(user, 'test_config');
      client.getExperiment(user, 'test_config');
      expect(spyOnLog).toHaveBeenCalledTimes(6);
      client.getExperiment(user, 'test_config');
      for (var i = 0; i < 95; i++) {
        logger.log(makeSimpleLogEvent('event'));
      }
      expect(spyOnFlush).toHaveBeenCalledTimes(1);
      expect(spyOnLog).toHaveBeenCalledTimes(101);
      await waitAllPromises();
      // posting logs network request fails, causing a log event failure
      expect(spyOnErrorBoundary).toHaveBeenCalledTimes(1);
      expect(spyOnLog).toHaveBeenCalledTimes(101);
      expect(spyOnFailureLog).toHaveBeenCalledTimes(1);
      // manually flush again, failing again
      logger.flush();
      await waitAllPromises();
      // we dont log to the logger, but we do log to error boundary
      expect(spyOnLog).toHaveBeenCalledTimes(101);
      expect(spyOnErrorBoundary).toHaveBeenCalledTimes(2);

      const elevenminslater = Date.now() + 11 * 60 * 1000;
      jest.spyOn(global.Date, 'now').mockImplementation(() => elevenminslater);

      client.checkGate(user, 'test_gate');
      client.checkGate(user, 'test_gate');
      client.getExperiment(user, 'test_config');
      client.getExperiment(user, 'test_config');
      expect(spyOnLog).toHaveBeenCalledTimes(103);

      // treats changing customids as unique exposures
      client.checkGate({...user, customIDs: {test: "456"}}, 'test_gate');
      client.checkGate({...user, customIDs: {test: "123"}}, 'test_gate');
      client.getExperiment({...user, customIDs: {test: "456"}}, 'test_config');
      client.getExperiment({...user, customIDs: {test: "123"}}, 'test_config');
      expect(spyOnLog).toHaveBeenCalledTimes(107);
    });
  });

  test('Test local mode does not set up a flush interval', () => {
    expect.assertions(1);
    const client = new StatsigClient(
      sdkKey,
      { localMode: true },
    );

    // @ts-ignore
    expect(client._logger._flushInterval).toBeNull();
  });

  describe('window/document event handling', () => {
    let logger: StatsigLogger;
    let spy: jest.SpyInstance;

    beforeEach(() => {
      jest.useFakeTimers();
      const client = new StatsigClient(sdkKey);
      logger = client._logger;
      spy = jest.spyOn(logger, 'flush');
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('flushes quickly on init', () => {
      expect(spy).not.toHaveBeenCalled();
      jest.advanceTimersByTime(101);
      expect(spy).toHaveBeenCalledWith();

      jest.clearAllMocks();
      expect(spy).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1001);
      expect(spy).toHaveBeenCalledWith();
    });

    it('flushes on page load', () => {
      jest.advanceTimersByTime(2000);
      jest.clearAllMocks();

      window.dispatchEvent(new Event('load'));

      expect(spy).not.toHaveBeenCalled();
      jest.advanceTimersByTime(101);
      expect(spy).toHaveBeenCalledWith();

      jest.clearAllMocks();
      expect(spy).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1001);
      expect(spy).toHaveBeenCalledWith();
    });

    it('flushes on page beforeunload', () => {
      expect(spy).not.toHaveBeenCalled();
      window.dispatchEvent(new Event('beforeunload'));
      expect(spy).toHaveBeenCalledWith(true);
    });

    it('flushes on page blur', () => {
      expect(spy).not.toHaveBeenCalled();
      window.dispatchEvent(new Event('blur'));
      expect(spy).toHaveBeenCalledWith(true);
    });

    it('flushes on visibilitychange hidden', () => {
      expect(spy).not.toHaveBeenCalled();
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true,
      });
      Object.defineProperty(document, 'hidden', {
        value: true,
        writable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
      expect(spy).toHaveBeenCalledWith(true);
    });

    it('flushes on visibilitychange visible', () => {
      expect(spy).not.toHaveBeenCalled();
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
      });
      Object.defineProperty(document, 'hidden', {
        value: false,
        writable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
      expect(spy).toHaveBeenCalledWith(false);
    });
  });
});
