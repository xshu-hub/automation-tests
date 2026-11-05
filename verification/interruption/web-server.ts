import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// A real runner-owned descendant lets the verifier detect process-tree leaks.
const descendant = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore', windowsHide: true });
const server = createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'text/html' });
  response.end('<!doctype html><title>Interruption probe</title><h1>Probe is ready</h1>');
});
server.listen(Number(process.env.INTERRUPTION_WEB_PORT), '127.0.0.1', () => {
  writeFileSync(resolve(process.env.INTERRUPTION_PROOF!, 'owned-processes.json'),
    JSON.stringify({ server: process.pid, descendant: descendant.pid }));
});
