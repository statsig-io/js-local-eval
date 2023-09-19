import { StatsigUser } from '../StatsigUser';

export function SimpleHash(value: string): string {
  var hash = 0;
  for (var i = 0; i < value.length; i++) {
    var character = value.charCodeAt(i);
    hash = (hash << 5) - hash + character;
    hash = hash & hash; // Convert to 32bit integer
  }
  return String(hash >>> 0);
}

export function getHashValue(value: string): string {
  return SimpleHash(value);
}

export function getUserCacheKey(user: StatsigUser): string {
  let key = `userID:${String(user?.userID ?? '')}`;

  const customIDs = user?.customIDs;
  if (customIDs != null) {
    for (const [type, value] of Object.entries(customIDs)) {
      key += `;${type}:${value}`;
    }
  }

  return SimpleHash(key);
}
