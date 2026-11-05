import type { ApiClient } from '../../../shared/api/client';

export class ItemsApi {
  constructor(private readonly client: ApiClient) {}

  list() { return this.client.get('items'); }
  create(title: string) { return this.client.post('items', { data: { title } }); }
  get(id: string) { return this.client.get(`items/${encodeURIComponent(id)}`); }
  remove(id: string) { return this.client.delete(`items/${encodeURIComponent(id)}`); }
}
