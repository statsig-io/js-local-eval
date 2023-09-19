import { UserPersistentStorageInterface } from "../StatsigSDKOptions";

export default class TestStickyAdapter implements UserPersistentStorageInterface {
  public store: Record<string, unknown> = {};
  load(key: string): string {
    return this.store[key] as string;
  }
  save(key: string, data: string): void {
    this.store[key] = data;
  }
  loadAsync(key: string): Promise<string> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve(this.load(key));
      }, 10);
    });
  }
}
