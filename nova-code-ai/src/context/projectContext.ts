import * as vscode from "vscode";
import * as path from "path";

export interface ProjectContext { files: Array<{ path: string; content: string }>; estimatedTokens: number; }

export class ProjectContextEngine {
    public async collect(document: vscode.TextDocument, selection: string, limit: number): Promise<ProjectContext> {
        const files: ProjectContext["files"] = [{ path: document.uri.fsPath, content: selection || document.getText().slice(0, limit * 4) }];
        const root = vscode.workspace.workspaceFolders?.[0];
        if (root) {
            const uris = await vscode.workspace.findFiles("**/*.{ts,js,py,rs,java,cs,cpp,html,css,json,md}", "**/{node_modules,.git,dist,build}/**", 8);
            for (const uri of uris.slice(0, 7)) {
                if (path.normalize(uri.fsPath) === path.normalize(document.uri.fsPath)) continue;
                const content = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri)).slice(0, 4000);
                files.push({ path: vscode.workspace.asRelativePath(uri), content });
            }
        }
        const estimatedTokens = Math.ceil(files.reduce((total, file) => total + file.content.length, 0) / 4);
        return { files, estimatedTokens };
    }
    public format(context: ProjectContext): string {
        return context.files.map(file => `\n--- ${file.path} ---\n${file.content}`).join("\n");
    }
}
