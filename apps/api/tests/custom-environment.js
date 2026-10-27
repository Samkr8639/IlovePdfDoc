const NodeEnvironment = require('jest-environment-node').TestEnvironment;

class CustomNodeEnvironment extends NodeEnvironment {
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
