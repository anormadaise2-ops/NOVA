module.exports = {
    apps: [
        {
            name: "nova-web",
            script: "./server.js",
            cwd: "C:/Users/anorm/OneDrive/Desktop/NOVA",
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: "300M",
            env: {
                NODE_ENV: "production",
                PORT: 3000
            }
        },
        {
            name: "nova-ollama",
            script: "./scripts/ollama-watchdog.js",
            autorestart: true,
            watch: false
        }
    ]
};
