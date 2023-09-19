import { StatsigUser } from './StatsigUser';
import type {
  EvaluationDetails,
} from './EvaluationMetadata';
import {
  EvaluationReason,
} from './EvaluationMetadata';
import Identity from './StatsigIdentity';
import StatsigSDKOptions from './StatsigSDKOptions';
import { ConfigSpec } from './ConfigSpec';
import StatsigLocalStorage from './utils/StatsigLocalStorage';
import { INTERNAL_STORE_KEY } from './utils/Constants';
export default class StatsigStore {

  private lcut: number;
  private reason: EvaluationReason;

  private featureGates: Record<string, ConfigSpec>;
  private dynamicConfigs: Record<string, ConfigSpec>;
  private layerConfigs: Record<string, ConfigSpec>;
  private options: StatsigSDKOptions;

  public constructor(
    options: StatsigSDKOptions,
  ) {
    this.options = options;
    this.lcut = 0;
    this.reason = EvaluationReason.Uninitialized;

    this.featureGates = {};
    this.dynamicConfigs = {};
    this.layerConfigs = {};
    this.loadFromLocalStorage();
  }

  public setInitializeValues(initializeValues: Record<string, any>, reason: EvaluationReason): void {
    const updated = this.setConfigSpecs(initializeValues, reason);
    if (updated) {
      this.saveToLocalStorage(initializeValues);
    }
  }

  private saveToLocalStorage(initializeValues: Record<string, any>): void {
    try {
      StatsigLocalStorage.setItem(INTERNAL_STORE_KEY, JSON.stringify(initializeValues));
    } catch (e) {}
  }

  private loadFromLocalStorage(): void {
    const cachedValues = StatsigLocalStorage.getItem(INTERNAL_STORE_KEY);
    if (cachedValues !== null) {
      try {
        const newValues = JSON.parse(cachedValues);
        this.setConfigSpecs(newValues, EvaluationReason.Cache);
      } catch (e) {
        StatsigLocalStorage.removeItem(INTERNAL_STORE_KEY);
        this.setEvaluationReason(EvaluationReason.CacheFailure);
      }
    }
  }

  public getLastUpdateTime(): number {
    return this.lcut;
  }

  public setEvaluationReason(evalReason: EvaluationReason) {
    this.reason = evalReason;
  }

  public setConfigSpecs(values: Record<string, unknown>, updatedReason: EvaluationReason) {
    let updatedGates: Record<string, ConfigSpec> = {};
    let updatedConfigs: Record<string, ConfigSpec> = {};
    let updatedLayers: Record<string, ConfigSpec> = {};
    const featureGates = values.feature_gates;
    const dynamicConfigs = values.dynamic_configs;
    const layerConfigs = values.layer_configs;
    
    if (
      !Array.isArray(featureGates) ||
      !Array.isArray(dynamicConfigs) ||
      !Array.isArray(layerConfigs)
    ) {
      return false;
    }

    for (const gateJSON of featureGates) {
      try {
        const gate = new ConfigSpec(gateJSON);
        updatedGates[gate.name] = gate;
      } catch (e) {
        return false;
      }
    }

    for (const configJSON of dynamicConfigs) {
      try {
        const config = new ConfigSpec(configJSON);
        updatedConfigs[config.name] = config;
      } catch (e) {
        return false;
      }
    }

    for (const layerJSON of layerConfigs) {
      try {
        const config = new ConfigSpec(layerJSON);
        updatedLayers[config.name] = config;
      } catch (e) {
        return false;
      }
    }

    this.featureGates = updatedGates;
    this.dynamicConfigs = updatedConfigs;
    this.layerConfigs = updatedLayers;
    this.lcut = values.time as number ?? 0;
    this.reason = updatedReason;
    return true;
  }

  public getDynamicConfig(configName: string): ConfigSpec | null {
    return this.dynamicConfigs[configName] ?? null;
  }

  public getFeatureGate(gateName: string): ConfigSpec | null {
    return this.featureGates[gateName] ?? null;
  }

  public getLayerConfig(layerName: string): ConfigSpec | null {
    return this.layerConfigs[layerName] ?? null;
  }

  public getGlobalEvaluationDetails(): EvaluationDetails {
    return {
      reason: this.reason ?? EvaluationReason.Uninitialized,
      time: this.lcut ?? 0,
    };
  }
}
