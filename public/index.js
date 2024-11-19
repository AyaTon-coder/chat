const socket = io();
let socketId;
let currentRoom = null;
const chatDiv = document.querySelector("#chat");
const authContainer = document.querySelector("#authContainer");
const passwordContainer = document.querySelector("#passwordContainer");
const chatContainer = document.querySelector("#chatContainer");

let pendingMessages = []; // 送信保留中のメッセージを保存する配列

// Ping/Pongメカニズムの実装
setInterval(() => {
  socket.emit("ping", { timestamp: Date.now() }, (response) => {
    const latency = Date.now() - response.timestamp;
    console.log(`Latency: ${latency} ms`);
  });
}, 10000); // 10秒ごとにPingを送信

// ページロード時にルーム名とパスワードをチェック
window.onload = function () {
  const savedRoom = localStorage.getItem("room");
  const savedPassword = localStorage.getItem("password");
  if (savedRoom && savedPassword) {
    authenticate(savedRoom, savedPassword);
  } else {
    showAuthContainer();
  }
};

function showAuthContainer() {
  authContainer.style.display = "block";
  passwordContainer.style.display = "block";
  chatContainer.style.display = "none";
}

function authenticate(roomName, password) {
  if (!roomName) {
    roomName = document.querySelector("#roomInput").value;
    password = document.querySelector("#passwordInput").value;
    localStorage.setItem("room", roomName);
    localStorage.setItem("password", password);
  }
  socket.emit("authenticate", { room: roomName, password });
}

function addPassword() {
  const newRoom = document.querySelector("#newRoomInput").value;
  const newPassword = document.querySelector("#newPasswordInput").value;

  fetch("/add-password", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ room: newRoom, password: newPassword }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        alert("パスワードが追加されました。");
      } else {
        alert("パスワードの追加に失敗しました。");
      }
    });
}

socket.on("authenticated", function ({ success, room }) {
  if (success) {
    authContainer.style.display = "none";
    passwordContainer.style.display = "none";
    chatContainer.style.display = "block";
    currentRoom = room;
  } else {
    alert("認証に失敗しました。正しいパスワードを入力してください。");
    localStorage.removeItem("room");
    localStorage.removeItem("password");
    showAuthContainer();
  }
});

// 過去のメッセージを受信して表示
socket.on("history", function (history) {
  chatDiv.innerHTML = ""; // チャット履歴をクリア
  history.forEach(function (data) {
    const json = JSON.parse(data);
    if (!json.message) return;
    chatDiv.appendChild(createMessage(json));
  });
  localStorage.setItem("messageHistory", JSON.stringify(history)); // ローカルストレージに保存
  chatDiv.scrollTo(0, chatDiv.scrollHeight);
});

// socket.io 接続時イベント connectid
socket.on("connectid", function (id) {
  console.log(socketId + ":" + id);
  socketId = id;
});

// message送信処理
function sendMessage() {
  const now = new Date();
  const messageData = {
    name: document.querySelector("#nameInput").value,
    message: document.querySelector("#msgInput").value,
    time: `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`,
    socketId: socketId,
  };
  console.log("Sending message:", messageData); // ログ出力
  pendingMessages.push(messageData); // 送信保留中のメッセージに追加
  socket.emit("message", { room: currentRoom, messageData }, (response) => {
    if (response.status === "ok") {
      console.log("Message acknowledged by server:", response);
      pendingMessages = pendingMessages.filter((msg) => msg !== messageData); // 成功したメッセージを保留中リストから削除
    } else {
      console.error("Message failed to send:", response);
      setTimeout(() => sendMessage(), 1000); // 再送信のリトライ機能
    }
  });
  document.getElementById("msgInput").value = "";
}

// socket から message イベント受信時の処理
socket.on("message", function (data) {
  console.log("Received message:", data); // ログ出力
  const json = JSON.parse(data);
  if (!json.message) return;
  chatDiv.appendChild(createMessage(json));
  chatDiv.scrollTo(0, chatDiv.scrollHeight);
});

// ここから下は DOM の操作
function createMessage(json) {
  const side = json.socketId === socketId ? "mine" : "other";
  const sideElement = createDiv(side);
  const sideTextElement = createDiv(`${side}-text`);
  const timeElement = createDiv("time");
  const nameElement = createDiv("name");
  const textElement = createDiv("text");
  timeElement.textContent = json.time;
  nameElement.textContent = json.name;
  textElement.textContent = json.message;
  sideElement.appendChild(sideTextElement);
  sideTextElement.appendChild(timeElement);
  sideTextElement.appendChild(nameElement);
  sideTextElement.appendChild(textElement);
  return sideElement;
}

function createDiv(className) {
  const element = document.createElement("div");
  element.classList.add(className);
  return element;
}

function backToRoomSelection() {
  localStorage.removeItem("room");
  localStorage.removeItem("password");
  socket.emit("leaveRoom"); // 修正：disconnectからleaveRoomへ変更
  showAuthContainer();
}
