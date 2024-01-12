import { UserPersistentStorageInterface } from '../StatsigSDKOptions';
import { StatsigUser } from '../StatsigUser';
import EvaluationUtils from './EvaluationUtils';

export type UserPersistedValues = Record<string, Record<string, unknown>>;

export default class StickyValuesStorage {
  public static storageInterface: UserPersistentStorageInterface | null = null;

  public static getAll(
    user: StatsigUser,
    idType: string,
  ): UserPersistedValues | null {
    if (this.storageInterface === null) {
      return null;
    }

    const key = this.getStorageKey(user, idType);
    try {
      return this.storageInterface.load(key);
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
    try {
      return await this.storageInterface.loadAsync(key);
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
    userStickyValues: Record<string, unknown>,
  ): void {
    if (this.storageInterface == null) {
      return;
    }

    const key = this.getStorageKey(user, idType);
    try {
      const value = JSON.stringify(userStickyValues);
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
      const key = this.getStorageKey(user, idType);
      this.storageInterface.delete(key, configName);
    }
  }

  private static getStorageKey(user: StatsigUser, idType: string): string {
    return `${String(EvaluationUtils.getUnitID(user, idType))}:${idType}`;
  }
}
