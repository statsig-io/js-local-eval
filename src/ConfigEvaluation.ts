import { EvaluationReason } from './EvaluationMetadata';
import type { EvaluationDetails } from './EvaluationMetadata';
import type { StickyValues } from './utils/StickyValuesStorage';

export default class ConfigEvaluation {
  public value: boolean;
  public rule_id: string;
  public secondary_exposures: Record<string, string>[];
  public json_value: Record<string, unknown>;
  public explicit_parameters: string[] | null;
  public config_delegate: string | null;
  public undelegated_secondary_exposures: Record<string, string>[];
  public is_experiment_group: boolean;
  public group_name: string | null = null;
  public evaluation_details: EvaluationDetails;

  constructor(
    value: boolean,
    rule_id: string,
    secondary_exposures: Record<string, string>[] = [],
    json_value: Record<string, unknown> | boolean = {},
    explicit_parameters: string[] | null = null,
    config_delegate: string | null = null,
  ) {
    this.value = value;
    this.rule_id = rule_id;
    if (typeof json_value === 'boolean') {
      // handle legacy gate case
      this.json_value = {};
    } else {
      this.json_value = json_value;
    }
    this.secondary_exposures = secondary_exposures;
    this.undelegated_secondary_exposures = secondary_exposures;
    this.config_delegate = config_delegate;
    this.explicit_parameters = explicit_parameters;
    this.is_experiment_group = false;
    this.evaluation_details = {
      time: Date.now(),
      reason: EvaluationReason.Uninitialized,
    };
  }

  public withGroupName(name: string | null) {
    this.group_name = name;
    return this;
  }

  public withEvaluationDetails(
    reason: EvaluationReason,
    time: number,
  ): ConfigEvaluation {
    this.evaluation_details.reason = reason;
    this.evaluation_details.time = time;
    return this;
  }

  public setIsExperimentGroup(isExperimentGroup: boolean = false) {
    this.is_experiment_group = isExperimentGroup;
  }

  public static fromSticky(stickyValue: StickyValues): ConfigEvaluation | null {
    const evaluation = new ConfigEvaluation(
      stickyValue.value,
      stickyValue.rule_id,
      stickyValue.secondary_exposures,
      stickyValue.json_value,
      stickyValue.explicit_parameters,
      stickyValue.config_delegate,
    );
    evaluation.evaluation_details = {
      time: stickyValue.time,
      reason: EvaluationReason.Persisted,
    };
    evaluation.undelegated_secondary_exposures =
      stickyValue.undelegated_secondary_exposures;
    evaluation.is_experiment_group = true;
    return evaluation.withGroupName(stickyValue.group_name);
  }

  public getJSONValue(): StickyValues {
    return {
      value: this.value,
      rule_id: this.rule_id,
      json_value: this.json_value,
      secondary_exposures: this.secondary_exposures,
      explicit_parameters: this.explicit_parameters,
      config_delegate: this.config_delegate,
      undelegated_secondary_exposures:
        this.undelegated_secondary_exposures ?? null,
      group_name: this.group_name,
      time: this.evaluation_details.time,
    };
  }
}
