import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { matchPersonByName, normalizeTaskProposal, planProposalBatch, proposalHistoryNote, proposalToTaskDraft } from '@qcet/shared/domain/assistant/assistant-task-proposal';
import { ASSISTANT_TOOL_DEFINITIONS, runAssistantTool, type AssistantToolContext } from '../src/server/assistant/assistant-tools';
import { TASK_AGENT_SUBTASKS_MAX } from '@qcet/shared/domain/tasks/task-agent-draft';

// propose_task không đọc dữ liệu nên không cần ngữ cảnh phân quyền thật
const CTX = { authz: undefined, userId: 'u-1', today: '2026-10-18' } as unknown as AssistantToolContext;

const PEOPLE = [
  { id: 'lan', name: 'Nguyễn Thị Lan' },
  { id: 'lan-2', name: 'Trần Ngọc Lan' },
  { id: 'lan-hoa', name: 'Phạm Thị Lan Hoa' },
  { id: 'lan-dau', name: 'Lê Văn Lân' },
  { id: 'hung', name: 'TS. Nguyễn Văn Hùng' },
  { id: 'minh', name: 'Đỗ Quang Minh' },
  { id: 'anh', name: 'Vũ Thị Anh' },
  // Danh sách nhân sự thật ghi kèm chức vụ trong ngoặc và có thể có hai dấu cách
  { id: 'cuong', name: 'TS. Đinh Quốc Cường (Trưởng khoa Cơ khí)' },
  { id: 'ky', name: 'Lê  Thị Thái Kỳ' },
];

describe('Đề xuất nhiệm vụ của Trợ lý: làm sạch', () => {
  it('tiêu đề một dòng, bỏ ngày bắt đầu sau hạn, hạn việc con sau hạn nhiệm vụ và việc con trùng tên', () => {
    const proposal = normalizeTaskProposal({
      title: '  Chuẩn bị\nhội thảo  ',
      description: '   ',
      priority: 'HIGH',
      startDate: '2026-11-02',
      dueDate: '2026-10-30',
      leadAssigneeName: ' chị   Lan ',
      subtasks: [
        { title: 'Đặt hội trường', dueDate: '2026-10-25', assigneeName: 'anh Minh' },
        { title: 'đặt  hội trường', dueDate: '2026-10-26' },
        { title: 'Gửi giấy mời', dueDate: '2026-11-05' },
      ],
    });
    assert.deepEqual(proposal, {
      title: 'Chuẩn bị hội thảo',
      priority: 'HIGH',
      dueDate: '2026-10-30',
      leadAssigneeName: 'chị Lan',
      subtasks: [
        { title: 'Đặt hội trường', dueDate: '2026-10-25', assigneeName: 'anh Minh' },
        { title: 'Gửi giấy mời' },
      ],
    });
  });

  it('không có hạn thì giữ ngày bắt đầu và hạn việc con; tối đa số việc con của hộp', () => {
    const subtasks = Array.from({ length: TASK_AGENT_SUBTASKS_MAX + 3 }, (_, i) => ({ title: `Việc số ${i + 1}`, dueDate: '2026-12-01' }));
    const proposal = normalizeTaskProposal({ title: 'Rà soát hồ sơ', startDate: '2026-11-02', subtasks });
    assert.equal(proposal.startDate, '2026-11-02');
    assert.equal(proposal.subtasks?.length, TASK_AGENT_SUBTASKS_MAX);
    assert.equal(proposal.subtasks?.[0].dueDate, '2026-12-01');
  });
});

describe('Đề xuất nhiệm vụ của Trợ lý: khớp tên người với nhân sự đơn vị', () => {
  it('trùng cả họ tên, bỏ danh xưng và học vị', () => {
    assert.equal(matchPersonByName('Nguyễn Thị Lan', PEOPLE), 'lan');
    assert.equal(matchPersonByName('chị Nguyễn Thị Lan', PEOPLE), 'lan');
    assert.equal(matchPersonByName('thầy Hùng', PEOPLE), 'hung', 'học vị trong tên nhân sự không cản khớp');
    assert.equal(matchPersonByName('đồng chí Minh', PEOPLE), 'minh');
    assert.equal(matchPersonByName('anh Cường', PEOPLE), 'cuong', 'bỏ chức vụ trong ngoặc của tên nhân sự');
    assert.equal(matchPersonByName('Đinh Quốc Cường', PEOPLE), 'cuong');
    assert.equal(matchPersonByName('cô Lê Thị Thái Kỳ', PEOPLE), 'ky');
  });

  it('tên gọi hay phần cuối họ tên chỉ khớp khi đúng một người; không chắc thì để trống', () => {
    assert.equal(matchPersonByName('chị Lan', PEOPLE), undefined, 'hai người tên Lan');
    assert.equal(matchPersonByName('Thị Lan', PEOPLE), 'lan');
    assert.equal(matchPersonByName('Lan Hoa', PEOPLE), 'lan-hoa');
    assert.equal(matchPersonByName('anh Lân', PEOPLE), 'lan-dau', 'giữ dấu: Lân khác Lan');
    assert.equal(matchPersonByName('Anh', PEOPLE), 'anh', '"Anh" đứng một mình là tên, không phải danh xưng');
    assert.equal(matchPersonByName('cô Mai', PEOPLE), undefined);
    assert.equal(matchPersonByName('', PEOPLE), undefined);
    assert.equal(matchPersonByName(undefined, PEOPLE), undefined);
  });

  it('đổi đề xuất thành nháp của hộp: tên khớp thành id, không khớp thì bỏ', () => {
    const draft = proposalToTaskDraft(
      {
        title: 'Chuẩn bị hội thảo',
        dueDate: '2026-10-30',
        leadAssigneeName: 'anh Minh',
        subtasks: [
          { title: 'Đặt hội trường', assigneeName: 'thầy Hùng', dueDate: '2026-10-25' },
          { title: 'Gửi giấy mời', assigneeName: 'chị Lan' },
        ],
      },
      PEOPLE,
    );
    assert.deepEqual(draft, {
      title: 'Chuẩn bị hội thảo',
      dueDate: '2026-10-30',
      leadAssigneeId: 'minh',
      subtasks: [
        { title: 'Đặt hội trường', assigneeId: 'hung', dueDate: '2026-10-25' },
        { title: 'Gửi giấy mời' },
      ],
    });
  });
});

describe('"Tạo tất cả" đề xuất của Trợ lý: planProposalBatch', () => {
  const plan = [
    { title: 'Rà soát danh mục ERP, LMS tháng 8/2026', dueDate: '2026-08-31', leadAssigneeName: 'Đỗ Quang Minh' },
    { title: 'Khảo sát nguồn dữ liệu tháng 9/2026', dueDate: '2026-09-30', leadAssigneeName: 'chị Lan' },
    { title: 'Thiết kế quy trình số', leadAssigneeName: 'Vũ Thị Anh', subtasks: [{ title: 'Vẽ sơ đồ quy trình', assigneeName: 'anh Minh' }] },
  ];

  it('mỗi đề xuất thành nháp đã khớp người như hộp tạo; thiếu hạn hoặc chủ trì không khớp thì ghi trường thiếu', () => {
    const rows = planProposalBatch(plan, PEOPLE);
    assert.deepEqual(rows[0], { draft: { title: plan[0].title, dueDate: '2026-08-31', leadAssigneeId: 'minh' }, missing: [] });
    // "chị Lan" khớp hai người: để trống, không đoán
    assert.deepEqual(rows[1].missing, ['lead']);
    assert.equal(rows[1].draft.leadAssigneeId, undefined);
    // Không tự đặt hạn; việc con khớp người nhận theo tên
    assert.deepEqual(rows[2].missing, ['dueDate']);
    assert.deepEqual(rows[2].draft.subtasks, [{ title: 'Vẽ sơ đồ quy trình', assigneeId: 'minh' }]);
  });

  it('chủ trì người dùng chọn trong hộp chỉ điền cho đề xuất chưa khớp và phải thuộc nhân sự của đơn vị', () => {
    const rows = planProposalBatch(plan, PEOPLE, 'anh');
    assert.equal(rows[0].draft.leadAssigneeId, 'minh', 'đề xuất đã khớp giữ người của nó');
    assert.equal(rows[1].draft.leadAssigneeId, 'anh');
    assert.deepEqual(rows[1].missing, []);
    assert.deepEqual(planProposalBatch(plan, PEOPLE, 'nguoi-ngoai')[1].missing, ['lead']);
  });
});

describe('Đề xuất nhiệm vụ của Trợ lý: tool propose_task', () => {
  it('trả đề xuất đã làm sạch, báo mô hình là chưa tạo gì, không có nguồn', async () => {
    const outcome = await runAssistantTool(
      'propose_task',
      JSON.stringify({ title: 'Chuẩn bị hội thảo chuyển đổi số', dueDate: '2026-10-30', startDate: '2026-11-01', leadAssigneeName: 'chị Lan' }),
      CTX,
    );
    assert.equal(outcome.ok, true);
    assert.deepEqual(outcome.proposal, { title: 'Chuẩn bị hội thảo chuyển đổi số', dueDate: '2026-10-30', leadAssigneeName: 'chị Lan' });
    const content = JSON.parse(outcome.content) as { created: boolean; note: string; proposal: unknown };
    assert.equal(content.created, false);
    assert.match(content.note, /Chưa tạo nhiệm vụ nào/);
    assert.deepEqual(content.proposal, outcome.proposal);
    assert.deepEqual(outcome.sources, []);
    assert.equal(outcome.step.tool, 'propose_task');
    assert.match(outcome.step.label, /^Soạn đề xuất “Chuẩn bị hội thảo/);
  });

  it('tham số lạ (id người, đơn vị), ngày không có thật hay tiêu đề quá ngắn bị từ chối, không có đề xuất', async () => {
    for (const args of [
      { title: 'Chuẩn bị hội thảo', leadAssigneeId: 'u-2' },
      { title: 'Chuẩn bị hội thảo', departmentCode: 'PDT' },
      { title: 'Chuẩn bị hội thảo', dueDate: '2026-02-30' },
      { title: 'Chuẩn bị hội thảo', subtasks: [{ title: 'Đặt phòng', assigneeId: 'u-2' }] },
      { title: 'ab' },
    ]) {
      const outcome = await runAssistantTool('propose_task', JSON.stringify(args), CTX);
      assert.equal(outcome.ok, false, JSON.stringify(args));
      assert.equal(outcome.proposal, undefined);
      assert.match(JSON.parse(outcome.content).error as string, /^Tham số không hợp lệ/);
    }
  });

  it('định nghĩa gửi mô hình: tham số đóng cả ở việc con, không có trường id người', () => {
    const definition = ASSISTANT_TOOL_DEFINITIONS.find((item) => item.function.name === 'propose_task');
    assert.ok(definition);
    const parameters = definition.function.parameters as {
      additionalProperties: boolean;
      required: string[];
      properties: Record<string, { items?: { additionalProperties: boolean } }>;
    };
    assert.equal(parameters.additionalProperties, false);
    assert.deepEqual(parameters.required, ['title']);
    assert.equal(parameters.properties.subtasks.items?.additionalProperties, false);
    assert.equal(JSON.stringify(parameters).includes('Id'), false);
  });
});

describe('proposalHistoryNote: đề xuất đã soạn ghi vào lịch sử gửi mô hình', () => {
  it('không có đề xuất thì rỗng; tên dài cắt ở 120 ký tự, nhiệm vụ đã tạo chưa có mã vẫn ghi đã tạo', () => {
    assert.equal(proposalHistoryNote([]), '');
    const long = 'Đầu việc '.repeat(20).trim();
    const note = proposalHistoryNote([{ proposal: { title: long }, task: { id: 't-1', code: null }, dismissed: false }]);
    const line = note.split('\n')[1];
    assert.equal(line, `1. ${long.slice(0, 119)}… · đã tạo`);
  });
});
