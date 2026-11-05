import { resolve } from 'node:path';
import { defineConfig, type PlaywrightTestConfig } from '@playwright/test';
import { loadRuntime } from '../input/load';
import type { BaseOptions } from '../fixtures/base.fixture';
import { resolveArtifactOutput, validateTargetID } from './output';

export { repositoryRoot } from './output';

interface TargetOptions {
  id: string;
  directory: string;
  defaultInput?: string;
  webServer?: PlaywrightTestConfig['webServer'];
}

/** Shared defaults; native Playwright options may be added in the target config. */
export function defineTarget(options: TargetOptions): PlaywrightTestConfig<BaseOptions> {
  validateTargetID(options.id);
  const input = process.env.AUTOMATION_INPUT || options.defaultInput;
  if (!input) throw new Error(`Target "${options.id}" requires external input. Pass --input <file>.`);
  process.env.AUTOMATION_INPUT = resolve(input);
  const runtime = loadRuntime(input, options.id);
  const { artifactDirectory: output, runID, attemptID } = resolveArtifactOutput(options.id, runtime.environment);
  const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH;
  console.log(`[automation] artifacts=${output}`);

  return defineConfig<BaseOptions>({
    testDir: resolve(options.directory, 'tests'),
    outputDir: resolve(output, 'results'),
    metadata: { artifactDirectory: output, runID, attemptID },
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: 0,
    workers: 2,
    timeout: 30_000,
    expect: { timeout: 5_000 },
    reporter: [
      ['list'],
      ['html', { outputFolder: resolve(output, 'report'), open: 'never' }],
      ['junit', { outputFile: resolve(output, 'junit.xml') }],
      ['json', { outputFile: resolve(output, 'results.json') }],
    ],
    use: {
      baseURL: runtime.webBaseURL,
      browserName: 'chromium',
      headless: true,
      viewport: { width: 1440, height: 900 },
      actionTimeout: 10_000,
      navigationTimeout: 20_000,
      trace: 'retain-on-failure',
      screenshot: 'only-on-failure',
      video: 'off',
      ignoreHTTPSErrors: false,
      ...(executablePath ? { launchOptions: { executablePath } } : {}),
    },
    projects: [
      { name: 'api', testDir: resolve(options.directory, 'tests/api') },
      { name: 'web', testDir: resolve(options.directory, 'tests/web') },
    ],
    webServer: options.webServer,
  });
}
