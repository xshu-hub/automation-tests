import type { Page } from '@playwright/test';
import { PageFiles } from './files';

export async function saveDownload(page: Page, action: () => Promise<unknown>, destination: string): Promise<void> {
  await new PageFiles(page).download(action, destination);
}
