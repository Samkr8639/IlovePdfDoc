const NodeEnvironment = require('jest-environment-node').TestEnvironment;

class CustomNodeEnvironment extends NodeEnvironment {
  constructor(config, context) {
    super(config, context);
    if (!this.global.DOMMatrix) {
      this.global.DOMMatrix = class DOMMatrix {
        constructor() {
          this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0;
        }
      };
    }
  }

  async teardown() {
    if (this.fakeTimers) {
      this.fakeTimers.dispose();
    }
    if (this.fakeTimersModern) {
      this.fakeTimersModern.dispose();
    }
    // Retain this.context so Node V8 ESM module registry does not throw
    // 'Test environment has been torn down' across sequential test files
    this.fakeTimers = null;
    this.fakeTimersModern = null;
  }
}

module.exports = CustomNodeEnvironment;
