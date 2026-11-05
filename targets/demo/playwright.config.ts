import { resolve } from 'node:path';
import { defineTarget, repositoryRoot } from '../../shared/config/define-target';

export default defineTarget({
  id: 'demo',
  directory: import.meta.dirname,
  defaultInput: resolve(repositoryRoot, 'examples/demo.input.json'),
  webServer: [{
    command: 'npm run demo:server',
    cwd: repositoryRoot,
    url: 'http://127.0.0.1:4173/health',
    reuseExistingServer: false,
    timeout: 20_000,
  }, {
    command: 'npm run demo:server',
    cwd: repositoryRoot,
    env: { DEMO_PORT: '4174' },
    url: 'http://127.0.0.1:4174/health',
    reuseExistingServer: false,
    timeout: 20_000,
  }],
});
