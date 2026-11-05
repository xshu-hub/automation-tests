import { expect, type Locator, type Response } from '@playwright/test';
import { BasePage } from '../../../shared/web/base-page';
import { itemSchema, type Item } from '../test-data/items';

export class ItemsPage extends BasePage {
  readonly path = '/items';
  protected readonly ready = this.page.getByRole('heading', { name: '事项管理', exact: true });
  readonly list = this.page.getByRole('list', { name: '事项列表', exact: true });

  row(title: string): Locator {
    return this.list.getByRole('listitem').filter({ has: this.page.getByText(title, { exact: true }) });
  }

  async create(title: string): Promise<Item> {
    await this.actions.fill(this.page.getByRole('textbox', { name: '事项名称' }), title);
    const endpoint = new URL('/api/items', this.page.url());
    const response = await this.waits.response(
      () => this.page.getByRole('button', { name: '添加事项' }).click(),
      (response) => {
        const url = new URL(response.url());
        const request = response.request();
        return url.origin === endpoint.origin && url.pathname === endpoint.pathname
          && request.method() === 'POST' && request.postDataJSON()?.title === title;
      },
    );
    expect(response.status(), 'Create item HTTP response').toBe(201);
    const item = itemSchema.parse(await response.json());
    await expect(this.row(title)).toBeVisible();
    return item;
  }

  async remove(title: string, id?: string): Promise<Response> {
    const endpoint = new URL('/api/items/', this.page.url());
    const response = await this.waits.response(
      () => this.row(title).getByRole('button', { name: '删除' }).click(),
      (response) => {
        const url = new URL(response.url());
        const itemID = url.pathname.slice(endpoint.pathname.length);
        const matchesItem = id === undefined
          ? url.pathname.startsWith(endpoint.pathname) && itemID.length > 0 && !itemID.includes('/')
          : url.pathname === `${endpoint.pathname}${encodeURIComponent(id)}`;
        return response.request().method() === 'DELETE' && url.origin === endpoint.origin && matchesItem;
      },
    );
    expect(response.status(), 'Delete item HTTP response').toBe(204);
    await expect(this.row(title)).toHaveCount(0);
    return response;
  }
}
