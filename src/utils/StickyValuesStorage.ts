import { UserPersistentStorageInterface } from '../StatsigSDKOptions';
import { StatsigUser } from '../StatsigUser';
import EvaluationUtils from './EvaluationUtils';

export type UserPersistedValues = Record<string, Record<string, unknown>>;

export default class StickyValuesStorage {
  public static storageInterface: UserPersistentStorageInterface | null = null;

  private static inMemoryCache: Record<string, UserPersistedValues> = {};

  public static getAll(
    user: StatsigUser,
    idType: string,
  ): UserPersistedValues | null {
    if (this.storageInterface === null) {
      return null;
    }
    const key = this.getStorageKey(user, idType);
    if (this.inMemoryCache[key] != null) {
      return this.inMemoryCache[key];
    }
    try {
      const storageValue = this.storageInterface.load(key);
      return this.parsePersistedValueAndCacheInMemory(key, storageValue);
    } catch (e) {
      console.debug(
        `Failed to load key (${key}) from user persisted storage`,
        e,
      );
    }
    return null;
  }

  static async getAsync(
    user: StatsigUser,
    idType: string,
  ): Promise<UserPersistedValues | null> {
    if (this.storageInterface == null) {
      return null;
    }
    const key = this.getStorageKey(user, idType);
    if (this.inMemoryCache[key] != null) {
      return this.inMemoryCache[key];
    }

    try {
      const storageValue = await this.storageInterface.loadAsync(key);
      return this.parsePersistedValueAndCacheInMemory(key, storageValue);
    } catch (e) {
      console.debug(
        `Failed to loadAsync key (${key}) from user persisted storage`,
        e,
      );
    }
    return null;
  }

  static save(
    user: StatsigUser,
    idType: string,
    experimentName: string,
    userStickyValues: Record<string, unknown> | null,
  ): void {
    if (this.storageInterface == null) {
      return;
    }
    const key = this.getStorageKey(user, idType);
    try {
      const value = userStickyValues == null ? null : JSON.stringify(userStickyValues);
      this.storageInterface.save(key, experimentName, value);
    } catch (e) {
      console.debug(`Failed to save key (${key}) to user persisted storage`, e);
    }
  }

  static delete(user: StatsigUser, idType: string, configName: string): void {
    if (this.storageInterface == null) {
      return;
    }
    const persistedValue = StickyValuesStorage.getAll(user, idType);
    if (persistedValue != null) {
      delete persistedValue[configName];
      StickyValuesStorage.save(user, idType, configName, null);
    }
  }

  private static parsePersistedValueAndCacheInMemory(
    key: string,
    storageValue: UserPersistedValues,
  ): UserPersistedValues | null {
    if (storageValue == null) {
      return null;
    }

    this.inMemoryCache[key] = storageValue;
    return storageValue;
  }

  private static getStorageKey(user: StatsigUser, idType: string): string {
    return `${String(EvaluationUtils.getUnitID(user, idType))}:${idType}`;
  }
}
