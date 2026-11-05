import process from 'node:process';
import { writeFileSync } from 'node:fs';
import { setInterval } from 'node:timers';

const install = () => process.on('SIGINT', () => {
  writeFileSync(process.argv[2], 'graceful child cleanup');
  process.exit(0);
});
if (process.env.PROBE_DELAY_HANDLER) {
  process.on('message', message => { if (message?.type === 'probe:install-handler') install(); });
} else install();
process.stdout.write('READY\n');
setInterval(() => {}, 1000);
