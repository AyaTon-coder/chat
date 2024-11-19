const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const os = require("os");
const fs = require("fs");
const { loadBackup, saveBackup } = require("./backup");

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

// 永続化ファイルのパス
const PASSWORD_FILE_PATH = path.join(__dirname, "passwords.json");

// ルームごとのパスワードを管理するオブジェクト
let PASSWORDS = loadPasswords();
let messageHistories = {};

// ルームのメッセージ履歴をロード
Object.keys(PASSWORDS).forEach((room) => {
  messageHistories[room] = loadBackup(room) || [];
});

const app = express();
const server = http.createServer(app);
// Socket.IOサーバーを初期化し、pingIntervalとpingTimeoutを設定
const io = new Server(server, {
  pingInterval: 25000, // 25秒ごとにpingをクライアントに送る
  pingTimeout: 1800000, // クライアントが60秒以内に応答しなければタイムアウト
  cookie: false, // クライアントにcookieを送信しない
});

// Socket.IOサーバーを初期化し、pingIntervalとpingTimeoutを設定

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// パスワードを追加するエンドポイント
app.post("/add-password", (req, res) => {
  const { room, password } = req.body;
  if (room) {
    PASSWORDS[room] = password || null; // パスワードがない場合はnull
    messageHistories[room] = loadBackup(room) || [];
    savePasswords(); // パスワードを保存
    res.status(200).json({ success: true });
  } else {
    res
      .status(400)
      .json({ success: false, message: "Invalid room or password" });
  }
});

io.on("connection", (socket) => {
  console.log(`Client connected from IP: ${socket.handshake.address}`);

  socket.on("authenticate", ({ room, password }, callback) => {
    if (PASSWORDS[room] === password) {
      socket.join(room);
      socket.emit("authenticated", { success: true, room });
      socket.emit(
        "history",
        messageHistories[room].map((msg) => JSON.stringify(msg))
      ); // 修正: 履歴を送信する
      io.to(socket.id).emit("connectid", socket.id);
      if (typeof callback === "function") {
        callback({ status: "ok" });
      }
    } else {
      socket.emit("authenticated", { success: false });
      if (typeof callback === "function") {
        callback({ status: "error", message: "Authentication failed" });
      }
    }
  });

  socket.on("message", (data, callback) => {
    const { room, messageData } = data;
    if (messageHistories[room]) {
      messageHistories[room].push(messageData);
      io.to(room).emit("message", JSON.stringify(messageData));
      if (typeof callback === "function") {
        callback({ status: "ok" }); // メッセージを受け取ったことをクライアントに通知
      }
    } else {
      if (typeof callback === "function") {
        callback({ status: "error", message: "Room not found" });
      }
    }
  });

  socket.on("leaveRoom", () => {
    // ルームを離れる処理を追加（必要に応じて）
    console.log(`Client left the room`);
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected from IP: ${socket.handshake.address}`);
  });

  // Ping/Pongメカニズムの実装
  socket.on("ping", (data, callback) => {
    console.log(
      `Ping received from ${socket.id} with timestamp ${data.timestamp}`
    );
    if (typeof callback === "function") {
      callback({ timestamp: data.timestamp });
    }
  });
});

server.listen(PORT, HOST, () => {
  const ipAddress = getPreferredLocalIpAddress();
  console.log(`Server is running on http://${ipAddress}:${PORT}`);
  setInterval(() => {
    for (const [room, history] of Object.entries(messageHistories)) {
      saveBackup(room, history);
    }
  }, 5 * 60 * 1000);
  setInterval(checkIpChange, 5 * 60 * 1000);
});

function loadPasswords() {
  if (fs.existsSync(PASSWORD_FILE_PATH)) {
    const data = fs.readFileSync(PASSWORD_FILE_PATH, "utf8");
    return JSON.parse(data);
  } else {
    return {};
  }
}

function savePasswords() {
  const data = JSON.stringify(PASSWORDS, null, 2);
  fs.writeFileSync(PASSWORD_FILE_PATH, data, "utf8");
}

function getPreferredLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  let preferredAddress = null;
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      const isIPv4 = iface.family === "IPv4";
      const isNotInternal = !iface.internal;
      const isValidAddress =
        iface.address.startsWith("10.200.") ||
        iface.address.startsWith("192.168.");
      if (isIPv4 && isNotInternal && isValidAddress) {
        const isPreferredInterface =
          !preferredAddress || name === "Wi-Fi" || name.includes("Wireless");
        if (isPreferredInterface) {
          preferredAddress = iface.address;
        }
      }
    }
  }
  if (preferredAddress) {
    return preferredAddress;
  } else {
    throw new Error("No valid local IP address found");
  }
}

function getIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

function checkIpChange() {
  const currentIp = getPreferredLocalIpAddress();
  const savedIp = fs.existsSync(ipFilePath)
    ? fs.readFileSync(ipFilePath, "utf8")
    : null;
  if (savedIp !== currentIp) {
    console.log(`IP address changed from ${savedIp} to ${currentIp}`);
    fs.writeFileSync(ipFilePath, currentIp, "utf8");
    if (currentIp.startsWith("10.200.")) {
      for (const [room, history] of Object.entries(messageHistories)) {
        saveBackup(room, history);
      }
    }
  }
}
