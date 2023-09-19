export class ConfigSpec {
  public name: string;
  public type: string;
  public salt: string;
  public defaultValue: unknown;
  public enabled: boolean;
  public idType: string;
  public rules: ConfigRule[];
  public entity: string;
  public explicitParameters: string[] | null;
  public hasSharedParams: boolean;
  public isActive?: boolean;

  constructor(specJSON: Record<string, unknown>) {
    this.name = specJSON.name as string;
    this.type = specJSON.type as string;
    this.salt = specJSON.salt as string;
    this.defaultValue = specJSON.defaultValue;
    this.enabled = specJSON.enabled as boolean;
    this.idType = specJSON.idType as string;
    this.rules = this.parseRules(specJSON.rules);
    this.entity = specJSON.entity as string;
    this.explicitParameters = specJSON.explicitParameters as string[];
    if (specJSON.isActive !== null) {
      this.isActive = specJSON.isActive as boolean;
    }
    this.hasSharedParams =
      specJSON.hasSharedParams != null
        ? specJSON.hasSharedParams === true
        : false;
  }

  parseRules(rulesJSON: unknown) {
    const json = rulesJSON as Record<string, unknown>[];
    var rules = [];
    for (let i = 0; i < json.length; i++) {
      let rule = new ConfigRule(json[i]);
      rules.push(rule);
    }
    return rules;
  }


  toRecord(): Record<string, unknown> {
    return {
      name: this.name,
      type: this.type,
      salt: this.salt,
      defaultValue: this.defaultValue,
      enabled: this.enabled,
      idType: this.idType,
      rules: this.rules.map(rule => rule.toRecord()),
      entity: this.entity,
      explicitParameters: this.explicitParameters,
      hasSharedParams: this.hasSharedParams,
      isActive: this.isActive,
    };
  }
}

export class ConfigRule {
  public name: string;
  public passPercentage: number;
  public conditions: ConfigCondition[];
  public returnValue: unknown;
  public id: string;
  public salt: string;
  public idType: string;
  public configDelegate: string | null;
  public isExperimentGroup?: boolean;
  public groupName: string | null;

  constructor(ruleJSON: Record<string, unknown>) {
    this.name = ruleJSON.name as string;
    this.passPercentage = ruleJSON.passPercentage as number;
    this.conditions = this.parseConditions(ruleJSON.conditions);
    this.returnValue = ruleJSON.returnValue;
    this.id = ruleJSON.id as string;
    this.salt = ruleJSON.salt as string;
    this.idType = ruleJSON.idType as string;
    this.configDelegate = (ruleJSON.configDelegate as string) ?? null;

    if (ruleJSON.isExperimentGroup !== null) {
      this.isExperimentGroup = ruleJSON.isExperimentGroup as boolean;
    }
    this.groupName = ruleJSON.groupName as string ?? null;
  }

  toRecord(): Record<string, unknown> {
    return {
      name: this.name,
      passPercentage: this.passPercentage,
      conditions: this.conditions.map(condition => condition.toRecord()),
      returnValue: this.returnValue,
      id: this.id,
      salt: this.salt,
      idType: this.idType,
      configDelegate: this.configDelegate,
      isExperimentGroup: this.isExperimentGroup,
      groupName: this.groupName
    };
  }

  parseConditions(conditionsJSON: unknown) {
    const json = conditionsJSON as Record<string, unknown>[];
    var conditions: ConfigCondition[] = [];
    json?.forEach((cJSON) => {
      let condition = new ConfigCondition(cJSON);
      conditions.push(condition);
    });
    return conditions;
  }
}

export class ConfigCondition {
  public type: string;
  public targetValue: unknown;
  public operator: string;
  public field: string;
  public additionalValues: Record<string, unknown>;
  public idType: string;
  public constructor(conditionJSON: Record<string, unknown>) {
    this.type = conditionJSON.type as string;
    this.targetValue = conditionJSON.targetValue;
    this.operator = conditionJSON.operator as string;
    this.field = conditionJSON.field as string;
    this.additionalValues =
      (conditionJSON.additionalValues as Record<string, unknown>) ?? {};
    this.idType = conditionJSON.idType as string;
  }

  toRecord(): Record<string, unknown> {
    return {
      type: this.type,
      targetValue: this.targetValue,
      operator: this.operator,
      field: this.field,
      additionalValues: this.additionalValues,
      idType: this.idType
    };
  }
}
