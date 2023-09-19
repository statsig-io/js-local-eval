export type EvaluationDetails = {
  time: number;
  reason: EvaluationReason;
};

export enum EvaluationReason {
  Network = 'Network',
  Bootstrap = 'Bootstrap',
  InvalidBootstrap = 'InvalidBootstrap',
  Cache = 'Cache',
  CacheFailure = 'CacheFailure',
  Persisted = 'Persisted',
  Unrecognized = 'Unrecognized',
  Uninitialized = 'Uninitialized',
  Error = 'Error',
  Unsupported = 'Unsupported',
  NetworkNotModified = 'NetworkNotModified',
}
