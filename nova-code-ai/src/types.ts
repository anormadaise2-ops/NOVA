export type ProviderType = "ollama" | "openai-compatible" | "custom";

export interface ProviderConfig {
    id: string;
    name: string;
    type: ProviderType;
    baseUrl: string;
    model?: string;
    keyId?: string;
}

export interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
}

export interface AIProvider {
    readonly config: ProviderConfig;
    getModels(): Promise<string[]>;
    chat(messages: ChatMessage[], model?: string, signal?: AbortSignal): Promise<string>;
    streamChat(messages: ChatMessage[], onToken: (token: string) => void, model?: string, signal?: AbortSignal): Promise<void>;
    generate(prompt: string, model?: string, signal?: AbortSignal): Promise<string>;
    checkConnection(): Promise<boolean>;
}
