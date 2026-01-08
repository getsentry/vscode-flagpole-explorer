"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPERATORS = exports.PROPERTIES = exports.FEATURE_NAME_LINE = exports.FEATURE_NAME_PATTERN = void 0;
exports.FEATURE_NAME_PATTERN = /^feature\.(?:organizations|projects)\:[a-z0-9-_.]+$/;
exports.FEATURE_NAME_LINE = /^\s*"?feature\.(?:organizations|projects)\:[\w\-]+\"?:/;
exports.PROPERTIES = {
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
exports.OPERATORS = [
    'in',
    'not_in',
    'contains',
    'not_contains',
    'equals',
    'not_equals',
];
//# sourceMappingURL=types.js.map