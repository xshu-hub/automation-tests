import { test as base } from '../../../shared/fixtures/base.fixture';
import { expectJson } from '../../../shared/api/assertions';
import { uniqueName } from '../../../shared/data/unique';
import { ItemsApi } from '../api/items.api';
import { ItemsPage } from '../pages/items.page';
import { PlaygroundPage } from '../pages/playground.page';
import { itemSchema, type Item } from '../test-data/items';

interface DemoFixtures {
  itemsApi: ItemsApi;
  itemsPage: ItemsPage;
  playgroundPage: PlaygroundPage;
  createItem: (title?: string) => Promise<Item>;
}

export const test = base.extend<DemoFixtures>({
  itemsApi: async ({ api }, use) => { await use(new ItemsApi(api)); },
  itemsPage: async ({ page }, use) => { await use(new ItemsPage(page)); },
  playgroundPage: async ({ page }, use) => { await use(new PlaygroundPage(page)); },
  createItem: async ({ itemsApi, cleanup }, use) => {
    await use(async (title = uniqueName('item')) => {
      // Register by unique business key BEFORE the write: a bad response must not leak data.
      cleanup.defer(`delete item named ${title}`, async () => {
        const response = await itemsApi.list();
        if (response.status() !== 200) throw new Error(`Item lookup for cleanup returned HTTP ${response.status()}`);
        const entries = await response.json() as { id: string; title: string }[];
        for (const item of entries.filter((entry) => entry.title === title)) {
          const removed = await itemsApi.remove(item.id);
          if (![204, 404].includes(removed.status())) {
            throw new Error(`Item cleanup returned HTTP ${removed.status()}`);
          }
        }
      });
      return expectJson(await itemsApi.create(title), { status: 201, schema: itemSchema });
    });
  },
});

export { expect } from '../../../shared/fixtures/base.fixture';
