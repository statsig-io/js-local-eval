import DynamicConfig, { OnDefaultValueFallback } from './DynamicConfig';
import ErrorBoundary from './ErrorBoundary';
import Layer, { LogParameterFunction } from './Layer';
import StatsigIdentity from './StatsigIdentity';
import StatsigLogger from './StatsigLogger';
import StatsigNetwork from './StatsigNetwork';
import StatsigSDKOptions, { StatsigOptions } from './StatsigSDKOptions';
import { EvaluationDetails, EvaluationReason } from './EvaluationMetadata';
import { StatsigUser } from './StatsigUser';
import StatsigLocalStorage from './utils/StatsigLocalStorage';
import makeLogEvent from './LogEvent';
import ConfigEvaluation from './ConfigEvaluation';
import Evaluator from './Evaluator';
import StickyValuesStorage from './utils/StickyValuesStorage';

export type CheckGateOptions = {
  disableExposureLogging: boolean;
};

export type GetExperimentOptions = {
  disableExposureLogging?: boolean;
  userPersistedValues?: Record<string, unknown> | null;
};

export type GetLayerOptions = {
  disableExposureLogging: boolean;
};

export type InitializeResult = {
  success: boolean,
  message?: string,
}

export default class StatsigClient {
  private _ready: boolean;
  private _initCalled: boolean = false;
  private _pendingInitPromise: Promise<InitializeResult> | null = null;

  readonly _identity: StatsigIdentity;
  readonly _errorBoundary: ErrorBoundary;
  readonly _network: StatsigNetwork;
  readonly _evaluator: Evaluator;
  readonly _logger: StatsigLogger;
  readonly _options: StatsigSDKOptions;

  public constructor(sdkKey: string, options?: StatsigOptions | null) {
    if (options?.localMode !== true && typeof sdkKey !== 'string') {
      console.error(
        'Invalid key provided. You must use a Client SDK Key from the Statsig console to initialize the sdk',
      );
    }
    this._errorBoundary = new ErrorBoundary(sdkKey);
    this._ready = false;
    this._options = new StatsigSDKOptions(options);
    StatsigLocalStorage.disabled = this._options.disableLocalStorage;
    StickyValuesStorage.storageInterface = this._options.userPersistentStorage;
    this._identity = new StatsigIdentity(
      sdkKey,
      this._options.overrideStableID,
    );
    this._errorBoundary._setStatsigMetadata(this._identity._statsigMetadata);
    this._network = new StatsigNetwork(
      this._options,
      this._identity,
      this._errorBoundary,
    );
    this._logger = new StatsigLogger(
      this._options,
      this._identity,
      this._network,
      this._errorBoundary,
    );
    this._evaluator = new Evaluator(this._options);
    
    if (this._options.initializeValues != null) {
      this._delayedSetup();
    }
  }

  public async initializeAsync(): Promise<InitializeResult> {
    return this._errorBoundary._capture<Promise<InitializeResult>>(
      'initializeAsync',
      async () => {
        if (this._pendingInitPromise != null) {
          return this._pendingInitPromise;
        }
        if (this._ready) {
          return Promise.resolve({success: true, message: "Client is already initialized."});
        }

        this._initCalled = true;

        if (this._options.localMode) {
          return Promise.resolve({success: true, message: "Client is in local mode."});
        }

        this._pendingInitPromise = this._fetchAndSaveValues(
          this._options.initTimeoutMs,
        );
        await this._pendingInitPromise;
        this._ready = true;
        this._delayedSetup();
        return { success: true };
      },
      () => {
        this._ready = true;
        this._initCalled = true;
        this._delayedSetup();
        return Promise.resolve({ success: false, message: "An error occurred while initializing" });
      },
    );
  }

  public initialize(initializeValues: Record<string, unknown>): InitializeResult {
    return this._errorBoundary._capture<InitializeResult>(
      'initialize',
      () => {
        this._ready = true;
        this._initCalled = true;
        this._evaluator.setInitializeValues(initializeValues, EvaluationReason.Bootstrap);
        return {
          success: false,
        };
      },
      () => {
        return {
          success: false,
          message: "An error occurred while parsing initialize values",
        };
      },
    );
  }

  public getEvaluationDetails(): EvaluationDetails {
    return this._errorBoundary._capture(
      'getEvaluationDetails',
      () => {
        return this._evaluator.getGlobalEvaluationDetails();
      },
      () => {
        return {
          time: Date.now(),
          reason: EvaluationReason.Error,
        };
      },
    );
  }

  /**
   * Checks the value of a gate for the current user
   * @param {string} gateName - the name of the gate to check
   * @returns {boolean} - value of a gate for the user. Gates are "off" (return false) by default
   */
  public checkGate(
    user: StatsigUser,
    gateName: string,
    options?: CheckGateOptions,
  ): boolean {
    const normalizedUser = this._normalizeUser(user);
    return this._checkGateImpl(normalizedUser, gateName, options);
  }

  public getFeatureGateEvaluation(
    user: StatsigUser,
    gateName: string,
  ): boolean {
    const normalizedUser = this._normalizeUser(user);
    return this._checkGateImpl(normalizedUser, gateName);
  }

  public logGateExposure(user: StatsigUser, gateName: string) {
    this._errorBoundary._swallow('logGateExposure', () => {
      const normalizedUser = this._normalizeUser(user);
      this._logGateExposureImpl(normalizedUser, gateName);
    });
  }

  /**
   * Checks the value of a config for the current user
   * @param {string} configName - the name of the config to get
   * @returns {DynamicConfig} - value of a config for the user
   */
  public getConfig(user: StatsigUser, configName: string): DynamicConfig {
    const normalizedUser = this._normalizeUser(user);
    return this._getConfigImpl(normalizedUser, configName);
  }

  public logConfigExposure(user: StatsigUser, configName: string) {
    this._errorBoundary._swallow('logConfigExposure', () => {
      const normalizedUser = this._normalizeUser(user);
      this._logConfigExposureImpl(normalizedUser, configName);
    });
  }

  public getExperiment(
    user: StatsigUser,
    experimentName: string,
    options?: GetExperimentOptions,
  ): DynamicConfig {
    const normalizedUser = this._normalizeUser(user);
    return this._getConfigImpl(normalizedUser, experimentName, options);
  }

  public logExperimentExposure(user: StatsigUser, experimentName: string) {
    const normalizedUser = this._normalizeUser(user);
    this.logConfigExposure(normalizedUser, experimentName);
  }

  public getLayer(
    user: StatsigUser,
    layerName: string,
    options?: GetLayerOptions,
  ): Layer {
    const normalizedUser = this._normalizeUser(user);
    return this._getLayerImpl(normalizedUser, layerName, options);
  }

  public logLayerParameterExposure(
    user: StatsigUser,
    layerName: string,
    parameterName: string,
  ) {
    this._errorBoundary._swallow('logLayerParameterExposure', () => {
      const normalizedUser = this._normalizeUser(user);
      const layer = this._getLayerEvaluation(normalizedUser, null, layerName);
      this._logLayerParameterExposureForLayer(layer, parameterName, true);
    });
  }

  public logEvent(
    user: StatsigUser,
    eventName: string,
    value: string | number | null = null,
    metadata: Record<string, string> | null = null,
  ): void {
    this._errorBoundary._swallow('logEvent', () => {
      const normalizedUser = this._normalizeUser(user);
      if (typeof eventName !== 'string' || eventName.length === 0) {
        return;
      }
      const event = makeLogEvent(
        eventName,
        normalizedUser,
        this._identity._statsigMetadata,
        value,
        metadata,
      );
      this._logger.log(event);
    });
  }

  public loadUserPersistedValues(
    user: StatsigUser,
    idType: string,
  ): Record<string, unknown> | null {
    return this._errorBoundary._capture('shutdown', () => {
      if (this._options.userPersistentStorage == null) {
        console.error("No user persistent storage set.  loadUserPersistedValues will noop");
        return null;
      }
      const persistedValue = StickyValuesStorage.getAll(user, idType);
      if (persistedValue == null) {
        return {};
      }
      return persistedValue;
    }, () => {
      return {};
    });
  }

  public async loadUserPersistedValuesAsync(
    user: StatsigUser,
    idType: string,
  ): Promise<Record<string, unknown> | null> {
    return this._errorBoundary._capture('shutdown', async () => {
      if (this._options.userPersistentStorage == null) {
        console.error("No user persistent storage set.  loadUserPersistedValuesAsync will noop");
        return null;
      }
      const asyncValue = await StickyValuesStorage.getAsync(user, idType);
      if (asyncValue == null) {
        return {};
      }
      return asyncValue;
    }, async () => {
      return {};
    });
  }

  /**
   * Informs the statsig SDK that the client is closing or shutting down
   * so the SDK can clean up internal state
   */
  public shutdown(): void {
    this._errorBoundary._swallow('shutdown', () => {
      this._logger.shutdown();
    });
  }

  /**
   * @returns The Statsig stable ID used for device level experiments
   */
  public getStableID(): string {
    return this._errorBoundary._capture(
      'getStableID',
      () => this._identity._stableID,
      () => '',
    );
  }

  public initializeCalled(): boolean {
    return this._initCalled;
  }

  // Private

  private _delayedSetup(): void {
    this._errorBoundary._swallow('delayedSetup', () => {
      this._identity.saveStableID();
      this._logger.sendSavedRequests().then(() => {
        /* noop */
      });
    });
  }

  private _normalizeUser(user: StatsigUser): StatsigUser {
    let userCopy: StatsigUser = {};
    try {
      userCopy = JSON.parse(JSON.stringify(user)) as StatsigUser;
    } catch (error) {}
    if (this._options.environment != null) {
      userCopy = { ...userCopy, statsigEnvironment: this._options.environment };
    }
    if (userCopy.customIDs == null) {
      userCopy.customIDs = {};
    }
    if (userCopy.customIDs.stableID == null) {
      userCopy.customIDs.stableID = this.getStableID();
    }
    return userCopy as StatsigUser;
  }

  private _getEvaluationDetailsForError(): EvaluationDetails {
    return {
      time: Date.now(),
      reason: EvaluationReason.Error,
    };
  }

  private async _fetchAndSaveValues(
    timeout: number = this._options.initTimeoutMs,
  ): Promise<InitializeResult> {
    const values = await this._network.fetchValues(timeout);
    this._evaluator.setInitializeValues(values, EvaluationReason.Network);
    return { success: true };
  }

  private _checkGateImpl(
    user: StatsigUser,
    gateName: string,
    options?: CheckGateOptions,
  ) {
    return this._errorBoundary._capture(
      'checkGate',
      () => {
        const result = this._getGateEvaluation(user, gateName);
        if (!options?.disableExposureLogging) {
          this._logGateExposureImpl(user, gateName, result);
        }
        return result.value === true;
      },
      () => false,
    );
  }

  private _getGateEvaluation(
    user: StatsigUser,
    gateName: string,
  ): ConfigEvaluation {
    return this._evaluator.checkGate(user, gateName);
  }

  private _logGateExposureImpl(
    user: StatsigUser,
    gateName: string,
    fetchResult?: ConfigEvaluation,
  ) {
    const isManualExposure = !fetchResult;
    const result = fetchResult ?? this._getGateEvaluation(user, gateName);

    this._logger.logGateExposure(
      user,
      gateName,
      result.value,
      result.rule_id,
      result.secondary_exposures,
      result.evaluation_details,
      isManualExposure,
    );
  }

  private _getConfigImpl(
    user: StatsigUser,
    configName: string,
    options?: GetExperimentOptions,
  ): DynamicConfig {
    return this._errorBoundary._capture(
      'getConfig',
      () => {
        const result = this._getConfigEvaluation(user, configName, options);
        if (!options?.disableExposureLogging) {
          this._logConfigExposureImpl(user, configName, result);
        }
        return result;
      },
      () => this._getEmptyConfig(configName),
    );
  }

  private _getConfigEvaluation(
    user: StatsigUser,
    configName: string,
    options?: GetExperimentOptions,
  ): DynamicConfig {
    const evaluation = this._evaluator.getConfig(user, configName, options);
    return new DynamicConfig(
      configName,
      evaluation.json_value,
      evaluation.rule_id,
      evaluation.evaluation_details,
      evaluation.secondary_exposures,
      this._makeOnConfigDefaultValueFallback(user),
    );
  }

  private _logConfigExposureImpl(
    user: StatsigUser,
    configName: string,
    config?: DynamicConfig,
  ) {
    const isManualExposure = !config;
    const localConfig = config ?? this._getConfigEvaluation(user, configName);

    this._logger.logConfigExposure(
      user,
      configName,
      localConfig._ruleID,
      localConfig._secondaryExposures,
      localConfig._evaluationDetails,
      isManualExposure,
    );
  }

  private _makeOnConfigDefaultValueFallback(
    user: StatsigUser,
  ): OnDefaultValueFallback {
    return (config, parameter, defaultValueType, valueType) => {
      if (!this._initCalled) {
        return;
      }

      this._logger.logConfigDefaultValueFallback(
        user,
        `Parameter ${parameter} is a value of type ${valueType}.
          Returning requested defaultValue type ${defaultValueType}`,
        {
          name: config._name,
          ruleID: config._ruleID,
          parameter,
          defaultValueType,
          valueType,
        },
      );
    };
  }

  private _getLayerImpl(
    user: StatsigUser,
    layerName: string,
    options?: GetLayerOptions,
  ) {
    return this._errorBoundary._capture(
      'getLayer',
      () => {
        const logFunc = options?.disableExposureLogging
          ? null
          : this._logLayerParameterExposureForLayer;
        return this._getLayerEvaluation(user, logFunc, layerName);
      },
      () =>
        Layer._create(
          user,
          layerName,
          {},
          '',
          this._getEvaluationDetailsForError(),
        ),
    );
  }

  private _getLayerEvaluation(
    user: StatsigUser,
    logParameterFunction: LogParameterFunction | null,
    layerName: string,
  ): Layer {
    const result = this._evaluator.getLayer(user, layerName);
    return Layer._create(
      user,
      layerName,
      result.json_value,
      result.rule_id,
      result.evaluation_details,
      logParameterFunction,
      result.secondary_exposures,
      result.undelegated_secondary_exposures,
      result.config_delegate,
      result.explicit_parameters ?? [],
    );
  }

  private _logLayerParameterExposureForLayer = (
    layer: Layer,
    parameterName: string,
    isManualExposure = false,
  ) => {
    let allocatedExperiment = '';
    let exposures = layer._undelegatedSecondaryExposures;
    const isExplicit = layer._explicitParameters.includes(parameterName);
    if (isExplicit) {
      allocatedExperiment = layer._allocatedExperimentName ?? '';
      exposures = layer._secondaryExposures;
    }

    this._logger.logLayerExposure(
      layer._user,
      layer._name,
      layer._ruleID,
      exposures,
      allocatedExperiment,
      parameterName,
      isExplicit,
      layer._evaluationDetails,
      isManualExposure,
    );
  };

  private _getEmptyConfig(configName: string): DynamicConfig {
    return new DynamicConfig(
      configName,
      {},
      '',
      this._getEvaluationDetailsForError(),
    );
  }
}
