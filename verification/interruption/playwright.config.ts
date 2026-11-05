import { resolve } from 'node:path';
import { defineTarget, repositoryRoot } from '../../shared/config/define-target';

export default {
  ...defineTarget({ id: process.env.INTERRUPTION_TARGET!, directory: import.meta.dirname }),
  projects: [{ name: 'web', testDir: resolve(import.meta.dirname, 'fixtures') }],
  workers: 1,
  timeout: 60_000,
  webServer: {
    command: 'node --import tsx verification/interruption/web-server.ts',
    cwd: repositoryRoot,
    url: `http://127.0.0.1:${process.env.INTERRUPTION_WEB_PORT}/health`,
    reuseExistingServer: false,
    timeout: 10_000,
  },
};
