/**
 * @jest-environment jsdom
 */

import Statsig, { EvaluationReason } from '..';
import TestStickyAdapter from './TestStickyAdapter';
import * as TestData from './basic_config_spec.json';
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
    const vjResult = {
      ruleID: "2B3nzOtBrlt32sH5nGffRl",
      value: {
        "an_int": 12,
        "a_string": "value",
        "a_double": 3.1,
        "a_long": 10000000000000,
        "a_bool": true,
        "an_array": [],
        "an_object": {}
      }
    };

    const hunter2Result = {
      ruleID: "2B3nzQ8DTDCxlSf0YOaTan",
      value: {
        "an_int": 8,
        "a_string": "value",
        "a_double": 3.1,
        "a_long": 10000000000000,
        "a_bool": true,
        "an_array": [],
        "an_object": {}
      }
    };

    const gbResult = {
      ruleID: "layerAssignment",
      value: {
        "an_int": 99,
        "a_string": "value",
        "a_double": 3.1,
        "a_long": 10000000000000,
        "a_bool": true,
        "an_array": [],
        "an_object": {}
      }
    };

    const stickyAdapter = new TestStickyAdapter();
    const setSpy = jest.spyOn(stickyAdapter, "save")
    statsig.initialize('client-key', { initializeValues: TestData, userPersistentStorage: stickyAdapter });
    
    let vjExp = statsig.getExperiment({userID: "vj"}, 'the_allocated_experiment');
    expect(vjExp?.getValue()).toStrictEqual(vjResult.value);
    expect(vjExp?._ruleID).toStrictEqual(vjResult.ruleID);

    let hunter2Exp = statsig.getExperiment({userID: "hunter2"}, 'the_allocated_experiment');
    expect(hunter2Exp?.getValue()).toStrictEqual(hunter2Result.value);
    expect(hunter2Exp?._ruleID).toStrictEqual(hunter2Result.ruleID);

    // At this point, we have not opted in to sticky
    expect(Object.keys(stickyAdapter.store).length).toEqual(0);
    expect(setSpy).toHaveBeenCalledTimes(0);

    // these two are experiment group in an active experiment, and should get saved to local storage
    // when we call it again, we should get the same values, but not the "Persisted" evaluation reason
    // because we didnt pass in the override to the check
    vjExp = statsig.getExperiment({userID: "vj"}, 'the_allocated_experiment');
    expect(vjExp?.getValue()).toStrictEqual(vjResult.value);
    expect(vjExp?._ruleID).toStrictEqual(vjResult.ruleID);
    expect(vjExp?._evaluationDetails.reason).toStrictEqual(EvaluationReason.Bootstrap);

    // when we call it again, we should get the same values, but not the "Persisted" evaluation reason
    // because we didnt pass in the override to the check
    hunter2Exp = statsig.getExperiment({userID: "hunter2"}, 'the_allocated_experiment');
    expect(hunter2Exp?.getValue()).toStrictEqual(hunter2Result.value);
    expect(hunter2Exp?._ruleID).toStrictEqual(hunter2Result.ruleID);
    expect(hunter2Exp?._evaluationDetails.reason).toStrictEqual(EvaluationReason.Bootstrap);


    // not allocated to the experiment
    const gbExp = statsig.getExperiment({userID: "gb"}, 'the_allocated_experiment');
    expect(gbExp?.getValue()).toStrictEqual(gbResult.value);
    expect(gbExp?._ruleID).toStrictEqual(gbResult.ruleID);

    // just setting any non null value will cause sticky evaluation logic, but we should get the existing result
    vjExp = statsig.getExperiment({userID: "vj"}, 'the_allocated_experiment', { userPersistedValues: {} });
    expect(vjExp?.getValue()).toStrictEqual(vjResult.value);
    expect(vjExp?._ruleID).toStrictEqual(vjResult.ruleID);
    expect(vjExp?._evaluationDetails.reason).toStrictEqual(EvaluationReason.Bootstrap);

    const userValues = await statsig.loadUserPersistedValuesAsync({userID: "vj"}, 'userID');
    vjExp = statsig.getExperiment({userID: "vj"}, 'the_allocated_experiment', { userPersistedValues: userValues });
    expect(vjExp?.getValue()).toStrictEqual(vjResult.value);
    expect(vjExp?._ruleID).toStrictEqual(vjResult.ruleID);
    expect(vjExp?._evaluationDetails.reason).toStrictEqual(EvaluationReason.Persisted);

    // call getExperiment with a user not in the experiment, but set an override for a different user
    const explicitOverride = statsig.getExperiment({userID: "gb"}, 'the_allocated_experiment', { userPersistedValues: userValues });
    expect(explicitOverride?.getValue()).toStrictEqual(vjResult.value);
    expect(explicitOverride?._ruleID).toStrictEqual(vjResult.ruleID);
    expect(explicitOverride?._evaluationDetails.reason).toStrictEqual(EvaluationReason.Persisted);

    // load and set overrides for someone that has no overrides
    const emptyOverrides = await statsig.loadUserPersistedValuesAsync({userID: "gb"}, 'userID');
    const emptyOverridesConfig = statsig.getExperiment({userID: "gb"}, 'the_allocated_experiment', { userPersistedValues: emptyOverrides });
    expect(emptyOverridesConfig?.getValue()).toStrictEqual(gbResult.value);
    expect(emptyOverridesConfig?._ruleID).toStrictEqual(gbResult.ruleID);
    expect(emptyOverridesConfig?._evaluationDetails.reason).toStrictEqual(EvaluationReason.Bootstrap);

    hunter2Exp = statsig.getExperiment({userID: "hunter2"}, 'the_allocated_experiment', {userPersistedValues: {}});
    expect(hunter2Exp?.getValue()).toStrictEqual(hunter2Result.value);
    expect(hunter2Exp?._ruleID).toStrictEqual(hunter2Result.ruleID);

    let hunterOverrides = statsig.loadUserPersistedValues({userID: "hunter2"}, 'userID');
    hunter2Exp = statsig.getExperiment({userID: "hunter2"}, 'the_allocated_experiment', {userPersistedValues: hunterOverrides});
    expect(hunter2Exp?.getValue()).toStrictEqual(hunter2Result.value);
    expect(hunter2Exp?._ruleID).toStrictEqual(hunter2Result.ruleID);
    expect(hunter2Exp?._evaluationDetails.reason).toStrictEqual(EvaluationReason.Persisted);

    expect(setSpy).toHaveBeenCalledTimes(2);

    // try a different ID type, which wont have persisted
    hunterOverrides = statsig.loadUserPersistedValues({userID: "hunter2"}, 'stableID');
    hunter2Exp = statsig.getExperiment({userID: "hunter2"}, 'the_allocated_experiment', {userPersistedValues: hunterOverrides});
    expect(hunter2Exp?.getValue()).toStrictEqual(hunter2Result.value);
    expect(hunter2Exp?._ruleID).toStrictEqual(hunter2Result.ruleID);
    expect(hunter2Exp?._evaluationDetails.reason).toStrictEqual(EvaluationReason.Bootstrap);

    // should still only be two items in the store, and set shouldnt have been called again
    expect(Object.keys(stickyAdapter.store).length).toEqual(2);
    expect(setSpy).toHaveBeenCalledTimes(3);
  });

  test('Verify loadvalues return null when no adapter provided', async () => {
    expect.hasAssertions();
    statsig.initialize('client-key', { initializeValues: TestData });

    let nullOverrides = await statsig.loadUserPersistedValuesAsync({userID: "gb"}, 'userID');
    expect(nullOverrides).toBeNull();

    nullOverrides = statsig.loadUserPersistedValues({userID: "gb"}, 'userID');
    expect(nullOverrides).toBeNull();
  });
});
