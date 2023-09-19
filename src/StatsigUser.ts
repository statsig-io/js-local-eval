import { StatsigEnvironment } from "./StatsigSDKOptions";

export type StatsigUser = {
  userID?: string | number;
  email?: string;
  ip?: string;
  userAgent?: string;
  country?: string;
  locale?: string;
  appVersion?: string;
  custom?: Record<
    string,
    string | number | boolean | Array<string> | undefined
  >;
  privateAttributes?: Record<
    string,
    string | number | boolean | Array<string> | undefined
  >;
  customIDs?: Record<string, string>;
  statsigEnvironment?: StatsigEnvironment;
};
