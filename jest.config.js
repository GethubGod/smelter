/** @type {import('jest').Config} */
module.exports = {
  testMatch: ['**/src/__tests__/**/*.test.ts'],
  // Anchored to rootDir on purpose: agent worktrees live under
  // .claude/worktrees/, so an unanchored /\.claude/ silently matched every
  // test path in a worktree and jest reported "No tests found".
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/.claude/'],
  modulePathIgnorePatterns: ['<rootDir>/.claude/'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        moduleResolution: 'node',
        esModuleInterop: true,
        strict: true,
        jsx: 'react',
        allowImportingTsExtensions: true,
        paths: { '@/*': ['./src/*'] },
        baseUrl: '.',
      },
    }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Untransformed ESM under ts-jest — see test-mocks/reanimatedSwipeable.tsx.
    '^react-native-gesture-handler/ReanimatedSwipeable$':
      '<rootDir>/test-mocks/reanimatedSwipeable.tsx',
  },
};
