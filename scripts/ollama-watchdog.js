const { spawn } = require("child_process");

const host = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
const executable = process.env.OLLAMA_BIN || "C:/Users/anorm/AppData/Local/Programs/Ollama/ollama.exe";
let child = null;

async function isHealthy() {
    try {
        const response = await fetch(`${host}/api/tags`);
        return response.ok;
    } catch {
        return false;
    }
}

async function ensureRunning() {
    if (await isHealthy()) return;
    if (child && !child.killed) return;
    child = spawn(executable, ["serve"], {
        detached: true,
        stdio: "ignore",
        windowsHide: true
    });
    child.unref();
}

ensureRunning().catch(() => {});
setInterval(() => ensureRunning().catch(() => {}), 10000);
