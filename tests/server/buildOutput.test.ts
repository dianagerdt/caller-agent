import { existsSync, readFileSync } from 'node:fs';
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

  it('starts both backend and Vite client in dev mode', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts.dev).toBe('node scripts/dev.cjs');
    expect(packageJson.scripts['dev:server']).toBe('tsx watch src/server/index.ts');
    expect(packageJson.scripts['dev:client']).toBe('vite --host 0.0.0.0');
    expect(existsSync('scripts/dev.cjs')).toBe(true);
  });

  it('stops the dev server and client process trees together', () => {
    const devScript = readFileSync('scripts/dev.cjs', 'utf8');

    expect(devScript).toContain('taskkill');
    expect(devScript).toContain('process.kill(-child.pid');
  });
});
