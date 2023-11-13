/**
 * @jest-environment jsdom
 */

import Statsig, { EvaluationReason } from '..';
import TestStickyAdapter from './TestStickyAdapter';
import * as FirstBootstrap from './data/download_config_specs_sticky_experiments.json';
import * as SecondBootstrap from './data/download_config_specs_sticky_experiments_inactive.json';
let statsig: typeof Statsig;

export type StatsigInitializeResponse = {
  feature_gates: Record<string, any>;
  dynamic_configs: Record<string, any>;
  layer_configs: Record<string, any>;
  sdkParams: Record<string, any>;
  has_updates: boolean;
  time: number;
};

describe('Verify e2e behavior of UserPersistedValues functions', () => {
  // @ts-ignore
  global.fetch = jest.fn((url, params) => {});

  beforeEach(() => {
    jest.resetModules();
    statsig = require('../index').default;
    expect.hasAssertions();

    // ensure Date.now() returns the same value in each test
    let now = Date.now();
    jest.spyOn(global.Date, 'now').mockImplementation(() => now);
  });

  test('Verify sticky caches results for test or control group users ', async () => {
    expect.hasAssertions();
    const userInControl = { userID: 'vj' };
    const userInTest = { userID: 'hunter2' };
    const userNotInExp = { userID: 'gb' };
    const ControlResult = {
      ruleID: '2B3nzOtBrlt32sH5nGffRl',
      value: {
        an_int: 12,
        a_string: 'value',
        a_double: 3.1,
        a_long: 10000000000000,
        a_bool: true,
        an_array: [],
        an_object: {},
      },
    };

    const TestResult = {
      ruleID: '2B3nzQ8DTDCxlSf0YOaTan',
      value: {
        an_int: 8,
        a_string: 'value',
        a_double: 3.1,
        a_long: 10000000000000,
        a_bool: true,
        an_array: [],
        an_object: {},
      },
    };

    const UnallocatedResult = {
      ruleID: 'layerAssignment',
      value: {
        an_int: 99,
        a_string: 'value',
        a_double: 3.1,
        a_long: 10000000000000,
        a_bool: true,
        an_array: [],
        an_object: {},
      },
    };

    const stickyAdapter = new TestStickyAdapter();
    const setSpy = jest.spyOn(stickyAdapter, 'save');
    statsig.initialize('client-key', {
      initializeValues: FirstBootstrap,
      userPersistentStorage: stickyAdapter,
    });

    // Control
    let exp = statsig.getExperiment(userInControl, 'the_allocated_experiment');
    expect(exp?.getValue()).toStrictEqual(ControlResult.value);
    expect(exp?._ruleID).toStrictEqual(ControlResult.ruleID);

    // Test
    exp = statsig.getExperiment(userInTest, 'the_allocated_experiment');
    expect(exp?.getValue()).toStrictEqual(TestResult.value);
    expect(exp?._ruleID).toStrictEqual(TestResult.ruleID);

    // Not allocated to the experiment
    exp = statsig.getExperiment(userNotInExp, 'the_allocated_experiment');
    expect(exp?.getValue()).toStrictEqual(UnallocatedResult.value);
    expect(exp?._ruleID).toStrictEqual(UnallocatedResult.ruleID);

    // At this point, we have not opted in to sticky
    expect(Object.keys(stickyAdapter.store).length).toEqual(0);
    expect(setSpy).toHaveBeenCalledTimes(0);

    // Control group with persisted storage enabled
    // (should save to storage, but evaluate as normal until next call)
    let userPersistedValues = await statsig.loadUserPersistedValuesAsync(
      userInControl,
      'userID',
    );
    exp = statsig.getExperiment(userInControl, 'the_allocated_experiment', {
      userPersistedValues,
    });
    expect(exp?.getValue()).toStrictEqual(ControlResult.value);
    expect(exp?._ruleID).toStrictEqual(ControlResult.ruleID);
    expect(exp?._evaluationDetails.reason).toStrictEqual(
      EvaluationReason.Bootstrap,
    );

    // Test group with persisted storage enabled
    // (should save to storage, but evaluate as normal until next call)
    userPersistedValues = statsig.loadUserPersistedValues(userInTest, 'userID');
    exp = statsig.getExperiment(userInTest, 'the_allocated_experiment', {
      userPersistedValues,
    });
    expect(exp?.getValue()).toStrictEqual(TestResult.value);
    expect(exp?._ruleID).toStrictEqual(TestResult.ruleID);
    expect(exp?._evaluationDetails.reason).toStrictEqual(
      EvaluationReason.Bootstrap,
    );

    // Verify that persistent storage has been updated
    expect(Object.keys(stickyAdapter.store).length).toEqual(2);
    expect(setSpy).toHaveBeenCalledTimes(2);

    // Control group with persisted storage enabled
    // (persistent storage now has the values for user in control group)
    userPersistedValues = await statsig.loadUserPersistedValuesAsync(
      userInControl,
      'userID',
    );
    exp = statsig.getExperiment(userInControl, 'the_allocated_experiment', {
      userPersistedValues,
    });
    expect(exp?.getValue()).toStrictEqual(ControlResult.value);
    expect(exp?._ruleID).toStrictEqual(ControlResult.ruleID);
    expect(exp?._evaluationDetails.reason).toStrictEqual(
      EvaluationReason.Persisted,
    );

    // Test group with persisted storage enabled
    // (persistent storage now has the values for user in test group)
    userPersistedValues = statsig.loadUserPersistedValues(userInTest, 'userID');
    exp = statsig.getExperiment(userInTest, 'the_allocated_experiment', {
      userPersistedValues,
    });
    expect(exp?.getValue()).toStrictEqual(TestResult.value);
    expect(exp?._ruleID).toStrictEqual(TestResult.ruleID);
    expect(exp?._evaluationDetails.reason).toStrictEqual(
      EvaluationReason.Persisted,
    );

    // call getExperiment with a user not in the experiment, but set an override for a different user
    exp = statsig.getExperiment(userNotInExp, 'the_allocated_experiment', {
      userPersistedValues,
    });
    expect(exp?.getValue()).toStrictEqual(TestResult.value);
    expect(exp?._ruleID).toStrictEqual(TestResult.ruleID);
    expect(exp?._evaluationDetails.reason).toStrictEqual(
      EvaluationReason.Persisted,
    );

    // load and set overrides for someone that has no overrides
    userPersistedValues = await statsig.loadUserPersistedValuesAsync(
      userNotInExp,
      'userID',
    );
    exp = statsig.getExperiment(userNotInExp, 'the_allocated_experiment', {
      userPersistedValues,
    });
    expect(exp?.getValue()).toStrictEqual(UnallocatedResult.value);
    expect(exp?._ruleID).toStrictEqual(UnallocatedResult.ruleID);
    expect(exp?._evaluationDetails.reason).toStrictEqual(
      EvaluationReason.Bootstrap,
    );

    // try a different ID type, which wont have persisted
    userPersistedValues = statsig.loadUserPersistedValues(
      userInTest,
      'stableID',
    );
    exp = statsig.getExperiment(userInTest, 'the_allocated_experiment', {
      userPersistedValues,
    });
    expect(exp?.getValue()).toStrictEqual(TestResult.value);
    expect(exp?._ruleID).toStrictEqual(TestResult.ruleID);
    expect(exp?._evaluationDetails.reason).toStrictEqual(
      EvaluationReason.Bootstrap,
    );

    // should still only be two items in the store, and set shouldnt have been called again
    expect(Object.keys(stickyAdapter.store).length).toEqual(2);
    expect(setSpy).toHaveBeenCalledTimes(3);

    // verify that persisted values are deleted once the experiment is no longer active
    statsig.shutdown();
    statsig.initialize('client-key', {
      initializeValues: SecondBootstrap,
      userPersistentStorage: stickyAdapter,
    });
    userPersistedValues = statsig.loadUserPersistedValues(
      userInControl,
      'userID',
    );
    exp = statsig.getExperiment(
      userInControl,
      'another_allocated_experiment_still_active',
      {
        userPersistedValues,
      },
    );
    expect(exp?.getValue()).toStrictEqual(ControlResult.value);
    expect(exp?._ruleID).toStrictEqual(ControlResult.ruleID);
    expect(exp?._evaluationDetails.reason).toStrictEqual(
      EvaluationReason.Bootstrap,
    );
    expect(
      JSON.parse(stickyAdapter.store['vj:userID'])['the_allocated_experiment'],
    ).not.toBeUndefined();
    expect(
      JSON.parse(stickyAdapter.store['vj:userID'])[
        'another_allocated_experiment_still_active'
      ],
    ).not.toBeUndefined();

    userPersistedValues = statsig.loadUserPersistedValues(
      userInControl,
      'userID',
    );
    exp = statsig.getExperiment(userInControl, 'the_allocated_experiment', {
      userPersistedValues,
    });
    expect(exp?.getValue()).toStrictEqual(ControlResult.value);
    expect(exp?._ruleID).toStrictEqual(ControlResult.ruleID);
    expect(exp?._evaluationDetails.reason).toStrictEqual(
      EvaluationReason.Bootstrap,
    );
    expect(
      JSON.parse(stickyAdapter.store['vj:userID'])['the_allocated_experiment'],
    ).toBeUndefined();
    expect(
      JSON.parse(stickyAdapter.store['vj:userID'])[
        'another_allocated_experiment_still_active'
      ],
    ).not.toBeUndefined();

    // verify that persisted values are deleted once an experiment is evaluated without persisted values (opted-out)
    userPersistedValues = statsig.loadUserPersistedValues(userInTest, 'userID');
    exp = statsig.getExperiment(userInTest, 'the_allocated_experiment');
    expect(exp?.getValue()).toStrictEqual(TestResult.value);
    expect(exp?._ruleID).toStrictEqual(TestResult.ruleID);
    expect(exp?._evaluationDetails.reason).toStrictEqual(
      EvaluationReason.Bootstrap,
    );
    expect(
      JSON.parse(stickyAdapter.store['hunter2:userID'])[
        'the_allocated_experiment'
      ],
    ).toBeUndefined();
  });

  test('Verify loadvalues return null when no adapter provided', async () => {
    expect.hasAssertions();
    statsig.initialize('client-key', { initializeValues: FirstBootstrap });

    let emptyOverrides = await statsig.loadUserPersistedValuesAsync(
      { userID: 'gb' },
      'userID',
    );
    expect(emptyOverrides).toMatchObject({});

    emptyOverrides = statsig.loadUserPersistedValues(
      { userID: 'gb' },
      'userID',
    );
    expect(emptyOverrides).toMatchObject({});
  });
});
