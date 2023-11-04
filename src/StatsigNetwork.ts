import ErrorBoundary from './ErrorBoundary';
import Identity from './StatsigIdentity';
import StatsigSDKOptions, {
  DEFAULT_CONFIG_SPEC_API,
} from './StatsigSDKOptions';

export enum StatsigEndpoint {
  DownloadConfigSpecs = 'download_config_specs',
  Rgstr = 'rgstr',
  LogEventBeacon = 'log_event_beacon',
}

type NetworkResponse = Response & {
  data?: Record<string, unknown>;
};

const NO_CONTENT = 204;

/**
 * An extension of the promise type, it adds a
 * function `eventually`. In the event that the provided timeout
 * is reached, the function will still be called regardless.
 *
 * This function WILL NOT BE CALLED if the promise resolves normally.
 */
type PromiseWithTimeout<T> = Promise<T> & {
  eventually: (fn: (t: T) => void) => PromiseWithTimeout<T>;
};

export default class StatsigNetwork {
  private readonly _options: StatsigSDKOptions;
  private readonly _identity: Identity;
  private readonly _errorBoundary: ErrorBoundary;

  private readonly retryCodes: Record<number, boolean> = {
    408: true,
    500: true,
    502: true,
    503: true,
    504: true,
    522: true,
    524: true,
    599: true,
  };

  private leakyBucket: Record<string, number>;

  private canUseKeepalive: boolean = false;

  public constructor(
    options: StatsigSDKOptions,
    identity: Identity,
    errorBoundary: ErrorBoundary,
  ) {
    this._options = options;
    this._identity = identity;
    this._errorBoundary = errorBoundary;
    this.leakyBucket = {};
    this._init();
  }

  public fetchValues(timeout: number): PromiseWithTimeout<Record<string, any>> {
    return this._postWithTimeout(
      StatsigEndpoint.DownloadConfigSpecs,
      null,
      timeout, // timeout for early returns
      3, // retries
    );
  }

  public sendLogBeacon(payload: Record<string, any>): boolean {
    if (this._options.localMode) {
      return true;
    }
    const url = new URL(
      this._options.eventLoggingAPI + StatsigEndpoint.LogEventBeacon,
    );
    url.searchParams.append('k', this._identity._sdkKey);
    payload.clientTime = Date.now() + '';
    let stringPayload: string | null = null;
    try {
      stringPayload = JSON.stringify(payload);
    } catch (_e) {
      return false;
    }
    return navigator.sendBeacon(url.toString(), stringPayload);
  }

  public async requestToEndpoint(
    endpointName: StatsigEndpoint,
    body: object | null,
    retries: number = 0,
    backoff: number = 1000,
    useKeepalive: boolean = false,
  ): Promise<NetworkResponse> {
    if (this._options.localMode) {
      return Promise.reject('no network requests in localMode');
    }
    if (typeof fetch !== 'function') {
      // fetch is not defined in this environment, short circuit
      return Promise.reject('fetch is not defined');
    }

    if (typeof window === 'undefined' && !this._options.ignoreWindowUndefined) {
      // by default, dont issue requests from the server
      return Promise.reject('window is not defined');
    }

    const url = this.getUrl(endpointName);
    const isDownloadConfigSpecs =
      endpointName === StatsigEndpoint.DownloadConfigSpecs;
    const counter = this.leakyBucket[url];
    if (counter != null && counter >= 30) {
      return Promise.reject(
        new Error(
          'Request failed because you are making the same request too frequently.',
        ),
      );
    }

    if (counter == null) {
      this.leakyBucket[url] = 1;
    } else {
      this.leakyBucket[url] = counter + 1;
    }

    const statsigMetadata = this._identity._statsigMetadata;

    const params: RequestInit = isDownloadConfigSpecs
      ? {
          method: 'GET',
          body: body === null ? undefined : JSON.stringify(body),
          cache: 'reload',
        }
      : {
          method: 'POST',
          body: body === null ? undefined : JSON.stringify(body),
          headers: {
            'Content-type': 'application/json; charset=UTF-8',
            'STATSIG-API-KEY': this._identity._sdkKey,
            'STATSIG-CLIENT-TIME': Date.now() + '',
            'STATSIG-SDK-TYPE': statsigMetadata.sdkType,
            'STATSIG-SDK-VERSION': statsigMetadata.sdkVersion,
            'STATSIG-SESSION-ID': statsigMetadata.sessionID,
          },
        };

    if (this.canUseKeepalive && useKeepalive) {
      params.keepalive = true;
    }

    return fetch(url, params)
      .then(async (res) => {
        if (res.ok) {
          const networkResponse = res as NetworkResponse;
          if (res.status === NO_CONTENT) {
            networkResponse.data = { has_updates: false, is_no_content: true };
          } else {
            const text = await res.text();
            networkResponse.data = JSON.parse(text);
          }
          return Promise.resolve(networkResponse);
        }

        if (!this.retryCodes[res.status]) {
          retries = 0;
        }
        const errorText = await res.text();
        return Promise.reject(new Error(`${res.status}: ${errorText}`));
      })
      .catch((e) => {
        if (retries > 0) {
          return new Promise<NetworkResponse>((resolve, reject) => {
            setTimeout(() => {
              this.leakyBucket[url] = Math.max(this.leakyBucket[url] - 1, 0);
              this.requestToEndpoint(
                endpointName,
                body,
                retries - 1,
                backoff * 2,
                useKeepalive,
              )
                .then(resolve)
                .catch(reject);
            }, backoff);
          });
        }
        return Promise.reject(e);
      })
      .finally(() => {
        this.leakyBucket[url] = Math.max(this.leakyBucket[url] - 1, 0);
      });
  }

  public supportsKeepalive(): boolean {
    return this.canUseKeepalive;
  }

  private _init(): void {
    if (!this._options.disableNetworkKeepalive) {
      try {
        this.canUseKeepalive = 'keepalive' in new Request('');
      } catch (_e) {}
    }
  }

  private _postWithTimeout<T>(
    endpointName: StatsigEndpoint,
    body: object | null,
    timeout: number = 0,
    retries: number = 0,
    backoff: number = 1000,
  ): PromiseWithTimeout<T> {
    let hasTimedOut = false;
    let timer = null;
    let cachedReturnValue: T | null = null;
    let eventuals: ((t: T) => void)[] = [];

    const eventually =
      (boundScope: PromiseWithTimeout<T>) => (fn: (t: T) => void) => {
        if (hasTimedOut && cachedReturnValue) {
          fn(cachedReturnValue);
        } else {
          eventuals.push(fn);
        }

        return boundScope;
      };

    if (timeout != 0) {
      timer = new Promise<void>((resolve, reject) => {
        setTimeout(() => {
          hasTimedOut = true;
          reject(
            new Error(
              `The initialization timeout of ${timeout}ms has been hit before the network request has completed.`,
            ),
          );
        }, timeout);
      });
    }

    const fetchPromise = this.requestToEndpoint(
      endpointName,
      body,
      retries,
      backoff,
    )
      .then((res) => {
        if (!res.ok) {
          return Promise.reject(
            new Error(
              `Request to ${endpointName} failed with status ${res.status}`,
            ),
          );
        }

        if (typeof res.data !== 'object') {
          const error = new Error(
            `Request to ${endpointName} received invalid response type. Expected 'object' but got '${typeof res.data}'`,
          );
          this._errorBoundary._logError(
            'postWithTimeoutInvalidRes',
            error,
            async () => {
              return this._getErrorData(
                endpointName,
                body,
                retries,
                backoff,
                res,
              );
            },
          );
          return Promise.reject(error);
        }

        const json = res.data;
        return this._errorBoundary._capture(
          'postWithTimeout',
          async () => {
            cachedReturnValue = json as T;
            if (hasTimedOut) {
              eventuals.forEach((fn) => fn(json as T));
              eventuals = [];
            }
            return Promise.resolve(json);
          },
          () => {
            return Promise.resolve({});
          },
          async () => {
            return this._getErrorData(
              endpointName,
              body,
              retries,
              backoff,
              res,
            );
          },
        );
      })
      .catch((e) => {
        return Promise.reject(e);
      });

    const racingPromise = (
      timer ? Promise.race([fetchPromise, timer]) : fetchPromise
    ) as PromiseWithTimeout<T>;
    racingPromise.eventually = eventually(racingPromise);

    return racingPromise;
  }

  private async _getErrorData(
    endpointName: StatsigEndpoint,
    body: object | null,
    retries: number,
    backoff: number,
    res: NetworkResponse,
  ): Promise<Record<string, unknown>> {
    try {
      const headers: Record<string, string> = {};
      (res.headers ?? []).forEach((value, key) => {
        headers[key] = value;
      });
      return {
        responseInfo: {
          headers,
          status: res.status,
          statusText: res.statusText,
          type: res.type,
          url: res.url,
          redirected: res.redirected,
          bodySnippet: res.data ? JSON.stringify(res.data).slice(0, 500) : null,
        },
        requestInfo: {
          endpointName: endpointName,
          bodySnippet: body ? JSON.stringify(body).slice(0, 500) : null,
          retries: retries,
          backoff: backoff,
        },
      };
    } catch (_e) {
      return {
        statusText: 'statsig::failed to extract extra data',
      };
    }
  }

  private getUrl(endpointName: StatsigEndpoint): string {
    if ([StatsigEndpoint.DownloadConfigSpecs].includes(endpointName)) {
      // If this is overridden, dont modify the url, use it as is
      if (this._options.configSpecAPI !== DEFAULT_CONFIG_SPEC_API) {
        return this._options.configSpecAPI;
      }
      return `${this._options.configSpecAPI}${this._identity._sdkKey}.json`;
    } else {
      return this._options.eventLoggingAPI;
    }
  }
}
