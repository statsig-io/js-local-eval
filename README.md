# Statsig

[![npm version](https://badge.fury.io/js/statsig-js-local-eval.svg)](https://badge.fury.io/js/statsig-js-local-eval)
[![jsdelivr](https://data.jsdelivr.com/v1/package/npm/statsig-js-local-eval/badge)](https://www.jsdelivr.com/package/npm/statsig-js-local-eval)

## Statsig JS with Local Evaluation SDK

> [!IMPORTANT]
> Official Support for this version of the SDK ended January 31, 2025.
> All users of the `statsig-js-local-eval` npm package should migrate to the `@statsig/js-on-device-eval-client` package for bug fixes, performance improvements, and new features. See [this migration guide](https://docs.statsig.com/client/js-on-device-eval-client/migrating-from-js-local-eval) for more info.

A slimmed version of the Javascript that operates on the rule definitions to evaluate any gate/experiment locally (more like a Statsig server SDK).  This means when you change the user object or set of properties to check against, you do not need to make a network request to statsig - the SDK already has everything it needs to evaluate an arbitrary user object against an experiment or feature gate.  You can choose to host the rulesets for your project on your own CDN, or to inline them in your server page response.  

Statsig helps you move faster with feature gates (feature flags), and/or dynamic configs. It also allows you to run A/B/n tests to validate your new features and understand their impact on your KPIs. If you're new to Statsig, check out our product and create an account at [statsig.com](https://www.statsig.com).

## Getting Started
Check out our [SDK docs](https://docs.statsig.com/client/jsLocalEvaluationSDK) to get started.

## Supported Features
- Gate Checks
- Dynamic Configs
- Layers/Experiments
- Custom Event Logging
- Synchronous and Asynchronous initialization

## Unsupported Features - relative to statsig-js
- Local Overrides
- Extended Browser Support
- Big ID List based segments (>1k IDs)
- IP/UA Based Checks, inferred country from IP
