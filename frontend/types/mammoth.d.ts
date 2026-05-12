declare module "mammoth/mammoth.browser" {
  interface ExtractResult {
    value: string;
    messages: unknown[];
  }
  export function extractRawText(input: {
    arrayBuffer: ArrayBuffer;
  }): Promise<ExtractResult>;
}
