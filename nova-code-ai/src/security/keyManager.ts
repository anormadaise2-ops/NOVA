import * as vscode from "vscode";

export class ApiKeyManager {
    public constructor(private readonly secrets: vscode.SecretStorage) {}

    public saveKey(keyId: string, value: string): Thenable<void> {
        if (!value.trim()) throw new Error("API key cannot be empty.");
        return this.secrets.store(keyId, value);
    }

    public getKey(keyId: string): Thenable<string | undefined> {
        return this.secrets.get(keyId);
    }

    public deleteKey(keyId: string): Thenable<void> {
        return this.secrets.delete(keyId);
    }

    public async hasKey(keyId: string): Promise<boolean> {
        return Boolean(await this.getKey(keyId));
    }
}
