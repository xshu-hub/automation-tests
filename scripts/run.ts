import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { initializeRun, repositoryRoot, validateTargetID } from '../shared/config/output';
import { startManagedProcess } from './managed-process';

const { values, positionals } = parseArgs({
  options: {
    target: { type: 'string', default: 'demo' },
    input: { type: 'string' },
    suite: { type: 'string', default: 'all' },
    identity: { type: 'string' },
    'shutdown-timeout': { type: 'string', default: '30000' },
    help: { type: 'boolean', short: 'h' },
  },
  allowPositionals: true,
});

if (values.help) {
  console.log(`Usage: npm test -- [--target demo] [--input runtime.json] [--suite api|web|all]
                [--identity admin] [--shutdown-timeout 30000] [-- <native Playwright arguments>]

Examples:
  npm test
  npm test -- --suite api
  npm test -- --target crm --input .runtime/crm.json --suite web -- --workers=2
  npm test -- --suite web -- --grep @e2e --headed

Configuration and authentication are supplied externally. No MCP or login calls are made.`);
  process.exit(0);
}

validateTargetID(values.target);
const shutdownTimeoutMs = Number(values['shutdown-timeout']);
if (!Number.isInteger(shutdownTimeoutMs) || shutdownTimeoutMs < 1 || shutdownTimeoutMs > 2_147_483_647) {
  throw new Error('--shutdown-timeout must be a positive integer number of milliseconds.');
}
if (!['api', 'web', 'all'].includes(values.suite)) throw new Error('--suite must be api, web or all.');
const config = resolve(repositoryRoot, 'targets', values.target, 'playwright.config.ts');
if (!existsSync(config)) throw new Error(`Unknown target "${values.target}". Create it with npm run target:new -- ${values.target}`);
const args = ['test', '--config', config];
if (values.suite !== 'all') args.push(`--project=${values.suite}`);
args.push(...positionals);
const env = { ...process.env };
const { runID, attemptID } = initializeRun(env, true);
if (values.input) env.AUTOMATION_INPUT = resolve(values.input);
if (values.identity) env.AUTOMATION_IDENTITY = values.identity;
console.log(`[automation] target=${values.target} suite=${values.suite}`);
const lifecycleFile = resolve(repositoryRoot, 'artifacts/_launcher', values.target, runID, attemptID, 'status.json');
console.log(`[automation] launcher=${lifecycleFile}`);
// External Node orchestrators on Windows should request cancellation via IPC,
// rather than taskkill/child.kill, which cannot deliver a graceful POSIX signal.
const onMessage = (message: unknown) => {
  if (message && typeof message === 'object' && 'type' in message && message.type === 'automation:interrupt'
    && 'signal' in message && (message.signal === 'SIGINT' || message.signal === 'SIGTERM')) process.emit(message.signal);
};
process.on('message', onMessage);
process.channel?.unref();
const { completed } = startManagedProcess(resolve(repositoryRoot, 'node_modules/@playwright/test/cli.js'), args, {
  cwd: repositoryRoot, env, shutdownTimeoutMs, lifecycleFile,
});
if (process.connected) process.send?.({ type: 'automation:ready', lifecycleFile }, () => {});
try { process.exitCode = await completed; }
finally { process.off('message', onMessage); }
