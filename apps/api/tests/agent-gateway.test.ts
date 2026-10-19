import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "../src/server/api/errors";
import {
  callGateway,
  readGatewayConfig,
  toAssistantToolCallMessage,
  toTextOnlyMessages,
  type GatewayConfig,
  type GatewayMessage,
  type GatewayToolDefinition,
} from "../src/server/services/agent-gateway";
import { draftTaskWithAgent } from "../src/server/services/task-agent-service";

const realFetch = globalThis.fetch;
const enc = new TextEncoder();

// Cấu hình giả, không phải khóa thật: test không gọi gateway thật
const CONFIG: GatewayConfig = { baseUrl: "http://gateway.test/v1", apiKey: "test-key", model: "test-model", thinkingBudget: null };
const MESSAGES: GatewayMessage[] = [
  { role: "system", content: "Bạn là trợ lý." },
  { role: "user", content: "Việc tuần này?" },
];
const TOOL: GatewayToolDefinition = {
  type: "function",
  function: { name: "list_tasks", description: "Liệt kê nhiệm vụ", parameters: { type: "object", additionalProperties: false, properties: {} } },
};

const sse = (payload: unknown) => `data: ${JSON.stringify(payload)}\n\n`;

/** Gateway giả trả SSE, cắt theo từng `step` byte (cắt cả giữa dòng lẫn giữa ký tự tiếng Việt). */
function sseResponse(text: string, step = 17): Response {
  const bytes = enc.encode(text);
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += step) controller.enqueue(bytes.slice(i, i + step));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

/** Gateway treo: khúc đầu đến rồi không bao giờ kết thúc. */
function hangingResponse(): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(enc.encode(sse({ choices: [{ delta: { content: "Đang" } }] })));
    },
  });
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

interface SentRequest {
  url: string;
  body: Record<string, unknown>;
}

/** Thay `fetch` toàn cục, ghi lại mọi yêu cầu đã gửi tới gateway. */
function mockFetch(respond: () => Response): SentRequest[] {
  const sent: SentRequest[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    sent.push({ url: String(input), body: JSON.parse(String(init?.body)) as Record<string, unknown> });
    return respond();
  }) as typeof fetch;
  return sent;
}

/** Đặt biến môi trường trong lúc chạy (`undefined` = bỏ đi), rồi khôi phục. Giá trị giả, không in ra. */
async function withEnv(values: Record<string, string | undefined>, run: () => Promise<void>): Promise<void> {
  const saved = Object.keys(values).map((key) => [key, process.env[key]] as const);
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    await run();
  } finally {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const NO_GATEWAY_ENV = { TASK_AGENT_BASE_URL: undefined, TASK_AGENT_API_KEY: undefined, TASK_AGENT_MODEL: undefined };

describe("callGateway: đọc luồng SSE", () => {
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("tool_calls cắt nhỏ qua nhiều khúc được gom theo index, giữ extra_content và finish_reason", async () => {
    const text =
      sse({ choices: [{ delta: { reasoning_content: "Cần đọc việc. " } }] }) +
      sse({ choices: [{ delta: { content: "Để tôi xem" } }] }) +
      sse({ choices: [{ delta: { tool_calls: [{ index: 0, id: "call_1", function: { name: "list_t" }, extra_content: { google: { thought_signature: "sig-1" } } }] } }] }) +
      sse({ choices: [{ delta: { tool_calls: [{ index: 0, function: { name: "asks", arguments: '{"view":' } }] } }] }) +
      sse({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"related"}' } }, { index: 1, id: "call_2", function: { name: "my_inbox", arguments: "{}" } }] } }] }) +
      sse({ choices: [{ delta: {}, finish_reason: "tool_calls" }] }) +
      "data: [DONE]\n\n";
    mockFetch(() => sseResponse(text));

    const thinking: string[] = [];
    const content: string[] = [];
    const started: string[] = [];
    const result = await callGateway(MESSAGES, {
      config: CONFIG,
      tools: [TOOL],
      onThinking: (delta) => thinking.push(delta),
      onContent: (delta) => content.push(delta),
      onToolCallStart: (name) => started.push(name),
    });
    // Báo một lần cho mỗi lời gọi, khi tên đã đủ (tên tới thành hai khúc) và tham số bắt đầu tới
    assert.deepEqual(started, ["list_tasks", "my_inbox"]);

    assert.equal(thinking.join(""), "Cần đọc việc. ");
    assert.equal(content.join(""), "Để tôi xem");
    assert.equal(result.thinking, "Cần đọc việc. ");
    assert.equal(result.content, "Để tôi xem");
    assert.equal(result.finishReason, "tool_calls");
    assert.deepEqual(result.toolCalls, [
      { id: "call_1", name: "list_tasks", arguments: '{"view":"related"}', extraContent: { google: { thought_signature: "sig-1" } } },
      { id: "call_2", name: "my_inbox", arguments: "{}" },
    ]);
  });

  test("HTTP lỗi thành ApiError 502 kèm mã trạng thái", async () => {
    mockFetch(() => new Response("lỗi", { status: 500 }));
    await assert.rejects(
      () => callGateway(MESSAGES, { config: CONFIG }),
      (e: unknown) =>
        e instanceof ApiError && e.statusCode === 502 && e.code === "AGENT_UNAVAILABLE" && e.message === "Agent trả lỗi (500). Thầy/Cô thử lại sau.",
    );
  });

  test("gateway chặn vì mô hình gọi công cụ không khai báo: mã AGENT_TOOL_CONTRACT, câu lỗi giữ nguyên", async () => {
    const body = JSON.stringify({ error: { message: "Tool contract violation: upstream called an undeclared tool", type: "tool_contract_error" } });
    mockFetch(() => new Response(body, { status: 502, headers: { "content-type": "application/json" } }));
    await assert.rejects(
      () => callGateway(MESSAGES, { config: CONFIG, subject: "Trợ lý" }),
      (e: unknown) =>
        e instanceof ApiError && e.statusCode === 502 && e.code === "AGENT_TOOL_CONTRACT" && e.message === "Trợ lý trả lỗi (502). Thầy/Cô thử lại sau.",
    );
  });

  test("không kết nối được thì 502; câu lỗi dùng tên người gọi (Trợ lý)", async () => {
    globalThis.fetch = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    await assert.rejects(
      () => callGateway(MESSAGES, { config: CONFIG }),
      (e: unknown) => e instanceof ApiError && e.statusCode === 502 && e.message === "Chưa kết nối được tới Agent. Thầy/Cô thử lại sau.",
    );
    await assert.rejects(
      () => callGateway(MESSAGES, { config: CONFIG, subject: "Trợ lý" }),
      (e: unknown) => e instanceof ApiError && e.statusCode === 502 && e.message === "Chưa kết nối được tới Trợ lý. Thầy/Cô thử lại sau.",
    );
  });

  test("gateway treo giữa phần trả lời: quá giờ thì 504 AGENT_TIMEOUT, không chờ mãi", async () => {
    // Mock không tôn trọng `signal`: chỉ việc hủy nội bộ mới dừng được lần đọc đang treo
    mockFetch(() => hangingResponse());
    await assert.rejects(
      () => callGateway(MESSAGES, { config: CONFIG, timeoutMs: 30 }),
      (e: unknown) =>
        e instanceof ApiError &&
        e.statusCode === 504 &&
        e.code === "AGENT_TIMEOUT" &&
        e.message === "Agent phản hồi quá lâu. Thầy/Cô thử lại sau ít phút.",
    );
  });

  test("gateway đứt giữa chừng: 502 đúng câu, phần chữ đã nhận vẫn qua onContent", async () => {
    // Chỉ đóng luồng sau khi khúc đầu đã được đọc (pull chạy khi hàng đợi trống)
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(enc.encode(sse({ choices: [{ delta: { content: "Một phần" } }] })));
      },
      pull(controller) {
        controller.error(new TypeError("socket closed"));
      },
    });
    mockFetch(() => new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } }));
    const content: string[] = [];
    await assert.rejects(
      () => callGateway(MESSAGES, { config: CONFIG, onContent: (delta) => content.push(delta) }),
      (e: unknown) =>
        e instanceof ApiError && e.statusCode === 502 && e.message === "Mất kết nối với Agent giữa chừng. Thầy/Cô thử lại.",
    );
    assert.equal(content.join(""), "Một phần");
  });

  test("gateway báo lỗi bằng khóa error giữa luồng: 502 AGENT_UNAVAILABLE, không đọc tiếp, phần chữ đã nhận vẫn qua onContent", async () => {
    const text =
      sse({ choices: [{ delta: { content: "Một phần" } }] }) +
      sse({ error: { message: "upstream quá tải", type: "server_error" } }) +
      sse({ choices: [{ delta: { content: " tiếp" } }] }) +
      "data: [DONE]\n\n";
    mockFetch(() => sseResponse(text));
    const content: string[] = [];
    await assert.rejects(
      () => callGateway(MESSAGES, { config: CONFIG, subject: "Trợ lý", onContent: (delta) => content.push(delta) }),
      (e: unknown) =>
        e instanceof ApiError &&
        e.statusCode === 502 &&
        e.code === "AGENT_UNAVAILABLE" &&
        e.message === "Trợ lý trả lỗi giữa chừng. Thầy/Cô thử lại sau.",
    );
    assert.equal(content.join(""), "Một phần");
  });

  test("khối tool call không có tên bị bỏ; tham số rỗng thành \"{}\" và echo lại vẫn là JSON hợp lệ", async () => {
    const text =
      sse({ choices: [{ delta: { tool_calls: [{ index: 0 }] } }] }) +
      sse({ choices: [{ delta: { tool_calls: [{ index: 1, id: "call_3", type: "function", function: { name: "my_inbox" } }] } }] }) +
      sse({ choices: [{ delta: {}, finish_reason: "tool_calls" }] }) +
      "data: [DONE]\n\n";
    mockFetch(() => sseResponse(text));

    const result = await callGateway(MESSAGES, { config: CONFIG, tools: [TOOL] });

    assert.deepEqual(result.toolCalls, [{ id: "call_3", name: "my_inbox", arguments: "{}" }]);
    const echo = toAssistantToolCallMessage("", result.toolCalls);
    assert.deepEqual(echo, {
      role: "assistant",
      content: null,
      tool_calls: [{ id: "call_3", type: "function", function: { name: "my_inbox", arguments: "{}" } }],
    });
  });

  test("người gọi hủy giữa chừng thì dừng ngay với 502, không thành 504", async () => {
    mockFetch(() => hangingResponse());
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 20);
    await assert.rejects(
      () => callGateway(MESSAGES, { config: CONFIG, signal: controller.signal, timeoutMs: 5_000 }),
      (e: unknown) => e instanceof ApiError && e.statusCode === 502,
    );
  });

  test("signal đã hủy trước khi gọi thì không chờ phần trả lời", async () => {
    mockFetch(() => hangingResponse());
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      () => callGateway(MESSAGES, { config: CONFIG, signal: controller.signal, timeoutMs: 5_000 }),
      (e: unknown) => e instanceof ApiError && e.statusCode === 502,
    );
  });
});

describe("callGateway: khối JSON (gateway không stream)", () => {
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("đọc message.tool_calls kèm extra_content, finish_reason; suy nghĩ qua onThinking, chữ rỗng không gọi onContent", async () => {
    mockFetch(
      () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                finish_reason: "tool_calls",
                message: {
                  content: "",
                  reasoning_content: "Tra việc.",
                  tool_calls: [
                    { id: "call_9", type: "function", function: { name: "get_task", arguments: '{"code":"NV-1"}' }, extra_content: { google: { thought_signature: "sig-9" } } },
                  ],
                },
              },
            ],
          }),
          { headers: { "content-type": "application/json" } },
        ),
    );

    const thinking: string[] = [];
    const content: string[] = [];
    const started: string[] = [];
    const result = await callGateway(MESSAGES, {
      config: CONFIG,
      tools: [TOOL],
      onThinking: (delta) => thinking.push(delta),
      onContent: (delta) => content.push(delta),
      onToolCallStart: (name) => started.push(name),
    });
    // Gateway không stream: báo lúc đọc xong khối JSON
    assert.deepEqual(started, ["get_task"]);

    assert.deepEqual(result, {
      content: "",
      thinking: "Tra việc.",
      toolCalls: [{ id: "call_9", name: "get_task", arguments: '{"code":"NV-1"}', extraContent: { google: { thought_signature: "sig-9" } } }],
      finishReason: "tool_calls",
    });
    assert.deepEqual(thinking, ["Tra việc."]);
    assert.deepEqual(content, []);
  });

  test("khối JSON mang khóa error thì 502 AGENT_UNAVAILABLE, không coi là trả lời rỗng", async () => {
    mockFetch(() => new Response(JSON.stringify({ error: { message: "quá tải" } }), { headers: { "content-type": "application/json" } }));
    await assert.rejects(
      () => callGateway(MESSAGES, { config: CONFIG, subject: "Trợ lý" }),
      (e: unknown) => e instanceof ApiError && e.statusCode === 502 && e.code === "AGENT_UNAVAILABLE",
    );
  });
});

describe("callGateway: khối JSON treo", () => {
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("khối JSON không bao giờ đọc xong thì 504 AGENT_TIMEOUT, không chờ mãi", async () => {
    mockFetch(() => new Response(new ReadableStream<Uint8Array>({ start() {} }), { headers: { "content-type": "application/json" } }));
    await assert.rejects(
      () => callGateway(MESSAGES, { config: CONFIG, timeoutMs: 30 }),
      (e: unknown) => e instanceof ApiError && e.statusCode === 504 && e.code === "AGENT_TIMEOUT",
    );
  });
});

describe("callGateway: thân yêu cầu", () => {
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("có tools khi truyền, không có khi không truyền hoặc mảng rỗng; không gửi tool_choice; ngân sách suy nghĩ giữ cách cũ", async () => {
    const sent = mockFetch(() => sseResponse(sse({ choices: [{ delta: { content: "ok" } }] }) + "data: [DONE]\n\n"));
    await callGateway(MESSAGES, { config: CONFIG, tools: [TOOL] });
    await callGateway(MESSAGES, { config: CONFIG });
    await callGateway(MESSAGES, { config: CONFIG, tools: [] });
    await callGateway(MESSAGES, { config: { ...CONFIG, thinkingBudget: 2048 } });

    assert.equal(sent[0].url, "http://gateway.test/v1/chat/completions");
    assert.equal(sent[0].body.stream, true);
    assert.deepEqual(sent[0].body.tools, [TOOL]);
    assert.equal(sent[0].body.reasoning_effort, "low");
    assert.equal(sent[0].body.max_tokens, 1200);
    assert.equal("tools" in sent[1].body, false);
    assert.equal("tools" in sent[2].body, false);
    assert.equal(
      sent.some((request) => "tool_choice" in request.body),
      false,
    );
    assert.deepEqual(sent[3].body.thinking, { type: "enabled", budget_tokens: 2048 });
    assert.equal(sent[3].body.max_tokens, 5048);
    assert.equal("reasoning_effort" in sent[3].body, false);
  });

  test("outputTokens thay phần trả lời ngoài ngân sách suy nghĩ (Trợ lý soạn kế hoạch nhiều đề xuất)", async () => {
    const sent = mockFetch(() => sseResponse(sse({ choices: [{ delta: { content: "ok" } }] }) + "data: [DONE]\n\n"));
    await callGateway(MESSAGES, { config: { ...CONFIG, thinkingBudget: 2048 }, outputTokens: 12_000 });
    await callGateway(MESSAGES, { config: CONFIG, outputTokens: 12_000 });
    assert.equal(sent[0].body.max_tokens, 14_048);
    assert.equal(sent[1].body.max_tokens, 12_000);
  });
});

describe("draftTaskWithAgent: giữ hành vi cũ khi chuyển sang callGateway", () => {
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("gửi tin kèm ảnh qua gateway, đọc JSON trả lời và suy nghĩ đã cắt khoảng trắng", async () => {
    await withEnv(
      { TASK_AGENT_BASE_URL: "http://gateway.test/v1", TASK_AGENT_API_KEY: "test-key", TASK_AGENT_MODEL: "test-model", TASK_AGENT_THINKING_BUDGET: undefined },
      async () => {
        const sent = mockFetch(() =>
          sseResponse(
            sse({ choices: [{ delta: { reasoning_content: "  Suy nghĩ.  " } }] }) +
              sse({ choices: [{ delta: { content: '{"reply":"Đã điền.","draft":{"title":"Chuẩn bị hội nghị"}}' } }] }) +
              "data: [DONE]\n\n",
          ),
        );
        const image = { type: "image_url" as const, image_url: { url: "data:image/png;base64,AAAA" } };
        const result = await draftTaskWithAgent(
          { today: "2026-10-16", departmentName: "Trung tâm Số", personnel: [], draft: {} },
          [{ role: "user", content: "Soạn từ ảnh" }],
          { attachments: new Map([[0, [image]]]) },
        );

        assert.deepEqual(result, { reply: "Đã điền.", draft: { title: "Chuẩn bị hội nghị" }, thinking: "Suy nghĩ." });
        const messages = sent[0].body.messages as Array<{ role: string; content: unknown }>;
        assert.equal(messages[0].role, "system");
        assert.deepEqual(messages[1], { role: "user", content: [{ type: "text", text: "Soạn từ ảnh" }, image] });
        assert.equal("tools" in sent[0].body, false);
      },
    );
  });
});

describe("cấu hình và tin nhắn gateway", () => {
  test("thiếu cấu hình thì 503 với câu lỗi mặc định hoặc theo tên người gọi", async () => {
    await withEnv(NO_GATEWAY_ENV, async () => {
      assert.throws(
        () => readGatewayConfig(),
        (e: unknown) =>
          e instanceof ApiError && e.statusCode === 503 && e.code === "AGENT_NOT_CONFIGURED" && e.message === "Agent soạn nhiệm vụ chưa được cấu hình trên máy chủ.",
      );
      await assert.rejects(
        () => callGateway(MESSAGES, { subject: "Trợ lý" }),
        (e: unknown) => e instanceof ApiError && e.statusCode === 503 && e.message === "Trợ lý chưa được cấu hình trên máy chủ.",
      );
    });
  });

  test("readGatewayConfig: bỏ dấu / cuối của base URL; ngân sách suy nghĩ dưới 1024 thì tắt", async () => {
    await withEnv(
      { TASK_AGENT_BASE_URL: "http://gateway.test/v1//", TASK_AGENT_API_KEY: "test-key", TASK_AGENT_MODEL: "test-model", TASK_AGENT_THINKING_BUDGET: "1023" },
      async () => {
        assert.deepEqual(readGatewayConfig(), {
          baseUrl: "http://gateway.test/v1",
          apiKey: "test-key",
          model: "test-model",
          thinkingBudget: null,
        });
        process.env.TASK_AGENT_THINKING_BUDGET = "4096";
        assert.equal(readGatewayConfig().thinkingBudget, 4096);
      },
    );
  });

  test("toAssistantToolCallMessage giữ extra_content, content rỗng thành null, không gắn extra_content khi không có", () => {
    const msg = toAssistantToolCallMessage("", [
      { id: "call_1", name: "get_task", arguments: '{"code":"NV-1"}', extraContent: { google: { thought_signature: "sig-1" } } },
      { id: "call_2", name: "my_inbox", arguments: "{}" },
    ]);
    assert.deepEqual(msg, {
      role: "assistant",
      content: null,
      tool_calls: [
        { id: "call_1", type: "function", function: { name: "get_task", arguments: '{"code":"NV-1"}' }, extra_content: { google: { thought_signature: "sig-1" } } },
        { id: "call_2", type: "function", function: { name: "my_inbox", arguments: "{}" } },
      ],
    });
    assert.deepEqual(toAssistantToolCallMessage("Đang đọc việc.", []), { role: "assistant", content: "Đang đọc việc." });
  });
});

describe("toTextOnlyMessages: lịch sử chữ thuần cho vòng không công cụ", () => {
  const history: GatewayMessage[] = [
    { role: "system", content: "Quy tắc." },
    { role: "user", content: "Việc tuần này?" },
    toAssistantToolCallMessage("Để tôi xem.", [
      { id: "call_1", name: "list_tasks", arguments: "{}", extraContent: { google: { thought_signature: "sig" } } },
      { id: "call_2", name: "my_inbox", arguments: "{}" },
    ]),
    { role: "tool", tool_call_id: "call_1", content: '{"tasks":[1]}' },
    { role: "tool", tool_call_id: "call_2", content: '{"items":[]}' },
    toAssistantToolCallMessage("", [{ id: "call_3", name: "get_task", arguments: '{"id":"t1"}' }]),
    { role: "tool", tool_call_id: "call_3", content: '{"task":"t1"}' },
  ];

  test("bỏ cấu trúc tool call, gom kết quả liền nhau thành một tin có rào dữ liệu, thêm lời nhắc ở cuối", () => {
    const out = toTextOnlyMessages(history, "Trả lời ngay.");
    assert.equal(out.some((m) => m.role === "tool"), false);
    assert.equal(out.some((m) => m.role === "assistant" && "tool_calls" in m), false);
    assert.equal(JSON.stringify(out).includes("thought_signature"), false);
    assert.deepEqual(
      out.map((m) => m.role),
      ["system", "user", "assistant", "user", "user", "user"],
    );
    assert.deepEqual(out[2], { role: "assistant", content: "Để tôi xem." });
    const firstResults = out[3].content as string;
    assert.ok(firstResults.includes("<ket_qua_cong_cu>") && firstResults.includes("</ket_qua_cong_cu>"));
    assert.ok(firstResults.includes('[list_tasks]\n{"tasks":[1]}') && firstResults.includes('[my_inbox]\n{"items":[]}'));
    assert.ok((out[4].content as string).includes('[get_task]\n{"task":"t1"}'));
    assert.deepEqual(out[5], { role: "user", content: "Trả lời ngay." });
  });

  test("không có tool call thì giữ nguyên và chỉ thêm lời nhắc; không đổi mảng gốc", () => {
    const plain: GatewayMessage[] = [{ role: "user", content: "Chào" }];
    assert.deepEqual(toTextOnlyMessages(plain, "Trả lời ngay."), [plain[0], { role: "user", content: "Trả lời ngay." }]);
    assert.equal(plain.length, 1);
    assert.equal(history.length, 7);
  });
});
