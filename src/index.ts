import DynamicConfig from './DynamicConfig';
import Layer from './Layer';
import StatsigClient, {
  CheckGateOptions,
  GetExperimentOptions,
  GetLayerOptions,
  InitializeResult,
} from './StatsigClient';
import { SynchronousStatsigOptions, StatsigOptions } from './StatsigSDKOptions';
import { EvaluationDetails, EvaluationReason } from './EvaluationMetadata';
import { StatsigUser } from './StatsigUser';
import { UserPersistedValues } from './utils/StickyValuesStorage';

export { default as DynamicConfig } from './DynamicConfig';
export { StatsigEnvironment, StatsigOptions } from './StatsigSDKOptions';
export { EvaluationReason } from './EvaluationMetadata';
export type { EvaluationDetails } from './EvaluationMetadata';
export { StatsigUser } from './StatsigUser';
export type {
  CheckGateOptions,
  GetExperimentOptions,
  GetLayerOptions,
  InitializeResult,
  UserPersistedValues,
};

export default class Statsig {
  private static instance: StatsigClient | null = null;

  public static async initializeAsync(
    sdkKey: string,
    options?: StatsigOptions | null,
  ): Promise<InitializeResult> {
    const inst = Statsig.instance ?? new StatsigClient(sdkKey, options);

    if (!Statsig.instance) {
      Statsig.instance = inst;
    }

    return inst.initializeAsync();
  }

  public static initialize(
    sdkKey: string,
    options: SynchronousStatsigOptions,
  ): InitializeResult {
    const inst = Statsig.instance ?? new StatsigClient(sdkKey, options);

    if (!Statsig.instance) {
      Statsig.instance = inst;
    }
    return inst.initialize(options.initializeValues);
  }

  // Gate

  public static checkGate(
    user: StatsigUser,
    gateName: string,
    options?: CheckGateOptions,
  ): boolean {
    return Statsig.instance?.checkGate(user, gateName, options) ?? false;
  }

  public static manuallyLogGateExposure(user: StatsigUser, gateName: string) {
    Statsig.instance?.logGateExposure(user, gateName);
  }

  // Config
  public static getConfig(
    user: StatsigUser,
    configName: string,
  ): DynamicConfig {
    return (
      Statsig.instance?.getConfig(user, configName) ??
      new DynamicConfig(configName, {}, '', null, this.getEvaluationDetails())
    );
  }

  public static manuallyLogConfigExposure(
    user: StatsigUser,
    configName: string,
  ) {
    Statsig.instance?.logConfigExposure(user, configName);
  }

  // Experiment
  public static getExperiment(
    user: StatsigUser,
    experimentName: string,
    options?: GetExperimentOptions,
  ): DynamicConfig {
    return (
      Statsig.instance?.getExperiment(user, experimentName, options) ??
      new DynamicConfig(experimentName, {}, '', null, this.getEvaluationDetails())
    );
  }

  public static manuallyLogExperimentExposure(
    user: StatsigUser,
    configName: string,
  ) {
    Statsig.instance?.logExperimentExposure(user, configName);
  }

  public static loadUserPersistedValues(
    user: StatsigUser,
    idType: string,
  ): UserPersistedValues {
    return Statsig.instance?.loadUserPersistedValues(user, idType) ?? {};
  }

  public static async loadUserPersistedValuesAsync(
    user: StatsigUser,
    idType: string,
  ): Promise<UserPersistedValues> {
    return (
      (await Statsig.instance?.loadUserPersistedValuesAsync(user, idType)) ?? {}
    );
  }

  // Layer
  public static getLayer(
    user: StatsigUser,
    layerName: string,
    options?: GetLayerOptions,
  ): Layer {
    return (
      Statsig.instance?.getLayer(user, layerName, options) ??
      Layer._create(user, layerName, {}, '', this.getEvaluationDetails())
    );
  }

  public static manuallyLogLayerParameterExposure(
    user: StatsigUser,
    layerName: string,
    parameterName: string,
  ) {
    Statsig.instance?.logLayerParameterExposure(user, layerName, parameterName);
  }

  public static logEvent(
    user: StatsigUser,
    eventName: string,
    value: string | number | null = null,
    metadata: Record<string, string> | null = null,
  ): void {
    return Statsig.instance?.logEvent(user, eventName, value, metadata);
  }

  public static shutdown() {
    Statsig.instance?.shutdown();
    Statsig.instance = null;
  }

  /**
   * @returns The Statsig stable ID used for device level experiments
   */
  public static getStableID(): string {
    return Statsig.instance?.getStableID() ?? '';
  }

  /**
   *
   * @returns The reason and time associated with the evaluation for the current set
   * of gates and configs
   */
  public static getEvaluationDetails(): EvaluationDetails {
    return (
      Statsig.instance?.getEvaluationDetails() ?? {
        reason: EvaluationReason.Uninitialized,
        time: 0,
      }
    );
  }

  /**
   *
   * @returns true if initialize has already been called, false otherwise
   */
  public static initializeCalled(): boolean {
    return Statsig.instance != null && Statsig.instance.initializeCalled();
  }
}
