export const DEFAULT_CONFIG_SPEC_API = 'https://api.statsigcdn.com/v1/download_config_specs/';
export const DEFAULT_EVENT_LOGGING_API = 'https://events.statsigapi.net/v1/rgstr';
export const INIT_TIMEOUT_DEFAULT_MS = 3000;

export type StatsigEnvironment = {
  tier?: 'production' | 'staging' | 'development' | string;
  [key: string]: string | undefined;
};

export interface UserPersistentStorageInterface {
  load(key: string): string
  save(key: string, data: string): void
  loadAsync(key: string): Promise<string>
}

type CommonOptions = {
  configSpecAPI?: string;
  eventLoggingAPI?: string;
  disableCurrentPageLogging?: boolean;
  environment?: StatsigEnvironment;
  loggingIntervalMillis?: number;
  loggingBufferMaxSize?: number;
  disableNetworkKeepalive?: boolean;
  overrideStableID?: string;
  localMode?: boolean;
  disableLocalStorage?: boolean;
  ignoreWindowUndefined?: boolean;
  userPersistentStorage?: UserPersistentStorageInterface;
}

export type StatsigOptions = CommonOptions & {
  initTimeoutMs?: number;
};

export type SynchronousStatsigOptions = CommonOptions & {
  initializeValues: Record<string, any>; // required for synchronous initialization
};

type BoundedNumberInput = {
  default: number;
  min: number;
  max: number;
};

export default class StatsigSDKOptions {
  readonly configSpecAPI: string;
  readonly eventLoggingAPI: string;
  readonly disableCurrentPageLogging: boolean;
  readonly environment: StatsigEnvironment | null;
  readonly loggingIntervalMillis: number;
  readonly loggingBufferMaxSize: number;
  readonly disableNetworkKeepalive: boolean;
  readonly overrideStableID: string | null;
  readonly localMode: boolean;
  readonly initTimeoutMs: number;
  readonly initializeValues: Record<string, any> | null;
  readonly disableLocalStorage: boolean;
  readonly ignoreWindowUndefined: boolean;
  readonly userPersistentStorage: UserPersistentStorageInterface | null;

  constructor(options?: SynchronousStatsigOptions | StatsigOptions | null) {
    if (options == null) {
      options = {};
    }
    this.configSpecAPI = options.configSpecAPI ?? DEFAULT_CONFIG_SPEC_API;
    this.eventLoggingAPI = options.eventLoggingAPI ?? DEFAULT_EVENT_LOGGING_API;
    this.disableCurrentPageLogging = options.disableCurrentPageLogging ?? false;
    this.environment = options.environment ?? null;
    this.loggingIntervalMillis = this.normalizeNumberInput(
      options.loggingIntervalMillis,
      {
        default: 10000,
        min: 1000,
        max: 60000,
      },
    );
    this.loggingBufferMaxSize = this.normalizeNumberInput(
      options.loggingBufferMaxSize,
      {
        default: 100,
        min: 2,
        max: 500,
      },
    );

    this.disableNetworkKeepalive = options.disableNetworkKeepalive ?? false;
    this.overrideStableID = options.overrideStableID ?? null;
    this.localMode = options.localMode ?? false;
    
    this.disableLocalStorage = options.disableLocalStorage ?? false;
    this.ignoreWindowUndefined = options?.ignoreWindowUndefined ?? false;
    this.userPersistentStorage = options?.userPersistentStorage ?? null;

    this.initTimeoutMs = INIT_TIMEOUT_DEFAULT_MS;
    if ((options as StatsigOptions).initTimeoutMs != null) {
      const statsigOptions = options as StatsigOptions;
      this.initTimeoutMs =
      statsigOptions.initTimeoutMs && statsigOptions.initTimeoutMs >= 0
        ? statsigOptions.initTimeoutMs
        : INIT_TIMEOUT_DEFAULT_MS;
    }
    this.initializeValues = null;
    if ((options as SynchronousStatsigOptions).initializeValues != null) {
      this.initializeValues = (options as SynchronousStatsigOptions).initializeValues;
    }
  }

  private normalizeNumberInput(
    input: number | undefined,
    bounds: BoundedNumberInput,
  ): number {
    if (input == null) {
      return bounds.default;
    }
    return Math.max(Math.min(input, bounds.max), bounds.min);
  }
}
