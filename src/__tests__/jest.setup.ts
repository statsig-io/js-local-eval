import DynamicConfig from '../DynamicConfig';

//@ts-ignore
global.console = {
  log: console.log, // console.log are kept in tests for debugging

  // Mock other console functions so they don't pollute the console when running test
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

declare global {
  namespace jest {
    interface Matchers<R> {
      toMatchConfig(config: DynamicConfig): R;
    }
    interface AsymmetricMatchers {
      toMatchConfig(config: DynamicConfig): void;
    }
  }
}

expect.extend({
  toMatchConfig(
    this: jest.MatcherContext,
    received: DynamicConfig,
    expected: DynamicConfig,
  ) {
    if (received._name !== expected._name) {
      return {
        pass: false,
        message: () =>
          `Expected name of DynamicConfig: ${received._name} to match: ${expected._name}`,
      };
    }
    if (received._ruleID !== expected._ruleID) {
      return {
        pass: false,
        message: () =>
          `Expected ruleID of DynamicConfig: ${received._ruleID} to match: ${expected._ruleID}`,
      };
    }
    if (Object.is(received.getValue(), expected.getValue())) {
      return {
        pass: false,
        message: () =>
          `Expected value of DynamicConfig: ${JSON.stringify(
            received.getValue(),
          )} to match: ${JSON.stringify(expected.getValue())}`,
      };
    }

    return {
      pass: true,
      message: () =>
        `Expected ${received} not to be the same DynamicConfig as ${expected}`,
    };
  },
});
