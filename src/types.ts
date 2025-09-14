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
export const FEATURE_NAME_LINE = /^\s*"?feature\.(?:organizations|projects)\:[\w\-]+\"?:/;
export type FeatureName = `flagpole.organizations.${Lowercase<string>}` | `flagpole.projects.${Lowercase<string>}`;

export type Segment = {
  name: string;
  rollout?: number;
  conditions: Condition[];
};

export type RolloutState = '100%' | 'partial' | '0%';

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

export type OperatorName = Condition['operator'];
export type PropertyName = 
  | 'organization_id'
  | 'organization_is-early-adopter'
  | 'organization_name'
  | 'organization_slug'
  | 'project_id'
  | 'project_name'
  | 'project_platform'
  | 'project_slug'
  | 'sentry_region'
  | 'sentry_singletenant'
  | 'subscription_is-free'
  | 'subscription_is-partner'
  | 'subscription_missing'
  | 'subscription_plan-family'
  | 'subscription_plan-tier'
  | 'subscription_plan-trial-plan-family'
  | 'subscription_plan-trial-plan-tier'
  | 'subscription_plan-trial-plan'
  | 'subscription_plan'
  | 'user_domain'
  | 'user_email'
  | 'user_id'
  | 'user_is-staff'
  | 'user_is-superuser';

export type PropertyType = 'number' | 'string' | 'boolean';

export const PROPERTIES: Record<PropertyName, PropertyType> = {
  'organization_id': 'string',
  'organization_is-early-adopter': 'boolean',
  'organization_name': 'string',
  'organization_slug': 'string',
  'project_id': 'number',
  'project_name': 'string',
  'project_platform': 'string',
  'project_slug': 'string',
  'sentry_region': 'string',
  'sentry_singletenant': 'boolean',
  'subscription_is-free': 'boolean',
  'subscription_is-partner': 'boolean',
  'subscription_missing': 'boolean',
  'subscription_plan-family': 'string',
  'subscription_plan-tier': 'string',
  'subscription_plan-trial-plan-family': 'string',
  'subscription_plan-trial-plan-tier': 'string',
  'subscription_plan-trial-plan': 'string',
  'subscription_plan': 'string',
  'user_domain': 'string',
  'user_email': 'string',
  'user_id': 'string',
  'user_is-staff': 'boolean',
  'user_is-superuser': 'boolean',
};

export const OPERATORS: OperatorName[] = [
  'in',
  'not_in',
  'contains',
  'not_contains',
  'equals',
  'not_equals',
];
