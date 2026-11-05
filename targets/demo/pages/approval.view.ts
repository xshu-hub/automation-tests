import { BaseView } from '../../../shared/web/base-view';
import { Form } from '../../../shared/components/form';
import { Table } from '../../../shared/components/table';

/** The same region can live in a Page, a frame or a scoped Locator. */
export class ApprovalView extends BaseView {
  protected readonly ready = this.root.getByRole('heading', { name: '审批表单', exact: true });
  readonly form = new Form(this.root.getByRole('form', { name: '审批表单', exact: true }));
  readonly table = new Table(this.root.getByRole('table', { name: '审核记录', exact: true }));

  async submit(opinion: string): Promise<void> {
    await this.expectReady();
    await this.form.fill({ 审批意见: opinion });
    await this.form.submit('提交');
  }
}
