import { pathToFileURL } from 'node:url';

// Node's Windows kill('SIGINT') is forceful. Deliver one interruption inside
// this isolated Node process so Playwright's existing SIGINT handler can stop
// workers, run fixture teardown and finish its native reporters.
let pending = false;
let delivered = false;
const deliver = () => {
  if (!pending || delivered || !process.listenerCount('SIGINT')) return;
  delivered = true;
  process.emit('SIGINT');
};
const requestInterrupt = () => { pending = true; deliver(); };
process.on('message', (message: unknown) => {
  if (message && typeof message === 'object'
    && 'type' in message && message.type === 'automation:interrupt') requestInterrupt();
});
process.on('disconnect', requestInterrupt);
process.on('newListener', (event) => {
  // newListener is emitted before the actual listener is attached.
  if (event === 'SIGINT') queueMicrotask(deliver);
});
// Listening for parent commands must not keep a completed CLI alive.
process.channel?.unref();
const entry = process.argv[2];
if (!entry) throw new Error('Missing managed child entry point.');
process.argv.splice(1, 1);
await import(pathToFileURL(entry).href);
