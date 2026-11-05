import { BasePage } from '../../../shared/web/base-page';
import { Form } from '../../../shared/components/form';
import { Modal } from '../../../shared/components/modal';
import { Pagination } from '../../../shared/components/pagination';
import { SingleSelect } from '../../../shared/components/single-select';
import { Table } from '../../../shared/components/table';

export class PlaygroundPage extends BasePage {
  readonly path = '/playground';
  protected readonly ready = this.page.getByRole('heading', { name: '基础能力验证', exact: true });
  readonly form = new Form(this.page.getByRole('form', { name: '资料表单', exact: true }));
  readonly table = new Table(this.page.getByRole('table', { name: '成员列表', exact: true }));
  readonly modal = new Modal(
    this.page.getByRole('dialog', { name: '编辑资料', exact: true }),
    this.page.getByRole('dialog', { name: '编辑资料', exact: true }).getByRole('button', { name: '关闭', exact: true }),
  );
  readonly stateSelect = new SingleSelect(
    this.page.getByRole('combobox', { name: '任务状态', exact: true }),
    this.page.getByRole('listbox', { name: '任务状态选项', exact: true }),
  );
  readonly pagination = new Pagination(this.page.getByRole('navigation', { name: '成员分页', exact: true }), {
    next: this.page.getByRole('navigation', { name: '成员分页', exact: true }).getByRole('button', { name: '下一页', exact: true }),
    previous: this.page.getByRole('navigation', { name: '成员分页', exact: true }).getByRole('button', { name: '上一页', exact: true }),
    current: this.page.getByRole('navigation', { name: '成员分页', exact: true }).getByTestId('current-page'),
  });
}
