module.exports = {
  preset: 'ts-jest',
  testEnvironment: '<rootDir>/tests/custom-environment.js',
  workerThreads: false,
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.spec.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }]
  }
};
