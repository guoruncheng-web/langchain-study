import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";

export async function POST(req: Request) {
  const { messages } = await req.json();

  // 初始化阿里云百炼平台模型
  const model = new ChatOpenAI({
    modelName: process.env.DASHSCOPE_MODEL || "qwen-plus",
    temperature: 0.7,
    streaming: true,
    configuration: {
      baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    },
  });

  // 将消息转换为 LangChain 消息格式
  const langchainMessages = messages.map((msg: { role: string; content: string }) => {
    if (msg.role === "user") {
      return new HumanMessage(msg.content);
    } else if (msg.role === "assistant") {
      return new AIMessage(msg.content);
    } else {
      return new SystemMessage(msg.content);
    }
  });

  // 使用 LangChain 的流式响应
  const stream = await model.stream(langchainMessages);

  // 创建一个 ReadableStream 来处理流式响应
  const encoder = new TextEncoder();
  const readableStream = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        // 处理 content 可能是 string 或 array 的情况
        const content = typeof chunk.content === "string"
          ? chunk.content
          : JSON.stringify(chunk.content);
        controller.enqueue(encoder.encode(content));
      }
      controller.close();
    },
  });

  return new Response(readableStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
