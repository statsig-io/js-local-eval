/**
 * @jest-environment jsdom
 */

import StatsigClient from '../StatsigClient';
import { STATSIG_STABLE_ID_KEY } from '../utils/Constants';
import StatsigLocalStorage from '../utils/StatsigLocalStorage';

const GUID_REGEX =
  /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-4[0-9A-Fa-f]{3}-[89ABab][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}/; // uuid 4 formats

describe('Verify local storage limits are enforced', () => {
  class LocalStorageMock {
    public store: Record<string, string>;
    constructor() {
      this.store = {};
    }

    clear() {
      this.store = {};
    }

    getItem(key: string) {
      throw new Error('SecurityException');
    }

    setItem(key: string, value: string) {
      throw new Error('SecurityException');
    }

    removeItem(key: string) {
      throw new Error('SecurityException');
    }
  }

  const localStorage = new LocalStorageMock();
  // @ts-ignore
  Object.defineProperty(window, 'localStorage', {
    value: localStorage,
  });

  // @ts-ignore
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      text: () => Promise.resolve('{}'),
    }),
  );

  beforeEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
    localStorage.clear();
  });

  test('Verify if local storage is disabled, session storage backs it up', () => {
    expect.assertions(8);
    const client = new StatsigClient('client-test', null);

    return client.initializeAsync().then(() => {
      expect(() => {
        localStorage.getItem('any');
      }).toThrowError('SecurityException');
      const stable_id = StatsigLocalStorage.getItem(STATSIG_STABLE_ID_KEY);
      expect(stable_id).toMatch(GUID_REGEX);

      expect(() => {
        StatsigLocalStorage.removeItem('I_DONT_EXIST');
      }).not.toThrow();
      expect(StatsigLocalStorage.getItem('I_DONT_EXIST')).toBeNull();
      expect(() => {
        StatsigLocalStorage.setItem('I_DONT_EXIST', 'testing');
      }).not.toThrow();
      expect(StatsigLocalStorage.getItem('I_DONT_EXIST')).toEqual('testing');
      expect(() => {
        StatsigLocalStorage.removeItem('I_DONT_EXIST');
      }).not.toThrow();
      expect(StatsigLocalStorage.getItem('I_DONT_EXIST')).toBeNull();
    });
  });
});
