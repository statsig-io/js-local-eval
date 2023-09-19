export const ExceptionEndpoint = 'https://statsigapi.net/v1/sdk_exception';

type ExtraDataExtractor = () => Promise<Record<string, unknown>>;

export default class ErrorBoundary {
  private readonly _sdkKey: string;
  private _statsigMetadata?: Record<string, string | number>;
  private _seen = new Set<string>();

  constructor(sdkKey: string) {
    this._sdkKey = sdkKey;
  }

  _setStatsigMetadata(statsigMetadata: Record<string, string | number>) {
    this._statsigMetadata = statsigMetadata;
  }

  _swallow<T>(tag: string, task: () => T) {
    this._capture(tag, task, () => {
      return undefined;
    });
  }

  _capture<T>(
    tag: string,
    task: () => T,
    recover: () => T,
    getExtraData?: ExtraDataExtractor,
  ): T {
    try {
      const result = task();
      if (result instanceof Promise) {
        return (result as any).catch((e: unknown) => {
          return this._onCaught(tag, e, recover, getExtraData);
        });
      }
      return result;
    } catch (error) {
      return this._onCaught(tag, error, recover, getExtraData);
    }
  }

  _logError(
    tag: string,
    error: unknown,
    getExtraData?: ExtraDataExtractor,
  ): void {
    try {
      const impl = async () => {
        const extra =
          typeof getExtraData === 'function' ? await getExtraData() : null;
        const unwrapped = (error ?? Error('[Statsig] Error was empty')) as any;
        const isError = unwrapped instanceof Error;
        const name = isError ? unwrapped.name : 'No Name';

        if (this._seen.has(name)) return;
        this._seen.add(name);

        const info = isError
          ? unwrapped.stack
          : this._getDescription(unwrapped);
        const metadata = this._statsigMetadata ?? {};
        const body = JSON.stringify({
          tag,
          exception: name,
          info,
          statsigMetadata: metadata,
          extra: extra ?? {},
        });
        return fetch(ExceptionEndpoint, {
          method: 'POST',
          headers: {
            'STATSIG-API-KEY': this._sdkKey,
            'STATSIG-SDK-TYPE': String(metadata['sdkType']),
            'STATSIG-SDK-VERSION': String(metadata['sdkVersion']),
            'Content-Type': 'application/json',
            'Content-Length': `${body.length}`,
          },
          body,
        });
      };

      impl()
        .then(() => {
          /* noop */
        })
        .catch(() => {
          /* noop */
        });
    } catch (_error) {
      /* noop */
    }
  }

  private _onCaught<T>(
    tag: string,
    error: unknown,
    recover: () => T,
    getExtraData?: ExtraDataExtractor,
  ): T {
    console.error('[Statsig] An unexpected exception occurred.', error);

    this._logError(tag, error, getExtraData);

    return recover();
  }

  private _getDescription(obj: any): string {
    try {
      return JSON.stringify(obj);
    } catch {
      return '[Statsig] Failed to get string for error.';
    }
  }
}
