import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Download, Locator, Page } from '@playwright/test';
import { PageWaits, type EventOptions } from './waits';

export type InputFiles = Parameters<Locator['setInputFiles']>[0];

export class PageFiles {
  constructor(readonly page: Page, readonly waits = new PageWaits(page)) {}

  input(target: Locator, files: InputFiles, options?: Parameters<Locator['setInputFiles']>[1]): Promise<void> {
    return target.setInputFiles(files, options);
  }

  async chooser(action: () => Promise<unknown>, files: InputFiles, options?: EventOptions): Promise<void> {
    const chooser = await this.waits.fileChooser(action, options);
    await chooser.setFiles(files);
  }

  /** The caller supplies a per-test output path, normally testInfo.outputPath(...). */
  async download(action: () => Promise<unknown>, destination: string, options?: EventOptions): Promise<Download> {
    const download = await this.waits.download(action, options);
    await mkdir(dirname(destination), { recursive: true });
    await download.saveAs(destination);
    return download;
  }
}
