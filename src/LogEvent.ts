import type { StatsigUser } from './StatsigUser';
import { StatsigMetadata } from './StatsigIdentity';

export type LogEvent = {
  eventName: string;
  user: StatsigUser;
  value: string | number | null;
  metadata: object | null;
  time: number;
  statsigMetadata: StatsigMetadata & Record<string, string>;
  secondaryExposures?: Record<string, string>[];
};

export default function makeLogEvent(
  eventName: string,
  user: StatsigUser,
  statsigMetadata: StatsigMetadata,
  value: string | number | null = null,
  metadata: object | null = null,
  secondaryExposures?: Record<string, string>[],
): LogEvent {
  let logUser = user;
  if (logUser?.privateAttributes) {
    logUser = { ...user };
    delete logUser.privateAttributes;
  }

  return {
    time: Date.now(),
    eventName,
    statsigMetadata,
    user: logUser,
    value,
    metadata,
    secondaryExposures,
  };
}
