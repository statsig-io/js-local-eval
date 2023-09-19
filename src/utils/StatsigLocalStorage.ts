export default class StatsigLocalStorage {
  public static disabled: boolean = false;
  private static fallbackSessionCache: Record<string, string> = {};
  public static getItem(key: string): string | null {
    try {
      if (this.isStorageAccessible()) {
        return window.localStorage.getItem(key);
      }
    } catch (e) {}

    return this.fallbackSessionCache[key] ?? null;
  }

  public static setItem(key: string, value: string): void {
    try {
      if (this.isStorageAccessible()) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch (e) {}
    this.fallbackSessionCache[key] = value;
  }

  public static removeItem(key: string): void {
    try {
      if (this.isStorageAccessible()) {
        window.localStorage.removeItem(key);
        return;
      }
    } catch (e) {}

    delete this.fallbackSessionCache[key];
  }

  private static canAccessStorageAccessible: boolean | null = null;
  private static isStorageAccessible(
    ignoreDisabledOption: boolean = false,
  ): boolean {
    if (this.canAccessStorageAccessible == null) {
      this.canAccessStorageAccessible =
        typeof Storage !== 'undefined' &&
        typeof window !== 'undefined' &&
        window != null &&
        window.localStorage != null;
    }

    const canAccess = this.canAccessStorageAccessible;

    if (ignoreDisabledOption) {
      return canAccess;
    }
    return !this.disabled && canAccess;
  }
}
