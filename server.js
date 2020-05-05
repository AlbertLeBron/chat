var ws = require("nodejs-websocket");

var server = ws.createServer(function(conn){
    conn.on("text", function (str) {
        var message = JSON.parse(str);

        switch(message.messageType){
            case 'login': 
                    conn.sendText(str);
                    usersNum();
                    break;
            case 'talk':
                   server.connections.forEach(function(connection) {
                        connection.sendText(str);
                   });
                   break;
            case 'close':
                   try {
                        conn.close();
                   } catch (error) {
                        console.log('close异常', error)
                   }
                  break;
        }
    })
    conn.on("close", function (code, reason) {
        console.log("关闭连接");
        usersNum();
    });
    conn.on("error", function (code, reason) {
        console.log("异常关闭");
    });

    conn.on("connect", function () {
        console.log("开始连接");
    });

}).listen(8870);

function usersNum() {
    server.connections.forEach(function(connection) {
        connection.sendText(JSON.stringify({messageType: 'users', message: server.connections.length}));
    });
}
console.log("App listening at port 8870")