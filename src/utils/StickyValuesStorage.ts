import { UserPersistentStorageInterface } from "../StatsigSDKOptions";
import { StatsigUser } from "../StatsigUser";
import EvaluationUtils from "./EvaluationUtils";

export default class StickyValuesStorage {
  public static storageInterface: UserPersistentStorageInterface | null = null;

  private static inMemoryCache: Record<string, Record<string, unknown>> = {};

  public static getAll(user: StatsigUser, idType: string): Record<string, unknown> | null {
    if (this.storageInterface === null) {
      return null;
    }
    const key = this.getStorageKey(user, idType);
    if (this.inMemoryCache[key] != null) {
      return this.inMemoryCache[key];
    }
    const storageValue = this.storageInterface.load(key);
    
    return this.parsePersistedValueAndCacheInMemory(key, storageValue);
  }

  static async getAsync(user: StatsigUser, idType: string): Promise<Record<string, unknown> | null> {
    if (this.storageInterface == null) {
      return null;
    }
    const key = this.getStorageKey(user, idType);
    if (this.inMemoryCache[key] != null) {
      return this.inMemoryCache[key];
    }

    const storageValue = await this.storageInterface.loadAsync(key);
    return this.parsePersistedValueAndCacheInMemory(key, storageValue);
    
  }

  static save(user: StatsigUser, idType: string, userStickyValues: Record<string, unknown>): void {
    if (this.storageInterface == null) {
      return;
    }
    const key = this.getStorageKey(user, idType);
    if (key == null) {
      return;
    }
    let value = null;
    try {
      value = JSON.stringify(userStickyValues);
    } catch(e) {}
    if (value == null) {
      return;
    }
    this.storageInterface.save(key, value);
  }

  private static parsePersistedValueAndCacheInMemory(key: string, storageValue: string | null): Record<string, unknown> | null {
    if (storageValue == null) {
      return null;
    }
    try {
      const persistedValue = JSON.parse(storageValue);
      if (persistedValue !== null) {
        this.inMemoryCache[key] = persistedValue;
      }
      return persistedValue;
    } catch (e) {
      return null;
    }
  }

  private static getStorageKey(user: StatsigUser, idType: string): string {
    return `${String(EvaluationUtils.getUnitID(user, idType))}:${idType}`;
  }
}
