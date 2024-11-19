const fs = require("fs");
const path = require("path");

function loadBackup(room) {
  const backupFilePath = path.join(__dirname, `${room}_chat_backup.json`);
  if (fs.existsSync(backupFilePath)) {
    const data = fs.readFileSync(backupFilePath, "utf8");
    return JSON.parse(data);
  } else {
    console.log(
      `No backup file found for ${room}. Starting with an empty history.`
    );
    return [];
  }
}

function saveBackup(room, messageHistory) {
  const backupFilePath = path.join(__dirname, `${room}_chat_backup.json`);
  const data = JSON.stringify(messageHistory, null, 2);
  fs.writeFileSync(backupFilePath, data, "utf8");
  console.log(`Backup for ${room} saved successfully.`);
}

module.exports = {
  loadBackup,
  saveBackup,
};
