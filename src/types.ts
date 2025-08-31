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


export const PROPERTIES: PropertyName[] = [
  'organization_id',
  'organization_is-early-adopter',
  'organization_name',
  'organization_slug',
  'project_id',
  'project_name',
  'project_platform',
  'project_slug',
  'sentry_region',
  'sentry_singletenant',
  'subscription_is-free',
  'subscription_is-partner',
  'subscription_missing',
  'subscription_plan-family',
  'subscription_plan-tier',
  'subscription_plan-trial-plan-family',
  'subscription_plan-trial-plan-tier',
  'subscription_plan-trial-plan',
  'subscription_plan',
  'user_domain',
  'user_email',
  'user_id',
  'user_is-staff',
  'user_is-superuser',
];

export const OPERATORS: OperatorName[] = [
  'in',
  'not_in',
  'contains',
  'not_contains',
  'equals',
  'not_equals',
];
