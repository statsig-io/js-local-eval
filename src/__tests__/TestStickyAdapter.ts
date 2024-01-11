import { UserPersistentStorageInterface } from "../StatsigSDKOptions";
import { UserPersistedValues } from "../utils/StickyValuesStorage";

export default class TestStickyAdapter implements UserPersistentStorageInterface {
  public store: Record<string, UserPersistedValues> = {};

  delete(key: string, experimentName: string): void {
    delete this.store[key][experimentName];
  }

  load(key: string): UserPersistedValues {
    return this.store[key];
  }

  save(key: string, experimentName: string, data: string): void {
    let updatedValue: UserPersistedValues = this.store[key];
    if (updatedValue == null) {
      updatedValue = {};
    }
    updatedValue[experimentName] = JSON.parse(data);
    this.store[key] = updatedValue;
  }

  loadAsync(key: string): Promise<UserPersistedValues> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve(this.load(key));
      }, 10);
    });
  }
}
