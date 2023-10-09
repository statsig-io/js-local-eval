import ErrorBoundary from './ErrorBoundary';
import { EvaluationDetails } from './EvaluationMetadata';
import type { LogEvent } from './LogEvent';
import makeLogEvent from './LogEvent';
import Identity from './StatsigIdentity';
import StatsigNetwork, { StatsigEndpoint } from './StatsigNetwork';
import StatsigSDKOptions from './StatsigSDKOptions';
import { StatsigUser } from './StatsigUser';
import { STATSIG_LOCAL_STORAGE_LOGGING_REQUEST_KEY } from './utils/Constants';
import StatsigLocalStorage from './utils/StatsigLocalStorage';

const INTERNAL_EVENT_PREFIX = 'statsig::';
const CONFIG_EXPOSURE_EVENT = INTERNAL_EVENT_PREFIX + 'config_exposure';
const LAYER_EXPOSURE_EVENT = INTERNAL_EVENT_PREFIX + 'layer_exposure';
const GATE_EXPOSURE_EVENT = INTERNAL_EVENT_PREFIX + 'gate_exposure';
const LOG_FAILURE_EVENT = INTERNAL_EVENT_PREFIX + 'log_event_failed';
const DEFAULT_VALUE_WARNING =
  INTERNAL_EVENT_PREFIX + 'default_value_type_mismatch';

type FailedLogEventBody = {
  events: object[];
  statsigMetadata: object;
  time: number;
};

const MS_RETRY_LOGS_CUTOFF = 5 * 24 * 60 * 60 * 1000;
const MAX_BATCHES_TO_RETRY = 100;
const MAX_FAILED_EVENTS = 1000;
const MAX_LOCAL_STORAGE_SIZE = 1024 * MAX_FAILED_EVENTS;

export default class StatsigLogger {
  private readonly _options: StatsigSDKOptions;
  private readonly _identity: Identity;
  private readonly _network: StatsigNetwork;
  private readonly _errorBoundary: ErrorBoundary;

  private _queue: object[];
  private _flushInterval: ReturnType<typeof setInterval> | null;
  private _loggedErrors: Set<string>;
  private _failedLogEvents: FailedLogEventBody[];
  private _exposureDedupeKeys: Record<string, number>;
  private _failedLogEventCount = 0;

  public constructor(
    options: StatsigSDKOptions,
    identity: Identity,
    network: StatsigNetwork,
    errorBoundary: ErrorBoundary,
  ) {
    this._options = options;
    this._identity = identity;
    this._network = network;
    this._errorBoundary = errorBoundary;

    this._queue = [];
    this._flushInterval = null;
    this._loggedErrors = new Set();

    this._failedLogEvents = [];
    this._exposureDedupeKeys = {};
    this._failedLogEventCount = 0;
    this._init();
  }

  public log(event: LogEvent): void {
    try {
      if (
        !this._options.disableCurrentPageLogging &&
        typeof window !== 'undefined' &&
        window != null &&
        typeof window.location === 'object' &&
        typeof window.location.href === 'string'
      ) {
        // https://stackoverflow.com/questions/6257463/how-to-get-the-url-without-any-parameters-in-javascript
        const parts = window.location.href.split(/[?#]/);
        if (parts?.length > 0) {
          event.statsigMetadata.currentPage = parts[0];
        }
      }
    } catch (_e) {}

    this._queue.push(event);

    if (this._queue.length >= this._options.loggingBufferMaxSize) {
      this.flush();
    }
  }

  public resetDedupeKeys() {
    this._exposureDedupeKeys = {};
  }

  public logGateExposure(
    user: StatsigUser,
    gateName: string,
    gateValue: boolean,
    ruleID: string,
    secondaryExposures: Record<string, string>[],
    details: EvaluationDetails,
    isManualExposure: boolean,
  ) {
    const dedupeKey = gateName + String(gateValue) + ruleID + details.reason;
    if (!this._shouldLogExposure(user, dedupeKey)) {
      return;
    }

    const metadata: Record<string, unknown> = {
      gate: gateName,
      gateValue: String(gateValue),
      ruleID: ruleID,
      reason: details.reason,
      time: details.time,
    };

    if (isManualExposure) {
      metadata['isManualExposure'] = 'true';
    }

    const gateExposure = makeLogEvent(
      GATE_EXPOSURE_EVENT,
      user,
      this._identity._statsigMetadata,
      null,
      metadata,
      secondaryExposures,
    );
    this.log(gateExposure);
  }

  public logConfigExposure(
    user: StatsigUser,
    configName: string,
    ruleID: string,
    secondaryExposures: Record<string, string>[],
    details: EvaluationDetails,
    isManualExposure: boolean,
  ) {
    const dedupeKey = configName + ruleID + details.reason;
    if (!this._shouldLogExposure(user, dedupeKey)) {
      return;
    }

    const metadata: Record<string, unknown> = {
      config: configName,
      ruleID: ruleID,
      reason: details.reason,
      time: details.time,
    };

    if (isManualExposure) {
      metadata['isManualExposure'] = 'true';
    }

    const configExposure = makeLogEvent(
      CONFIG_EXPOSURE_EVENT,
      user,
      this._identity._statsigMetadata,
      null,
      metadata,
      secondaryExposures,
    );
    this.log(configExposure);
  }

  public logLayerExposure(
    user: StatsigUser,
    configName: string,
    ruleID: string,
    secondaryExposures: Record<string, string>[],
    allocatedExperiment: string | null,
    parameterName: string,
    isExplicitParameter: boolean,
    details: EvaluationDetails,
    isManualExposure: boolean,
  ) {
    const dedupeKey = [
      configName,
      ruleID,
      allocatedExperiment,
      parameterName,
      String(isExplicitParameter),
      details.reason,
    ].join('|');

    if (!this._shouldLogExposure(user, dedupeKey)) {
      return;
    }

    const metadata: Record<string, unknown> = {
      config: configName,
      ruleID: ruleID,
      allocatedExperiment,
      parameterName,
      isExplicitParameter: String(isExplicitParameter),
      reason: details.reason,
      time: details.time,
    };

    if (isManualExposure) {
      metadata['isManualExposure'] = 'true';
    }

    const configExposure = makeLogEvent(
      LAYER_EXPOSURE_EVENT,
      user,
      this._identity._statsigMetadata,
      null,
      metadata,
      secondaryExposures,
    );
    this.log(configExposure);
  }

  public logConfigDefaultValueFallback = (
    user: StatsigUser,
    message: string,
    metadata: object,
  ) => {
    const defaultValueEvent = makeLogEvent(
      DEFAULT_VALUE_WARNING,
      user,
      this._identity._statsigMetadata,
      message,
      metadata,
    );
    this.log(defaultValueEvent);
    this._loggedErrors.add(message);
  };

  public shutdown(): void {
    if (this._flushInterval) {
      clearInterval(this._flushInterval);
      this._flushInterval = null;
    }

    this.flush(true);
  }

  public flush(isClosing: boolean = false): void {
    if (this._queue.length === 0) {
      return;
    }

    const statsigMetadata = this._identity._statsigMetadata;
    const oldQueue = this._queue;
    this._queue = [];
    if (
      isClosing &&
      !this._network.supportsKeepalive() &&
      typeof navigator !== 'undefined' &&
      navigator != null &&
      // @ts-ignore
      navigator.sendBeacon
    ) {
      const beacon = this._network.sendLogBeacon({
        events: oldQueue,
        statsigMetadata,
      });
      if (!beacon) {
        this._queue = oldQueue.concat(this._queue);
        if (this._queue.length > 0) {
          this._addFailedRequest({
            events: this._queue,
            statsigMetadata,
            time: Date.now(),
          });
          this._queue = [];
        }
        this._saveFailedRequests();
      }
      return;
    }

    const processor = this;
    this._network
      .requestToEndpoint(
        StatsigEndpoint.Rgstr,
        {
          events: oldQueue,
          statsigMetadata,
        },
        3 /* retries */,
        1000 /* backoff */,
        isClosing /* useKeepalive */,
      )
      .then((response) => {
        if (!response.ok) {
          throw response;
        }
      })
      .catch((error) => {
        if (typeof error.text === 'function') {
          error.text().then((errorText: string) => {
            this._errorBoundary._logError(
              LOG_FAILURE_EVENT,
              error,
              async () => {
                return {
                  eventCount: oldQueue.length,
                  error: errorText,
                };
              },
            );
          });
        } else {
          this._errorBoundary._logError(LOG_FAILURE_EVENT, error, async () => {
            return {
              eventCount: oldQueue.length,
              error: error.message,
            };
          });
        }
        processor._newFailedRequest(LOG_FAILURE_EVENT, oldQueue);
      })
      .finally(async () => {
        if (isClosing) {
          if (this._queue.length > 0) {
            this._addFailedRequest({
              events: this._queue,
              statsigMetadata,
              time: Date.now(),
            });

            // on app background/window blur, save unsent events as a request and clean up the queue (in case app foregrounds)
            this._queue = [];
          }
          await processor._saveFailedRequests();
        }
      });
  }

  public async sendSavedRequests(): Promise<void> {
    let failedRequests;
    let fireAndForget = false;
    failedRequests = StatsigLocalStorage.getItem(
      STATSIG_LOCAL_STORAGE_LOGGING_REQUEST_KEY,
    );
    if (failedRequests == null) {
      this._clearLocalStorageRequests();
      return;
    }
    if (failedRequests.length > MAX_LOCAL_STORAGE_SIZE) {
      fireAndForget = true;
    }
    let requestBodies: FailedLogEventBody[] = [];
    try {
      requestBodies = JSON.parse(failedRequests);
      for (const requestBody of requestBodies) {
        if (
          requestBody != null &&
          requestBody.events &&
          Array.isArray(requestBody.events)
        ) {
          this._network
            .requestToEndpoint(StatsigEndpoint.Rgstr, requestBody)
            .then((response) => {
              if (!response.ok) {
                throw Error(response.status + '');
              }
            })
            .catch((_e) => {
              if (fireAndForget) {
                return;
              }
              this._addFailedRequest(requestBody);
            });
        }
      }
    } catch (_e) {
    } finally {
      this._clearLocalStorageRequests();
    }
  }

  private _init(): void {
    if (
      typeof window !== 'undefined' &&
      typeof window.addEventListener === 'function'
    ) {
      window.addEventListener('blur', () => this.flush(true));
      window.addEventListener('beforeunload', () => this.flush(true));
      window.addEventListener('load', () => {
        setTimeout(() => this.flush(), 100);
        setTimeout(() => this.flush(), 1000);
      });
    }
    if (
      typeof document !== 'undefined' &&
      typeof document.addEventListener === 'function'
    ) {
      document.addEventListener('visibilitychange', () => {
        this.flush(document.visibilityState !== 'visible');
      });
    }
    if (
      !this._options.ignoreWindowUndefined &&
      (typeof window === 'undefined' || window == null)
    ) {
      // dont set the flush interval outside of client browser environments
      return;
    }
    if (this._options.localMode) {
      // unnecessary interval in local mode since logs dont flush anyway
      return;
    }
    const me = this;
    this._flushInterval = setInterval(() => {
      me.flush();
      me._exposureDedupeKeys = {};
    }, this._options.loggingIntervalMillis);

    // Quick flush
    setTimeout(() => this.flush(), 100);
    setTimeout(() => this.flush(), 1000);
  }

  private _shouldLogExposure(user: StatsigUser, exposureKey: string): boolean {
    let customIdKey = '';
    if (user.customIDs && typeof user.customIDs === 'object') {
      customIdKey = Object.values(user.customIDs).join();
    }

    const key = [user.userID, customIdKey, exposureKey].join('|');
    const lastTime = this._exposureDedupeKeys[key];
    const now = Date.now();
    if (lastTime == null) {
      this._exposureDedupeKeys[key] = now;
      return true;
    }
    if (lastTime >= now - 600 * 1000) {
      return false;
    }
    this._exposureDedupeKeys[key] = now;
    return true;
  }

  private async _saveFailedRequests(): Promise<void> {
    if (this._failedLogEvents.length > 0) {
      const requestsCopy = JSON.stringify(this._failedLogEvents);
      if (requestsCopy.length > MAX_LOCAL_STORAGE_SIZE) {
        this._clearLocalStorageRequests();
        return;
      }
      StatsigLocalStorage.setItem(
        STATSIG_LOCAL_STORAGE_LOGGING_REQUEST_KEY,
        requestsCopy,
      );
    }
  }

  private _addFailedRequest(requestBody: FailedLogEventBody): void {
    if (requestBody.time < Date.now() - MS_RETRY_LOGS_CUTOFF) {
      return;
    }
    if (this._failedLogEvents.length > MAX_BATCHES_TO_RETRY) {
      return;
    }
    const additionalEvents = requestBody.events.length;
    if (this._failedLogEventCount + additionalEvents > MAX_FAILED_EVENTS) {
      return;
    }
    this._failedLogEvents.push(requestBody);
    this._failedLogEventCount += additionalEvents;
  }

  private _clearLocalStorageRequests(): void {
    StatsigLocalStorage.removeItem(STATSIG_LOCAL_STORAGE_LOGGING_REQUEST_KEY);
  }

  private _newFailedRequest(name: string, queue: object[]): void {
    if (this._loggedErrors.has(name)) {
      return;
    }
    this._loggedErrors.add(name);
    this._addFailedRequest({
      events: queue,
      statsigMetadata: this._identity._statsigMetadata,
      time: Date.now(),
    });

    this._saveFailedRequests().catch(() => {});
  }
}
