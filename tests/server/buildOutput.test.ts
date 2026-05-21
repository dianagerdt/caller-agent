import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('server build output config', () => {
  it('emits CommonJS that Node can execute under dist/server', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts: Record<string, string>;
    };
    const tsconfig = JSON.parse(readFileSync('tsconfig.server.json', 'utf8')) as {
      compilerOptions: Record<string, string>;
    };

    expect(tsconfig.compilerOptions.module).toBe('CommonJS');
    expect(packageJson.scripts['build:server']).toContain('write-server-package.cjs');
  });
});
