import { ChatOpenAI } from "@langchain/openai";
export class Model {
  private static instance: Model;
  private llmInstance: ChatOpenAI;
  private constructor() {
    this.llmInstance = new ChatOpenAI({
      model: "llama-3.3-70b-versatile",
      configuration: {
        baseURL: 'https://api.groq.com/openai/v1',
        apiKey: process.env.GROQ_API_KEY!,
      },
      streaming: false,
      timeout: 30000,
    });
  }

  public static getInstance(): Model {
    if (!Model.instance) {
      Model.instance = new Model();
    }
    return Model.instance;
  }

  public getChatInstance(): ChatOpenAI {
    return this.llmInstance;
  }
}

