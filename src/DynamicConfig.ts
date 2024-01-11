import { EvaluationDetails } from './EvaluationMetadata';

export type OnDefaultValueFallback = (
  config: DynamicConfig,
  parameter: string,
  defaultValueType: string,
  valueType: string,
) => void;

export default class DynamicConfig {
  public value: Record<string, any>;

  readonly _name: string;
  readonly _ruleID: string;
  readonly _groupName: string | null;
  readonly _secondaryExposures: Record<string, string>[];
  readonly _evaluationDetails: EvaluationDetails;
  readonly _onDefaultValueFallback: OnDefaultValueFallback | null = null;

  constructor(
    configName: string,
    configValue: Record<string, any>,
    ruleID: string,
    groupName: string | null,
    evaluationDetails: EvaluationDetails,
    secondaryExposures: Record<string, string>[] = [],
    onDefaultValueFallback: OnDefaultValueFallback | null = null,
  ) {
    this.value = JSON.parse(JSON.stringify(configValue ?? {}));

    this._name = configName;
    this._ruleID = ruleID ?? '';
    this._groupName = groupName;
    this._secondaryExposures = secondaryExposures;
    this._evaluationDetails = evaluationDetails;
    this._onDefaultValueFallback = onDefaultValueFallback;
  }

  public get<T>(
    key: string,
    defaultValue: T,
    typeGuard?: (value: unknown) => value is T,
  ): T {
    const val = this.getValue(key, defaultValue);

    if (val == null) {
      return defaultValue;
    }

    const expectedType = Array.isArray(defaultValue)
      ? 'array'
      : typeof defaultValue;
    const actualType = Array.isArray(val) ? 'array' : typeof val;

    if (typeGuard) {
      if (typeGuard(val)) {
        return val;
      }
      this._onDefaultValueFallback?.(this, key, expectedType, actualType);
      return defaultValue;
    }

    if (defaultValue == null || expectedType === actualType) {
      return val as unknown as T;
    }
    this._onDefaultValueFallback?.(this, key, expectedType, actualType);
    return defaultValue;
  }

  public getValue(
    key?: string,
    defaultValue?: any | null,
  ): boolean | number | string | object | Array<any> | null {
    if (key == null) {
      return this.value;
    }
    if (defaultValue == null) {
      defaultValue = null;
    }
    if (this.value[key] == null) {
      return defaultValue;
    }
    return this.value[key];
  }

  public getGroupName(): string | null {
    return this._groupName;
  }
}
