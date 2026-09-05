"use strict";

const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "database.json");
const VOICES_DIR = path.join(DATA_DIR, "voices");
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");
const sessions = new Map();

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

function applyConfiguredRoles() {
    const configured = new Map();
    for (const item of (process.env.NOVA_SUPPORT_USERS || "").split(",")) {
        const [username, role] = item.split(":").map(value => value && value.trim());
        if (username && ["support", "admin"].includes(role)) configured.set(username.toLowerCase(), role);
    }
    for (const user of db.users) {
        const role = configured.get(user.username.toLowerCase());
        if (role) user.role = role;
        else if (!user.role) user.role = "user";
    }
}

if (!fs.existsSync(VOICES_DIR)) {
    fs.mkdirSync(VOICES_DIR, { recursive: true });
}

if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(
        DB_FILE,
        JSON.stringify({
            users: [],
            messages: []
        }, null, 2)
    );
}

function loadDatabase() {
    try {
        return JSON.parse(
            fs.readFileSync(DB_FILE, "utf8")
        );
    } catch {
        return {
            users: [],
            messages: []
        };
    }
}

function saveDatabase(db) {
    fs.writeFileSync(
        DB_FILE,
        JSON.stringify(db, null, 2)
    );
}

let db = loadDatabase();
db.users = Array.isArray(db.users) ? db.users : [];
db.messages = Array.isArray(db.messages) ? db.messages : [];
db.supportTickets = Array.isArray(db.supportTickets) ? db.supportTickets : [];
db.supportMessages = Array.isArray(db.supportMessages) ? db.supportMessages : [];
db.notifications = Array.isArray(db.notifications) ? db.notifications : [];
db.callHistory = Array.isArray(db.callHistory) ? db.callHistory : [];
db.supportFaq = Array.isArray(db.supportFaq) ? db.supportFaq : defaultFaq();
applyConfiguredRoles();

app.use(express.json({ limit: "5mb" }));

const upload = multer({
    storage: multer.diskStorage({
        destination: VOICES_DIR,
        filename: (req, file, callback) => {
            callback(null, `${crypto.randomUUID()}.webm`);
        }
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, callback) => {
        const allowed = [
            "audio/webm",
            "audio/ogg",
            "audio/wav",
            "audio/mpeg",
            "audio/mp4"
        ];
        callback(null, allowed.includes(file.mimetype));
    }
});

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);

/* =========================
   API
========================= */

app.get("/api/status", (req, res) => {

    res.json({
        online: true,
        service: "NOVA",
        version: "1.0.0",
        users: db.users.length
    });

});

app.use("/api", (req, res, next) => {
    if (req.path === "/status" || req.path === "/register" || req.path === "/login" || req.path === "/session" || req.path === "/logout") {
        return next();
    }
    const username = getSessionUser(req);
    if (!username) {
        return res.status(401).json({ success: false, error: "Session requise." });
    }
    req.username = username;
    req.account = db.users.find(user => user.username === username) || null;
    next();
});

/* =========================
   CREATE ACCOUNT
========================= */

app.post("/api/register", async (req, res) => {

    try {

        const {
            username,
            phone,
            password
        } = req.body;

        if (
            typeof username !== "string" ||
            typeof phone !== "string" ||
            typeof password !== "string"
        ) {
            return res.status(400).json({
                success: false,
                error: "Données invalides."
            });
        }

        const cleanUsername =
            username.trim();

        const cleanPhone =
            phone.replace(/[^\d+]/g, "");

        if (cleanUsername.length < 2) {
            return res.status(400).json({
                success: false,
                error: "Pseudo trop court."
            });
        }

        if (cleanUsername.length > 24) {
            return res.status(400).json({
                success: false,
                error: "Pseudo trop long."
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                error: "Mot de passe trop court."
            });
        }

        const usernameExists =
            db.users.some(
                user =>
                    user.username.toLowerCase() ===
                    cleanUsername.toLowerCase()
            );

        if (usernameExists) {
            return res.status(409).json({
                success: false,
                error: "Ce pseudo existe déjà."
            });
        }

        const phoneExists =
            db.users.some(
                user =>
                    user.phone === cleanPhone
            );

        if (phoneExists) {
            return res.status(409).json({
                success: false,
                error: "Ce numéro possède déjà un compte."
            });
        }

        const passwordHash =
            await bcrypt.hash(password, 12);

        const user = {
            id: cryptoRandomId(),
            username: cleanUsername,
            phone: cleanPhone,
            role: "user",
            passwordHash,
            createdAt: Date.now()
        };

        db.users.push(user);

        saveDatabase(db);

        setSessionCookie(res, createSession(user.username));
        res.json({
            success: true,
            user: publicUser(user)
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            error: "Erreur serveur."
        });
    }

});

/* =========================
   LOGIN
========================= */

app.post("/api/login", async (req, res) => {

    try {

        const {
            user,
            password
        } = req.body;

        if (
            typeof user !== "string" ||
            typeof password !== "string"
        ) {
            return res.status(400).json({
                success: false,
                error: "Données invalides."
            });
        }

        const account =
            db.users.find(
                item =>
                    item.username.toLowerCase() ===
                    user.toLowerCase()
                    ||
                    item.phone === user
            );

        if (!account) {
            return res.status(401).json({
                success: false,
                error: "Identifiants incorrects."
            });
        }

        const valid =
            await bcrypt.compare(
                password,
                account.passwordHash
            );

        if (!valid) {
            return res.status(401).json({
                success: false,
                error: "Identifiants incorrects."
            });
        }

        setSessionCookie(res, createSession(account.username));
        res.json({
            success: true,
            user: publicUser(account)
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            error: "Erreur serveur."
        });

    }

});

app.get("/api/session", (req, res) => {
    const username = getSessionUser(req);
    if (!username) {
        return res.status(401).json({ success: false, error: "Session expirée." });
    }
    const user = publicUser(db.users.find(item => item.username === username));
    if (!user) {
        return res.status(401).json({ success: false, error: "Utilisateur introuvable." });
    }
    res.json({ success: true, user });
});

app.post("/api/logout", (req, res) => {
    const token = readCookie(req, "nova_session");
    if (token) sessions.delete(token);
    res.setHeader("Set-Cookie", "nova_session=; Max-Age=0; HttpOnly; Path=/; SameSite=Lax");
    res.json({ success: true });
});

/* =========================
   CONTACT SEARCH
========================= */

app.get("/api/users/:username", (req, res) => {

    const username =
        req.params.username;

    const user =
        db.users.find(
            item =>
                item.username.toLowerCase() ===
                username.toLowerCase()
        );

    if (!user) {
        return res.status(404).json({
            success: false,
            error: "Utilisateur introuvable."
        });

    }

    res.json({
        success: true,
        user: publicUser(user)
    });

});

const SUPPORT_CATEGORIES = [
    "Compte", "Connexion", "Mot de passe", "Messages", "Appels",
    "Notifications", "Sécurité", "Problème technique", "Bug", "Autre"
];
const SUPPORT_STATUSES = ["Ouvert", "En cours", "En attente", "Résolu", "Fermé"];

app.get("/api/support/faq", (req, res) => {
    res.json({ success: true, categories: SUPPORT_CATEGORIES, articles: db.supportFaq });
});

app.get("/api/notifications", (req, res) => {
    const notifications = db.notifications.filter(item => item.user === req.username).slice(-50);
    res.json({ success: true, notifications });
});

app.get("/api/support/search", (req, res) => {
    const query = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    if (query.length < 2) return res.json({ success: true, articles: [] });
    const articles = db.supportFaq.filter(article =>
        `${article.title} ${article.content} ${article.category}`.toLowerCase().includes(query)
    );
    res.json({ success: true, articles });
});

app.post("/api/support/tickets", (req, res) => {
    const category = typeof req.body.category === "string" ? req.body.category.trim() : "";
    const subject = typeof req.body.subject === "string" ? req.body.subject.trim() : "";
    const message = typeof req.body.message === "string" ? req.body.message.trim() : "";
    if (!SUPPORT_CATEGORIES.includes(category) || subject.length < 3 || subject.length > 120 || message.length < 5 || message.length > 4000) {
        return res.status(400).json({ success: false, error: "Données du ticket invalides." });
    }
    const recent = db.supportTickets.filter(ticket => ticket.user === req.username && Date.now() - ticket.createdAt < 60 * 60 * 1000);
    if (recent.length >= 5) return res.status(429).json({ success: false, error: "Trop de tickets récemment." });
    const ticket = {
        id: `NOVA-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`,
        user: req.username, category, subject, status: "Ouvert",
        createdAt: Date.now(), updatedAt: Date.now(), messages: []
    };
    ticket.messages.push({ id: cryptoRandomId(), author: req.username, body: message, internal: false, createdAt: Date.now() });
    db.supportTickets.push(ticket);
    saveDatabase(db);
    notifySupport(ticket, "support-ticket-created");
    res.status(201).json({ success: true, ticket: safeTicket(ticket, req.username, isSupport(req.account)) });
});

app.get("/api/support/tickets", (req, res) => {
    const tickets = db.supportTickets.filter(ticket => isSupport(req.account) || ticket.user === req.username)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map(ticket => safeTicket(ticket, req.username, isSupport(req.account)));
    res.json({ success: true, tickets });
});

app.get("/api/support/tickets/:id", (req, res) => {
    const ticket = db.supportTickets.find(item => item.id === req.params.id);
    if (!ticket || (!isSupport(req.account) && ticket.user !== req.username)) {
        return res.status(404).json({ success: false, error: "Ticket introuvable." });
    }
    res.json({ success: true, ticket: safeTicket(ticket, req.username, isSupport(req.account)) });
});

app.post("/api/support/tickets/:id/messages", (req, res) => {
    const ticket = db.supportTickets.find(item => item.id === req.params.id);
    if (!ticket || (!isSupport(req.account) && ticket.user !== req.username) || ticket.status === "Fermé") {
        return res.status(404).json({ success: false, error: "Ticket indisponible." });
    }
    const body = typeof req.body.body === "string" ? req.body.body.trim() : "";
    const internal = isSupport(req.account) && req.body.internal === true;
    if (body.length < 1 || body.length > 4000) return res.status(400).json({ success: false, error: "Message invalide." });
    const recent = ticket.messages.filter(item => item.author === req.username && Date.now() - item.createdAt < 60 * 60 * 1000);
    if (recent.length >= 30) return res.status(429).json({ success: false, error: "Trop de messages récemment." });
    const entry = { id: cryptoRandomId(), author: req.username, body, internal, createdAt: Date.now() };
    ticket.messages.push(entry);
    ticket.updatedAt = Date.now();
    if (isSupport(req.account) && !internal && ticket.status === "Ouvert") ticket.status = "En cours";
    saveDatabase(db);
    if (internal) return res.status(201).json({ success: true, message: entry });
    notifyTicket(ticket, "support-message", entry);
    res.status(201).json({ success: true, message: entry, ticket: safeTicket(ticket, req.username, isSupport(req.account)) });
});

app.patch("/api/support/tickets/:id", (req, res) => {
    if (!isSupport(req.account)) return res.status(403).json({ success: false, error: "Permission refusée." });
    const ticket = db.supportTickets.find(item => item.id === req.params.id);
    if (!ticket) return res.status(404).json({ success: false, error: "Ticket introuvable." });
    if (typeof req.body.status === "string" && SUPPORT_STATUSES.includes(req.body.status)) ticket.status = req.body.status;
    ticket.updatedAt = Date.now();
    saveDatabase(db);
    notifyTicket(ticket, "support-status", { status: ticket.status });
    res.json({ success: true, ticket: safeTicket(ticket, req.username, true) });
});

/* =========================
   MESSAGES
========================= */

app.get("/api/messages/:username", (req, res) => {

    const username =
        req.params.username;

    const messages =
        db.messages.filter(
            message =>
                message.from === username ||
                message.to === username
        );

    res.json({
        success: true,
        messages
    });
});

app.post("/api/voice", upload.single("audio"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: "Fichier audio invalide." });
    }
    const to = typeof req.body.to === "string" ? req.body.to.trim() : "";
    const recipient = db.users.find(user => user.username.toLowerCase() === to.toLowerCase());
    if (!recipient || recipient.username === req.username) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ success: false, error: "Destinataire invalide." });
    }
    const message = {
        id: cryptoRandomId(),
        from: req.username,
        to: recipient.username,
        type: "voice",
        audio: `/voices/${req.file.filename}`,
        date: Date.now()
    };
    db.messages.push(message);
    saveDatabase(db);
    res.json({ success: true, message });
});

app.use("/voices", express.static(VOICES_DIR, { fallthrough: false }));

/* =========================
   WEBSOCKET
========================= */

const onlineUsers = new Map();

wss.on("connection", (socket, request) => {

    console.log("NOVA: connexion WebSocket");

    socket.user = null;
    socket.request = request;

    socket.on("message", raw => {

        let data;

        try {
            data = JSON.parse(raw.toString());
        } catch {
            return;
        }

        /* IDENTIFICATION */

        if (data.type === "identify") {

            if (
                typeof data.username !== "string" ||
                !data.username.trim()
            ) {
                return;
            }

            const sessionUser = getSessionUserFromCookie(socket.request);
            if (!sessionUser || sessionUser.toLowerCase() !== data.username.trim().toLowerCase()) {
                send(socket, { type: "auth-error", error: "Session WebSocket invalide." });
                socket.close();
                return;
            }

            socket.user = sessionUser;

            onlineUsers.set(
                socket.user,
                socket
            );

            send(socket, {
                type: "identified",
                username: socket.user
            });

            broadcastPresence();

            return;
        }

        /* MESSAGE */

        if (data.type === "message") {

            if (!socket.user) {
                return;
            }

            const to =
                typeof data.to === "string"
                    ? data.to.trim()
                    : "";

            const text =
                typeof data.text === "string"
                    ? data.text.trim()
                    : "";

            if (!to || !text) {
                return;
            }

            if (data.type === "voice-message") {
                if (!socket.user || !data.message || data.message.from !== socket.user) return;
                const recipient = db.users.find(user => user.username === data.to);
                if (!recipient || data.message.to !== recipient.username) return;
                const receiver = onlineUsers.get(recipient.username);
                if (receiver) send(receiver, { type: "voice-message", message: data.message });
                send(socket, { type: "voice-message", message: data.message });
                return;
            }

            if (text.length > 2000) {
                return;
            }

            const message = {
                id: cryptoRandomId(),
                from: socket.user,
                to,
                text,
                date: Date.now()
            };

            db.messages.push(message);

            saveDatabase(db);

            const receiver =
                onlineUsers.get(to);

            if (receiver) {

                send(receiver, {
                    type: "message",
                    message
                });

            }

            send(socket, {
                type: "message",
                message
            });

            return;
        }

        /* APPEL */

        if (
            data.type === "call-offer" ||
            data.type === "call-answer" ||
            data.type === "ice-candidate" ||
            data.type === "call-end"
        ) {

            if (!socket.user) {
                return;
            }

            const receiver =
                onlineUsers.get(data.to);

            if (!receiver) {

                send(socket, {
                    type: "call-error",
                    error: "Utilisateur hors ligne."
                });

                return;
            }

            send(receiver, {
                ...data,
                from: socket.user
            });

            return;
        }

    });

    socket.on("close", () => {

        if (socket.user) {

            if (
                onlineUsers.get(socket.user) ===
                socket
            ) {
                onlineUsers.delete(
                    socket.user
                );
            }

            broadcastPresence();
        }

        console.log(
            "NOVA: WebSocket fermé"
        );
    });

});

function broadcastPresence() {

    const users =
        [...onlineUsers.keys()];

    for (const socket of wss.clients) {

        if (socket.readyState === WebSocket.OPEN) {

            send(socket, {
                type: "presence",
                users
            });

        }
    }
}

function send(socket, data) {

    if (
        socket &&
        socket.readyState === WebSocket.OPEN
    ) {
        socket.send(
            JSON.stringify(data)
        );
    }
}

function cryptoRandomId() {

    return (
        Date.now().toString(36) +
        Math.random()
            .toString(36)
            .slice(2, 10)
    );
}

/* =========================
   START
========================= */

server.listen(PORT, "0.0.0.0", () => {

    console.log("");
    console.log("================================");
    console.log("       NOVA BACKEND ONLINE");
    console.log("================================");
    console.log("");
    console.log(`Web      : listening on port ${PORT}`);
    console.log(`API      : /api/status on port ${PORT}`);
    console.log(`WebSocket: listening on port ${PORT}`);
    console.log("");
});

function publicUser(user) {
    if (!user) return null;
    return { id: user.id, username: user.username, phone: user.phone, role: user.role || "user", createdAt: user.createdAt };
}

function isSupport(user) {
    return Boolean(user && ["support", "admin"].includes(user.role));
}

function safeTicket(ticket, viewer, canModerate) {
    return {
        id: ticket.id,
        user: ticket.user,
        category: ticket.category,
        subject: ticket.subject,
        status: ticket.status,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        messages: ticket.messages.filter(message => canModerate || !message.internal)
    };
}

function notifyTicket(ticket, type, payload) {
    db.notifications.push({
        id: cryptoRandomId(),
        user: ticket.user,
        type,
        ticketId: ticket.id,
        createdAt: Date.now()
    });
    saveDatabase(db);
    const recipient = onlineUsers.get(ticket.user);
    if (recipient) send(recipient, { type, ticketId: ticket.id, ...payload });
}

function notifySupport(ticket, type) {
    for (const [username, socket] of onlineUsers) {
        const user = db.users.find(item => item.username === username);
        if (isSupport(user)) {
            db.notifications.push({
                id: cryptoRandomId(),
                user: username,
                type,
                ticketId: ticket.id,
                createdAt: Date.now()
            });
            send(socket, { type, ticketId: ticket.id });
        }
    }
    saveDatabase(db);
}

function defaultFaq() {
    return [
        { id: "account", category: "Compte", title: "Comment modifier mon compte ?", content: "Ouvre Réglages pour gérer les informations disponibles." },
        { id: "login", category: "Connexion", title: "Je ne peux pas me connecter", content: "Vérifie ton pseudo ou téléphone et ton mot de passe." },
        { id: "messages", category: "Messages", title: "Mes messages ne partent pas", content: "Vérifie la connexion NOVA et que le destinataire est disponible." },
        { id: "calls", category: "Appels", title: "Pourquoi un appel peut échouer ?", content: "WebRTC nécessite un microphone autorisé et une connexion compatible." },
        { id: "security", category: "Sécurité", title: "Mes données sont-elles protégées ?", content: "Les mots de passe sont hachés côté serveur et les réponses publiques excluent les secrets." }
    ];
}

function createSession(username) {
    const token = crypto.randomBytes(32).toString("hex");
    const signature = crypto.createHmac("sha256", SESSION_SECRET).update(token).digest("hex");
    const value = `${token}.${signature}`;
    sessions.set(value, username);
    return value;
}

function setSessionCookie(res, token) {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    res.setHeader("Set-Cookie", `nova_session=${token}; HttpOnly; Path=/; SameSite=Lax${secure}`);
}

function getSessionUser(req) {
    const token = readCookie(req, "nova_session");
    return token ? sessions.get(token) : null;
}

function getSessionUserFromCookie(request) {
    const header = request.headers.cookie || "";
    const token = header.split(";").map(value => value.trim()).find(value => value.startsWith("nova_session="));
    return token ? sessions.get(token.slice("nova_session=".length)) : null;
}

function readCookie(req, name) {
    const header = req.headers.cookie || "";
    const entry = header.split(";").map(value => value.trim()).find(value => value.startsWith(`${name}=`));
    return entry ? entry.slice(name.length + 1) : null;
}