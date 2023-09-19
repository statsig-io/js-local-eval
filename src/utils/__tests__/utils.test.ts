/**
 * @jest-environment jsdom
 */

import StatsigLocalStorage from '../StatsigLocalStorage';

describe('Verify behavior of core utility functions', () => {
  beforeEach(() => {
    expect.hasAssertions();
  });

  test('Test local storage is the same across multiple gets', () => {
    expect.assertions(3);
    expect(
      StatsigLocalStorage.getItem('STATSIG_LOCAL_STORAGE_STABLE_ID'),
    ).toBeNull();
    StatsigLocalStorage.setItem('STATSIG_LOCAL_STORAGE_STABLE_ID', '123');
    expect(
      StatsigLocalStorage.getItem('STATSIG_LOCAL_STORAGE_STABLE_ID'),
    ).toEqual('123');
    StatsigLocalStorage.setItem('UNRELATED_ITEM', 'ABC');
    expect(
      StatsigLocalStorage.getItem('STATSIG_LOCAL_STORAGE_STABLE_ID'),
    ).toEqual('123');
  });
});
