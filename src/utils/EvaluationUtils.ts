import { StatsigUser } from "../StatsigUser";

export default class EvaluationUtils {
  public static getUnitID(user: StatsigUser, idType: string) {
    if (typeof idType === 'string' && idType.toLowerCase() !== 'userid') {
      return (
        user?.customIDs?.[idType] ?? user?.customIDs?.[idType.toLowerCase()]
      );
    }
    return user?.userID;
  }
}
