import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";

/**
 * 使用 Qwen-VL 视觉模型从图片中提取文字
 * @param imageBase64 图片的 Base64 编码（不含 data: 前缀）
 * @param mimeType 图片 MIME 类型
 * @returns 提取的文字内容
 */
export async function extractTextFromImage(
  imageBase64: string,
  mimeType: string
): Promise<string> {
  const model = new ChatOpenAI({
    modelName: process.env.DASHSCOPE_VL_MODEL || "qwen-vl-plus",
    temperature: 0,
    configuration: {
      baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    },
  });

  const message = new HumanMessage({
    content: [
      {
        type: "text",
        text: "请仔细识别图片中的所有文字内容，包括标题、正文、表格、列表等。请按照原文的结构和格式输出，保持段落分隔。只输出识别到的文字，不要添加任何解释或说明。如果图片中没有文字，请回复「图片中未检测到文字内容」。",
      },
      {
        type: "image_url",
        image_url: {
          url: `data:${mimeType};base64,${imageBase64}`,
        },
      },
    ],
  });

  const response = await model.invoke([message]);
  return typeof response.content === "string"
    ? response.content
    : JSON.stringify(response.content);
}

/**
 * 判断文件是否为支持的图片格式
 */
export function isImageFile(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase();
  return ["jpg", "jpeg", "png", "webp", "bmp", "gif"].includes(ext || "");
}

/**
 * 获取图片的 MIME 类型
 */
export function getImageMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    bmp: "image/bmp",
    gif: "image/gif",
  };
  return mimeMap[ext || ""] || "image/png";
}
