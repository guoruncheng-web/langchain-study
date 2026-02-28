import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { getUserFromRequest } from "@/lib/auth";
import { getSQL } from "@/lib/db";
import { getVectorStore } from "@/lib/rag";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: Request) {
  // 认证检查
  const payload = await getUserFromRequest();
  if (!payload) {
    return new Response(JSON.stringify({ success: false, error: "未登录" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
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
  const messages = body.messages
    .filter((m: { role: string }) => m.role === "user" || m.role === "assistant")
    .map((m: { role: string; content: string }) => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content.slice(0, 10000) : "",
    }));

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

    // 保存用户发送的最后一条消息
    const lastUserMessage = [...messages].reverse().find(
      (m: { role: string }) => m.role === "user"
    );
    if (lastUserMessage) {
      await sql`
        INSERT INTO messages (id, session_id, role, content)
        VALUES (${uuidv4()}, ${sessionId}, ${"user"}, ${lastUserMessage.content})
      `;
    }
  } catch (error) {
    console.error("保存消息到数据库失败:", error);
    // 会话创建失败时标记无效，避免后续保存消息时外键违反
    sessionValid = false;
  }

  // 初始化阿里云百炼平台模型
  const model = new ChatOpenAI({
    modelName: process.env.DASHSCOPE_MODEL || "qwen-plus",
    temperature: 0.7,
    streaming: true,
    configuration: {
      baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    },
  });

  // RAG 检索：基于用户最后一条消息搜索相关知识库文档
  let ragContext = "";
  try {
    const userQuery = [...messages].reverse().find(
      (m: { role: string }) => m.role === "user"
    )?.content;
    if (userQuery) {
      const vectorStore = await getVectorStore();
      const results = await vectorStore.similaritySearch(userQuery, 3, {
        userId: payload.userId,
      });
      if (results.length > 0) {
        ragContext = results.map((doc) => doc.pageContent).join("\n---\n");
      }
    }
  } catch (error) {
    console.error("RAG 检索失败（不影响聊天）:", error);
  }

  // 将消息转换为 LangChain 消息格式（仅 user/assistant）
  const langchainMessages = messages.map((msg: { role: string; content: string }) => {
    if (msg.role === "assistant") {
      return new AIMessage(msg.content);
    }
    return new HumanMessage(msg.content);
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
    },
  });

  return new Response(readableStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Session-Id": sessionId,
    },
  });
}
