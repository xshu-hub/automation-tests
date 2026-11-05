import { resolve } from 'node:path';
import demo from '../targets/demo/playwright.config';

export default {
  ...demo,
  fullyParallel: false,
  projects: [{ name: 'web', testDir: resolve(import.meta.dirname, 'failure-tests') }],
  workers: 1,
};
