import { ChatOpenAI } from "@langchain/openai";
export class Model {
  private static instance: Model;
  private llmInstance: ChatOpenAI;
  private constructor() {
    this.llmInstance = new ChatOpenAI({
      model: "gemini-2.0-flash",
      configuration: {
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        apiKey: 'AIzaSyC9ye9FRdvK_xtDpuMRP2_pH1JS6yq7b9o',
      },
      streaming: false
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

