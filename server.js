var ws = require("nodejs-websocket");
const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const HEARTBEAT_INTERVAL = 30000; // 每 10 秒发送一次 ping
const TIMEOUT = 60000; // 30 秒超时，如果超过这个时间没有 pong，认为连接断开

const folder = 'chatRecords', mainFolder = 'dialogs', configFolder = 'config', filePath = getCurrentDateFolder();
let server, rooms = {}, queue = [], deleteQueue = [], processing = false, deleteProcessing = false;

init();

function usersNum() {
    let numMap = {};
    server.connections.forEach(function(connection) {
        connection.userInfomation.rooms.forEach(function(roomId) {
            if(!numMap[roomId]) {
                numMap[roomId] = 1;
            } else numMap[roomId] += 1;
        });
    });
    server.connections.forEach(function(connection) {
        connection.sendText(JSON.stringify({messageType: 'users', message: connection.userInfomation.rooms.map(id => {return {id, num: numMap[id]}})}));
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
async function deleteRecords(dirPath) {
    try {
      await fsp.rmdir(dirPath, { recursive: true });
    } catch (err) {
      console.error('文件夹删除失败:', err);
    }
  }

function guid() {
    return ('' + [1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, ch => {
        let c = Number(ch);
        return ((c ^ (crypto.randomBytes(1)[0] & 15)) >> (c / 4)).toString(16);
    });
}

// 处理队列中的请求，确保一个接一个地执行
async function processQueue() {
    if (processing) {
      // 如果已经有任务在处理，则直接返回，避免重复调用
      return;
    }
  
    // 标记为正在处理
    processing = true;
  
    while (queue.length > 0) {
      const task = queue.shift(); // 从队列中取出任务
      task(); // 执行任务
    }
  
    // 完成处理，标记为未处理
    processing = false;
}

async function processDeleteQueue() {
    if (deleteProcessing) {
        // 如果已经有任务在处理，则直接返回，避免重复调用
        return;
    }

    // 标记为正在处理
    deleteProcessing = true;

    while (deleteQueue.length > 0) {
        const task = deleteQueue.shift(); // 从队列中取出任务
        task(); // 执行任务
    }

    // 完成处理，标记为未处理
    deleteProcessing = false;
}

async function init() {
    await deleteRecords(folder);

    server = ws.createServer(function(conn){
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
                                            rooms: Object.keys(rooms).map(r => {return {id: r, name: rooms[r].name, question: rooms[r].question}}),
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
                            if(!room.openRecords) {
                                const dirPath = path.join(folder, mainFolder, message.reciever.id);
                                deleteRecords(dirPath);
                            }
                        } catch(e) {
                            
                        }
                        server.connections.filter(c => c.userInfomation.rooms.indexOf(message.reciever.id) > -1).forEach(function(connection) {
                            connection.sendText(str);
                        });
                        break;
                case 'talk':
                    server.connections.filter(c => c.userInfomation.rooms.indexOf(message.reciever.id) > -1).forEach(function(connection) {
                            connection.sendText(str);
                    });

                    room = rooms[message.reciever.id];
                    if(room && room.openRecords)
                            writeRecords(message.reciever.id, str);
                    break;
                case 'pong':
                    lastPongTime = Date.now();
                    break;
                case 'applyRoom':
                    queue.push(() => {
                            let isSameName = Object.keys(rooms).find(roomId => rooms[roomId].name.trim() === message.reciever.name);
                            if(isSameName) {
                                message.message.error = '同名包厢已存在';                
                            }else{
                                let id;
                                do {
                                    id ='room_' + guid();
                                } while (rooms[id]);
                                rooms[id] = {name: message.reciever.name, question: message.message.question, answer: message.message.answer};
                                if(conn.userInfomation.rooms.indexOf(id) === -1) conn.userInfomation.rooms.push(id);
                                message.reciever.id = id;
                                message.setUp = {myRooms: conn.userInfomation.rooms};
                                server.connections.forEach(function(connection) {
                                    connection.sendText(JSON.stringify({messageType: 'rooms', message: Object.keys(rooms).map(r => {return {id: r, name: rooms[r].name, question: rooms[r].question}})}));
                                });
                            }
                            conn.sendText(JSON.stringify(message));
                            if(!message.message.error) usersNum();
                    });

                    // 每次客户端发送消息时，尝试处理队列中的任务
                    processQueue();
                    break;
                case 'checkRoom':
                    room = rooms[message.reciever.id];
                    if(room) {
                        if(room.answer.trim() === message.message.answer.trim()) {
                        if(conn.userInfomation.rooms.indexOf(message.reciever.id) === -1) conn.userInfomation.rooms.push(message.reciever.id);
                                message.setUp = {
                                    switchRecords: room.openRecords,
                                    myRooms: conn.userInfomation.rooms
                                }
                        } else message.message.error = '再想想是啥';
                    } else message.message.error = '包厢不存在';
                    conn.sendText(JSON.stringify(message));
                    if(!message.message.error) usersNum();
                    break;
                case 'closeRoom':
                    deleteQueue.push(() => {
                        let room = rooms[message.reciever.id];
                        message.message = {};
                        if(conn.userInfomation.rooms.indexOf(message.reciever.id) > -1 && room) {
                            delete rooms[message.reciever.id];
                            server.connections.forEach(function(connection) {
                                const index = connection.userInfomation.rooms.indexOf(message.reciever.id);
                                if(index > -1) {
                                    const dirPath = path.join(folder, mainFolder, message.reciever.id);
                                    deleteRecords(dirPath);
                                    connection.userInfomation.rooms.splice(index, 1);
                                    connection.sendText(JSON.stringify({messageType: 'myRooms', message: connection.userInfomation.rooms}));
                                }
                                connection.sendText(JSON.stringify({messageType: 'rooms', message: Object.keys(rooms).map(r => {return {id: r, name: rooms[r].name, question: rooms[r].question}})}));
                            });
                        } else message.message.error = `解散包厢“${message.reciever.name}”失败`;
                        conn.sendText(JSON.stringify(message));
                    });

                    processDeleteQueue();
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
}

process.on('uncaughtException', async (err, origin) => {
    await deleteRecords(folder);
    // 强制退出进程
    process.exit(1);  // 退出进程，传递非零状态码表示异常退出
});

// 监听 SIGTERM 和 SIGINT 信号，优雅退出
process.on('SIGTERM', async () => {
    await deleteRecords(folder);
    process.exit(0);
});

process.on('SIGINT', async () => {
    await deleteRecords(folder);
    process.exit(0);
});

console.log("App listening at port 8870")