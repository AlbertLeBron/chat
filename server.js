var ws = require("nodejs-websocket");
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const HEARTBEAT_INTERVAL = 30000; // 每 10 秒发送一次 ping
const TIMEOUT = 60000; // 30 秒超时，如果超过这个时间没有 pong，认为连接断开

const folder = 'chatRecords', mainFolder = 'dialogs', configFolder = 'config', filePath = getCurrentDateFolder();
let rooms = {};

var server = ws.createServer(function(conn){
    console.log("开始连接");

    // 定期发送心跳 (ping)
    const pingInterval = setInterval(() => {
        if (conn.readyState === 1) {
            conn.sendText(JSON.stringify({messageType: 'ping'}));
        }
    }, HEARTBEAT_INTERVAL);

    let lastPongTime = Date.now(); // 记录最后收到 pong 的时间

    conn.on("text", function (str) {
        let message = JSON.parse(str),
            room;

        switch(message.messageType){
            case 'login': 
                    if(!rooms[message.reciever.id]) rooms[message.reciever.id] = {name: message.reciever.name};
                    conn.userInfomation = {...message.sender, rooms: [message.reciever.id]};
                    message.setUp = {
                                        switchRecords: rooms[message.reciever.id].openRecords, 
                                        rooms: Object.keys(rooms).map(r => {return {id: r, name: rooms[r].name}}),
                                        myRooms: conn.userInfomation.rooms
                                    };
                    conn.sendText(JSON.stringify(message));
                    usersNum();
                    break;
            case 'records':
                    room = rooms[message.reciever.id];
                    if(room && room.openRecords)
                        readRecords(message.reciever.id, (records) => {
                            conn.sendText(JSON.stringify({...records, messageType: 'records'}));
                        }); 
                    break;
            case 'switchRecords':
                    room = rooms[message.reciever.id];
                    try {
                        room.openRecords = message.message;
                        if(!room.openRecords)
                            deleteRecords(message.reciever.id);
                    } catch(e) {
                        
                    }
                    server.connections.filter(c => c.userInfomation.rooms.indexOf(message.reciever.id) > -1).forEach(function(connection) {
                        connection.sendText(str);
                    });
                    break;
            case 'talk':
                   server.connections.forEach(function(connection) {
                        connection.sendText(str);
                   });

                   room = rooms[message.reciever.id];
                   if(room && room.openRecords)
                        writeRecords(message.reciever.id, str);
                   break;
            case 'pong':
                   lastPongTime = Date.now();
                   break;
        }
    })
    conn.on("close", function (code, reason) {
        console.log(conn.userInfomation.name + "关闭连接", server.connections.length);
        clearInterval(pingInterval); // 清理心跳定时器
        clearInterval(timeoutCheck); // 清理超时检查定时器
        usersNum();
    });
    conn.on("error", function (code, reason) {
        console.log(conn.userInfomation.name + "异常关闭", server.connections.length);
    });

    // 检查超时
    const timeoutCheck = setInterval(() => {
        if (Date.now() - lastPongTime > TIMEOUT) {
            console.log(conn.userInfomation.name + 'Connection timed out');
            conn.close(); // 关闭连接
            clearInterval(pingInterval); // 清理心跳定时器
            clearInterval(timeoutCheck); // 清理超时检查定时器
        }
    }, HEARTBEAT_INTERVAL); // 每 5 秒检查一次超时
}).listen(8870);

function usersNum() {
    let numMap = {};
    server.connections.forEach(function(connection) {
        connection.userInfomation.rooms.forEach(function(room) {
            if(!numMap[room]) {
                numMap[room] = 1;
            } else numMap[room] += 1;
        });
    });
    server.connections.forEach(function(connection) {
        connection.sendText(JSON.stringify({messageType: 'users', message: numMap}));
    });
}

// 获取当前日期并格式化为YYYYMMDD
function getCurrentDateFolder() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// 异步写入文件并确保目录存在
async function writeRecords(recieverId, message) {
    const filePath = path.join(folder, mainFolder, recieverId, getCurrentDateFolder()),
          dir = path.dirname(filePath);
  
    try {
      // 检查并创建目录
      await fsp.mkdir(dir, { recursive: true });
      // 写入文件
      await fsp.appendFile(filePath, message + '<<END_OF_MESSAGE>>');
    } catch (err) {
      
    }
}

// 异步读取目录并依次读取文件内容
async function readRecords(recieverId, callback) {
    const directoryPath = path.join(folder, mainFolder, recieverId);
    try {
      // 读取目录内容
      const files = await fsp.readdir(directoryPath),
            records = {reciever: {id: recieverId}, contents: []};
      for (const file of files) {
        const filePath = path.join(directoryPath, file);
        const stats = await fsp.stat(filePath);
        if (stats.isFile()) {
          // 读取文件内容
          const content = await fsp.readFile(filePath, 'utf8');
          records.contents.push({date: file, cts: JSON.stringify(content.split('<<END_OF_MESSAGE>>'))});
        }
      }
      callback && callback(records);
    } catch (err) {
      console.error('读取文件时出错:', err);
    }
}

//删除文件夹
async function deleteRecords(recieverId) {
    const dirPath = path.join(folder, mainFolder, recieverId);
    try {
      await fsp.rmdir(dirPath, { recursive: true });
    } catch (err) {
      console.error('文件删除失败:', err);
    }
  }

console.log("App listening at port 8870")