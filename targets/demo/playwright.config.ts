import { resolve } from 'node:path';
import { defineTarget, repositoryRoot } from '../../shared/config/define-target';

export default defineTarget({
  id: 'demo',
  directory: import.meta.dirname,
  defaultInput: resolve(repositoryRoot, 'examples/demo.input.json'),
  webServer: {
    command: 'npm run demo:server',
    cwd: repositoryRoot,
    url: 'http://127.0.0.1:4173/health',
    reuseExistingServer: false,
    timeout: 20_000,
  },
});
