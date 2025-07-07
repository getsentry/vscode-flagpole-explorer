export type Feature = {
  name: FeatureName;
  definition: {
    created_at: string;
    enabled?: boolean;
    owner: string;
    segments: Segment[];
  };
  rollout: RolloutState;
};

export const FEATURE_NAME_PATTERN = /^feature\.(?:organizations|projects)\:[a-z0-9-_.]+$/;
export type FeatureName = `flagpole.organizations.${Lowercase<string>}` | `flagpole.projects.${Lowercase<string>}`;

export type Segment = {
  name: string;
  rollout?: number;
  conditions: Condition[];
};

export type RolloutState = undefined | '100%' | 'partial' | '0%';

export type InCondition = {
  operator: 'in';
  property: PropertyName;
  value: number[] | string[];
};

export type NotInCondition = {
  operator: 'not_in';
  property: PropertyName;
  value: number[] | string[];
};

export type ContainsCondition = {
  operator: 'contains';
  property: PropertyName;
  value: number | string;
};

export type NotContainsCondition = {
  operator: 'not_contains';
  property: PropertyName;
  value: number | string;
};

export type EqualsCondition = {
  operator: 'equals';
  property: PropertyName;
  value: number | string | boolean | number[] | string[];
};

export type NotEqualsCondition = {
  operator: 'not_equals';
  property: PropertyName;
  value: number | string | boolean | number[] | string[];
};

export type Condition = InCondition | NotInCondition | ContainsCondition | NotContainsCondition | EqualsCondition | NotEqualsCondition;

export type PropertyName = 
  | 'organization_slug'
  | 'organization_name'
  | 'organization_id'
  | 'organization_is-early-adopter'
  | 'project_slug'
  | 'project_name'
  | 'project_id'
  | 'project_platform'
  | 'user_id'
  | 'user_is-superuser'
  | 'user_is-staff'
  | 'user_email'
  | 'user_domain';
