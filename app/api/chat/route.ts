import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage, SystemMessage, type BaseMessage } from "@langchain/core/messages";
import { getUserFromRequest } from "@/lib/auth";
import { getSQL } from "@/lib/db";
import { getVectorStore } from "@/lib/rag";
import { v4 as uuidv4 } from "uuid";

interface MessageContent {
  type: string;
  text?: string;
  image_url?: { url: string };
}

interface ChatMessage {
  role: string;
  content: string | MessageContent[];
}

export async function POST(req: Request) {
  // 认证检查
  const payload = await getUserFromRequest();
  if (!payload) {
    return new Response(JSON.stringify({ success: false, error: "未登录" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 非 admin 用户检查 token 额度（按天重置）
  if (payload.role !== "admin") {
    const sql0 = getSQL();
    // 如果 token_reset_date 不是今天，自动重置用量
    await sql0`
      UPDATE users SET token_used = 0, token_reset_date = CURRENT_DATE
      WHERE id = ${payload.userId} AND (token_reset_date IS NULL OR token_reset_date < CURRENT_DATE)
    `;
    const quotaRows = await sql0`
      SELECT COALESCE(token_limit, 10000) AS token_limit, COALESCE(token_used, 0) AS token_used
      FROM users WHERE id = ${payload.userId}
    `;
    if (quotaRows.length > 0) {
      const { token_limit, token_used } = quotaRows[0];
      if (token_used >= token_limit) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "今日 Token 用量已达上限，明天将自动重置",
            tokenUsed: token_used,
            tokenLimit: token_limit,
          }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        );
      }
    }
  }

  const body = await req.json();
  const { sessionId: inputSessionId } = body;

  // 校验 messages 输入
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return new Response(
      JSON.stringify({ success: false, error: "messages 不能为空" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // 只允许 user 和 assistant 角色，过滤掉 system 消息防止提示词注入
  // 支持多模态消息（文字+图片）
  const messages: ChatMessage[] = body.messages
    .filter((m: { role: string }) => m.role === "user" || m.role === "assistant")
    .map((m: ChatMessage) => {
      if (typeof m.content === "string") {
        return { role: m.role, content: m.content.slice(0, 10000) };
      }
      // 多模态消息：保留 text 和 image_url 类型
      if (Array.isArray(m.content)) {
        const filtered = m.content
          .filter((c: MessageContent) => c.type === "text" || c.type === "image_url")
          .map((c: MessageContent) => {
            if (c.type === "text") return { type: "text", text: (c.text || "").slice(0, 10000) };
            if (c.type === "image_url" && c.image_url?.url) return { type: "image_url", image_url: { url: c.image_url.url } };
            return null;
          })
          .filter(Boolean);
        return { role: m.role, content: filtered as MessageContent[] };
      }
      return { role: m.role, content: "" };
    });

  if (messages.length === 0) {
    return new Response(
      JSON.stringify({ success: false, error: "没有有效的消息" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const sql = getSQL();

  // 确定会话 ID（不传则创建新会话）
  let sessionId = inputSessionId;
  // 标记会话是否在数据库中有效（用于决定是否保存消息）
  let sessionValid = !!inputSessionId;

  try {
    if (!sessionId) {
      // 创建新的聊天会话
      sessionId = uuidv4();
      const lastUserMsg = [...messages].reverse().find(
        (m: { role: string }) => m.role === "user"
      );
      const title = lastUserMsg
        ? lastUserMsg.content.slice(0, 30)
        : "新对话";

      await sql`
        INSERT INTO chat_sessions (id, user_id, title)
        VALUES (${sessionId}, ${payload.userId}, ${title})
      `;
      sessionValid = true;
    } else {
      // 验证会话归属权并更新最后活跃时间
      const ownerCheck = await sql`
        UPDATE chat_sessions SET updated_at = NOW()
        WHERE id = ${sessionId} AND user_id = ${payload.userId}
        RETURNING id
      `;
      if (ownerCheck.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: "会话不存在或无权访问" }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // 保存用户发送的最后一条消息（多模态消息只保存文本部分，标记含图片）
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMessage) {
      const textContent = extractTextContent(lastUserMessage);
      const hasImg = Array.isArray(lastUserMessage.content) &&
        lastUserMessage.content.some((c) => c.type === "image_url");
      const savedContent = hasImg ? `[图片] ${textContent}` : textContent;
      await sql`
        INSERT INTO messages (id, session_id, role, content)
        VALUES (${uuidv4()}, ${sessionId}, ${"user"}, ${savedContent})
      `;
    }
  } catch (error) {
    console.error("保存消息到数据库失败:", error);
    // 会话创建失败时标记无效，避免后续保存消息时外键违反
    sessionValid = false;
  }

  // 检测消息中是否包含图片（决定是否使用 VL 模型）
  const hasImage = messages.some(
    (m) => Array.isArray(m.content) && m.content.some((c) => c.type === "image_url")
  );

  // 初始化阿里云百炼平台模型（有图片时自动切换到 VL 模型）
  const model = new ChatOpenAI({
    modelName: hasImage
      ? (process.env.DASHSCOPE_VL_MODEL || "qwen-vl-plus")
      : (process.env.DASHSCOPE_MODEL || "qwen-plus"),
    temperature: 0.7,
    streaming: true,
    streamUsage: true,
    configuration: {
      baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    },
  });

  // 提取最后一条用户消息的纯文本（用于 RAG 检索和持久化）
  function extractTextContent(msg: ChatMessage): string {
    if (typeof msg.content === "string") return msg.content;
    if (Array.isArray(msg.content)) {
      return msg.content
        .filter((c) => c.type === "text")
        .map((c) => c.text || "")
        .join(" ");
    }
    return "";
  }

  // RAG 检索：基于用户最后一条消息搜索相关知识库文档
  let ragContext = "";
  try {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    const userQuery = lastUserMsg ? extractTextContent(lastUserMsg) : "";
    if (userQuery) {
      const vectorStore = await getVectorStore();
      const results = await vectorStore.similaritySearch(userQuery, 3);
      if (results.length > 0) {
        ragContext = results.map((doc) => doc.pageContent).join("\n---\n");
      }
    }
  } catch (error) {
    console.error("RAG 检索失败（不影响聊天）:", error);
  }

  // 将消息转换为 LangChain 消息格式（支持多模态）
  const langchainMessages = messages.map((msg) => {
    if (msg.role === "assistant") {
      return new AIMessage(typeof msg.content === "string" ? msg.content : extractTextContent(msg));
    }
    // user 消息：支持文本和图片混合
    if (Array.isArray(msg.content)) {
      return new HumanMessage({ content: msg.content as Array<{ type: string; text?: string; image_url?: { url: string } }> });
    }
    return new HumanMessage(typeof msg.content === "string" ? msg.content : "");
  });

  // 如果有 RAG 检索结果，在消息头部插入系统提示
  if (ragContext) {
    langchainMessages.unshift(
      new SystemMessage(
        `你是一个AI客服助手。请根据以下参考资料回答用户的问题。如果参考资料中没有相关信息，请根据自身知识回答。\n\n参考资料：\n${ragContext}`
      )
    );
  }

  // 使用 LangChain 的流式响应
  const stream = await model.stream(langchainMessages);

  // 收集完整的 AI 回复，用于流式结束后保存到数据库
  let fullAiResponse = "";
  // 记录本次请求消耗的 token 总量
  let totalTokens = 0;

  // 创建一个 ReadableStream 来处理流式响应
  const encoder = new TextEncoder();
  const readableStream = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const content = typeof chunk.content === "string"
          ? chunk.content
          : JSON.stringify(chunk.content);
        fullAiResponse += content;
        controller.enqueue(encoder.encode(content));

        // 从流式 chunk 中提取 token 使用量（最后一个 chunk 包含完整统计）
        if (chunk.usage_metadata) {
          totalTokens = chunk.usage_metadata.total_tokens || 0;
        }
      }
      controller.close();

      // 流式响应结束后，将 AI 回复保存到数据库（仅当会话有效时）
      if (sessionValid) {
        try {
          const saveSql = getSQL();
          await saveSql`
            INSERT INTO messages (id, session_id, role, content)
            VALUES (${uuidv4()}, ${sessionId}, ${"assistant"}, ${fullAiResponse})
          `;
        } catch (error) {
          console.error("保存 AI 回复到数据库失败:", error);
        }
      }

      // 非 admin 用户：累加实际消耗的 token 数量（拿不到时按字符数估算，中文约 1.5 token/字）
      if (payload.role !== "admin") {
        if (totalTokens === 0) {
          const inputText = langchainMessages.map((m: BaseMessage) => typeof m.content === "string" ? m.content : "").join("");
          totalTokens = Math.ceil((inputText.length + fullAiResponse.length) * 1.5);
        }
        if (totalTokens > 0) {
          try {
            const usageSql = getSQL();
            await usageSql`
              UPDATE users SET token_used = COALESCE(token_used, 0) + ${totalTokens} WHERE id = ${payload.userId}
            `;
          } catch (error) {
            console.error("更新 token 用量失败:", error);
          }
        }
      }
    },
  });

  return new Response(readableStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Session-Id": sessionId,
    },
  });
}
