import { EvaluationDetails } from './EvaluationMetadata';
import { StatsigUser } from './StatsigUser';

export type LogParameterFunction = (
  layer: Layer,
  parameterName: string,
) => void;

export default class Layer {
  readonly _user: StatsigUser;
  readonly _name: string;
  readonly _value: Record<string, any>;
  readonly _ruleID: string;
  readonly _secondaryExposures: Record<string, string>[];
  readonly _undelegatedSecondaryExposures: Record<string, string>[];
  readonly _allocatedExperimentName: string | null;
  readonly _explicitParameters: string[];
  readonly _evaluationDetails: EvaluationDetails;
  readonly _logParameterFunction: LogParameterFunction | null;

  private constructor(
    user: StatsigUser,
    name: string,
    layerValue: Record<string, any>,
    ruleID: string,
    evaluationDetails: EvaluationDetails,
    logParameterFunction: LogParameterFunction | null = null,
    secondaryExposures: Record<string, string>[] = [],
    undelegatedSecondaryExposures: Record<string, string>[] = [],
    allocatedExperimentName: string | null = null,
    explicitParameters: string[] = [],
  ) {
    this._user = user;
    this._logParameterFunction = logParameterFunction;
    this._name = name;
    this._value = JSON.parse(JSON.stringify(layerValue ?? {}));
    this._ruleID = ruleID ?? '';
    this._evaluationDetails = evaluationDetails;
    this._secondaryExposures = secondaryExposures;
    this._undelegatedSecondaryExposures = undelegatedSecondaryExposures;
    this._allocatedExperimentName = allocatedExperimentName;
    this._explicitParameters = explicitParameters;
  }

  static _create(
    user: StatsigUser,
    name: string,
    value: Record<string, any>,
    ruleID: string,
    evaluationDetails: EvaluationDetails,
    logParameterFunction: LogParameterFunction | null = null,
    secondaryExposures: Record<string, string>[] = [],
    undelegatedSecondaryExposures: Record<string, string>[] = [],
    allocatedExperimentName: string | null = null,
    explicitParameters: string[] = [],
  ): Layer {
    return new Layer(
      user,
      name,
      value,
      ruleID,
      evaluationDetails,
      logParameterFunction,
      secondaryExposures,
      undelegatedSecondaryExposures,
      allocatedExperimentName,
      explicitParameters,
    );
  }

  public get<T>(
    key: string,
    defaultValue: T,
    typeGuard?: (value: unknown) => value is T,
  ): T {
    const def = defaultValue ?? null;
    const val = this._value[key];

    if (val == null) {

    // @ts-ignore
      return def;
    }

    const logAndReturn = () => {
      this._logLayerParameterExposure(key);
      return val as unknown as T;
    };

    if (typeGuard) {

    // @ts-ignore
      return typeGuard(val) ? logAndReturn() : def;
    }

    if (def == null) {
      return logAndReturn();
    }

    if (
      typeof val === typeof def &&
      Array.isArray(def) === Array.isArray(val)
    ) {
      return logAndReturn();
    }

    return def;
  }

  public getValue(
    key: string,
    defaultValue?: any | null,
  ): boolean | number | string | object | Array<any> | null {
    if (defaultValue == undefined) {
      defaultValue = null;
    }

    const val = this._value[key];
    if (val != null) {
      this._logLayerParameterExposure(key);
    }

    return val ?? defaultValue;
  }

  private _logLayerParameterExposure(parameterName: string) {
    this._logParameterFunction?.(this, parameterName);
  }
}
