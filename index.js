var logginError = document.getElementById('errorMessage'),
    nameSub = document.getElementById('nameSub'),
    pop = document.getElementById('pop'),
    nus = document.getElementById('nus'), 
    sumInfo = document.getElementById('sumInfo'),
    nextus = document.getElementById('nextus'), 
    m = document.getElementById('mwin'), 
    u = document.getElementById('userList'), t, num = 0, state = 0, c, rooms = [], url = 'logic.php?', time, user = {}, webSocket,
    confirmExcution,
    tolerance = 1; // 容差值，可以根据需要调整;

function openClient() {
    var name = document.getElementById('nameIpt').value;
    if(name && name.trim()) {
        logginError.innerText = '';
        nameSub.setAttribute('disabled', '');

        webSocket = new WebSocket('ws://localhost:8870');  

        webSocket.onerror = function(event) {  
            logginError.innerText = '系统忙碌中，请稍等片刻...';
            nameSub.removeAttribute('disabled'); 
            addClass(pop, 'active');
        };
        webSocket.onopen = function(event) {
            var id = 'u'+new Date().getTime()+'_'+guid();                
            webSocket.send(JSON.stringify({sender: {id: id, name: name}, reciever: {id: 'group', name: '群聊'}, messageType: 'login'}));
        };
        webSocket.onclose = function(event){
            console.log("已掉线，请尝试重新登录");
            nameSub.removeAttribute('disabled');
            addClass(pop, 'active');
        }
        webSocket.onmessage = function(event){
            let message = JSON.parse(event.data),
                node = message && message.reciever && message.reciever.id ? document.getElementById('v'+message.reciever.id) : null;
            
            switch(message.messageType){
                case 'login': 
                        user = message.sender;
                        newRoom({roomId: message.reciever.id, setUp: message.setUp});
                        removeClass(document.getElementById('login'), 'active');
                        break;
                case 'records':
                        checkHistory(message.contents, node);
                        break;
                case 'switchRecords':
                        if(node) {
                            let tb = node.getElementsByClassName('toBottom')[0],
                                b = node.getElementsByClassName('box')[0],
                                modeChange = node.getElementsByClassName('modeChange')[0],
                                w = node.getElementsByClassName('words')[0];
                            if(message.message && !hasClass(modeChange, 'active')) {
                                addClass(modeChange, 'active');
                            } else if(!message.message) {
                                if(hasClass(modeChange, 'active')) 
                                    removeClass(modeChange, 'active');
                                if(message.sender.id === user.id) {
                                    w.innerHTML = '<div class="historyContent"></div>';
                                }
                            }

                            let newItem = document.createElement('div');
                            newItem.className = 'tip';
                            newItem.innerHTML = '<b>'+message.sender.name+'</b> 已将'+(message.reciever.id === 'group' ? '群聊' : '包厢')+'更改为'+(message.message ? '记录模式' : '无痕模式');
                            if(message.sender.id === user.id) {
                                w.appendChild(newItem);
                                b.scrollTop = b.scrollHeight - b.clientHeight;
                            } else {
                                const isAtBottom = Math.abs(b.scrollTop - (b.scrollHeight - b.clientHeight)) <= tolerance;
                                w.appendChild(newItem);
                                if(isAtBottom) {
                                    b.scrollTop = b.scrollHeight - b.clientHeight;
                                } else if(!hasClass(tb, 'active')) addClass(tb, 'active');
                            }
                        }
                        
                        break;
                case 'talk':
                        var now = new Date(),
                            w = node.getElementsByClassName('words')[0],
                            b = node.getElementsByClassName('box')[0],
                            tb = node.getElementsByClassName('toBottom')[0];
                        if((now.getTime()-time.getTime())/(1000*60)>1 || w.children.length <= 1){
                            newItem = document.createElement('div');
                            newItem.className = 'time';
                            time = now;
                            newItem.innerHTML = formatDate(time);
                            w.appendChild(newItem);
                        }
                        time = now;
                        var newItem;
                        if(message.sender.id === user.id) break;
                        newItem = document.createElement('div');
                        newItem.className = 'kf';
                        newItem.innerHTML = '<span><i><img title="'+message.sender.name+'" src="../img/user.png"/></i><b title="'+message.sender.name+'">'+message.sender.name+'</b></span><div><span>'+showSpe(message.message)+'</span></div>';
                        const isAtBottom = Math.abs(b.scrollTop - (b.scrollHeight - b.clientHeight)) <= tolerance;
                        w.appendChild(newItem);
                        if(isAtBottom) {
                            b.scrollTop = b.scrollHeight - b.clientHeight;
                        } else if(!hasClass(tb, 'active')) addClass(tb, 'active');
                        break;
                case 'users': 
                        Object.keys(message.message).forEach(room => {
                            let dom = document.getElementById('v'+room);
                            if(dom) 
                                dom.getElementsByClassName('clientloc')[0].innerText = '当前'+message.message[room]+'人在线';
                        });
                        break;
                case 'ping':
                        webSocket.send(JSON.stringify({sender: {id: user.id, name: user.name}, messageType: 'pong'}));
                        break;
            }
        }
    } else logginError.innerText = '* 请输入昵称';
}

window.addEventListener('beforeunload', function () {
    webSocket && webSocket.close();
});

function pressOpen(event) {
    if(event.keyCode == '13'){
        nameSub.click();
    }
}

function newRoom(data){
    if(!data){
        alert('创建失败，请稍等片刻')
        return;
    }
    rooms = data.setUp.rooms;
    data.setUp.myRooms.forEach(roomId => {
        let room = rooms.find(room => room.id === roomId);
        if(room) 
            room.hasAuthority = true;
    });
    let v = rooms.find(room => room.id === data.roomId);

    if(c){
        removeClass(document.getElementById(c.id), 'active');
        removeClass(document.getElementById('v'+c.id), 'active');
    }
    c = v;

    u.innerHTML = rooms.map(room => `<div id="${room.id}" class="${room.id === v.id ? 'active' : ''}" onclick="selectRoom('${room.id}')">${room.name}</div>`);

    newChatWin(v, {switchRecords: data.setUp.switchRecords});
}
function newChatWin(v, setUp) {
    var node = document.createElement('div');
    node.id = 'v'+v.id;
    node.className = 'userInfo active';

    node.innerHTML = `<div class="bar"><span class="clientTitle">${v.name}</span><div class="barSum"><span class="clientloc"></span><span class="modeChange${setUp.switchRecords ? ' active' : ''}">◐</span><span class="close">×</span></div></div>
                        <div class="content">
                            <div class="dialogue">
                                <div class="boxWrap">
                                    <div class="box">
                                        <div class="words"><div class="historyContent"></div></div>
                                        <div class="toBottom">有新消息 &#8675;</div>
                                    </div>
                                </div>
                                <div class="quick"><span title="表情包">&#9786</span><div id="emoji">
                                <a title="鼓掌"><img src="../img/emo01.gif"/></a>
                                <a title="偷乐"><img src="../img/emo02.gif"/></a>
                                <a title="点头"><img src="../img/emo03.gif"/></a>
                                <a title="欢呼"><img src="../img/emo04.gif"/></a>
                                <a title="得意"><img src="../img/emo05.gif"/></a>
                                <a title="懵圈"><img src="../img/emo06.gif"/></a>
                                <a title="点赞"><img src="../img/emo07.gif"/></a>
                                <a title="拜拜"><img src="../img/emo08.gif"/></a>
                                <a title="送花"><img src="../img/emo09.gif"/></a>
                                </div></div>
                                <div class="oper">
                                    <textarea class="ipt" maxlength="2000" contenteditable="true" placeholder="输入您想说的话..."></textarea>
                                    <div class="tool"><small class="warn">空的发不了哦</small><span align="right" class="send">发 送</span></div>
                                </div>
                            </div>
                        </div>`;
    m.appendChild(node);

    var w = node.getElementsByClassName('words')[0], s = node.getElementsByClassName('send')[0], a = node.getElementsByClassName('ipt')[0], 
        b = node.getElementsByClassName('box')[0], warn = node.getElementsByClassName('warn')[0], tb = node.getElementsByClassName('toBottom')[0], 
        modeChange = node.getElementsByClassName('modeChange')[0], close = node.getElementsByClassName('close')[0], q = node.getElementsByClassName('quick')[0].getElementsByTagName('a');

    var newItem;
    newItem = document.createElement('div');
    newItem.className = 'time';
    time = new Date();
    newItem.innerHTML = formatDate(time);
    w.appendChild(newItem);

    newItem = document.createElement('div');
    newItem.className = 'kf prologue';
    newItem.innerHTML = '<span><i><img title="'+v.name+'" src="../img/user.png"/></i><b title="'+v.name+'">'+v.name+'</b></span><div><span><xmp>一起来嗨吧~</xmp></span></div>';
    w.appendChild(newItem);

    b.scrollTop = w.offsetHeight;
    b.addEventListener('scroll', function(e){
        const isAtBottom = Math.abs(b.scrollTop - (b.scrollHeight - b.clientHeight)) <= tolerance;
        if(isAtBottom && hasClass(tb, 'active'))
            removeClass(tb, 'active');
    }, { passive: true });
    tb.addEventListener("click", function(e){
        b.scrollTop = b.scrollHeight - b.clientHeight;
    });
    s.addEventListener("click", send);
    a.addEventListener("keypress", function(e){
        if(e.keyCode == 13){
            e.preventDefault();
            send();
        }
    });
    for(var i = 0;i<9;i++){
        q[i].addEventListener("click", function(){
            var val = a.value;
            a.value = '&mtwd:0,'+this.children[0].getAttribute('src').split('emo')[1].replace('.gif','');
            send();
            a.value = val;
        });
    }
    function send(){
        if(a.value.trim() == ''){
            warn.innerText = '空的发不了哦';
            warn.setAttribute('active', 0);
            clearTimeout(t);
            t = setTimeout(function(){warn.removeAttribute('active');}, 1500);
            return;
        }else{
            warn.removeAttribute('active');
        }
        var now = new Date();
        if((now.getTime()-time.getTime())/(1000*60)>1 || w.children.length <= 1){
            newItem = document.createElement('div');
            newItem.className = 'time';
            time = now;
            newItem.innerHTML = formatDate(time);
            w.appendChild(newItem);
        }
        time = now;
        newItem = document.createElement('div');
        newItem.className = 'user';
        val = a.value;
        newItem.innerHTML = '<div><span>'+showSpe(val)+'</span></div><i><img src="../img/user.png"/></i>';
        w.appendChild(newItem);
        b.scrollTop = b.scrollHeight - b.clientHeight;
        webSocket.send(JSON.stringify({chatType: v.id === 'group' ? 'group' : 'room', sender: {id: user.id, name: user.name}, reciever: {id: v.id, name: v.name}, messageType: 'talk', message: a.value}));
        a.value = '';
    }
    modeChange.addEventListener('click', function(){
        let isRecording = hasClass(modeChange, 'active'),
            roomStr = v.id === 'group' ? '群聊' : '此包厢';
        triggerConfirm({text: `即将${isRecording ? '删除' + roomStr + '记录并开启无痕模式' : '开启记录模式'}，是否继续？`}, () => {
            webSocket.send(JSON.stringify({chatType: v.id === 'group' ? 'group' : 'room', sender: {id: user.id, name: user.name}, reciever: {id: v.id, name: v.name}, messageType: 'switchRecords', message: !isRecording}));
        });
    });
    close.addEventListener('click', function(){
       triggerConfirm({text: `即将遁去，是否继续？`}, () => {
           /*u.removeChild(liNode);
            m.removeChild(node);
            var l = u.children.length;
            if(l > 0){
                excuFn(u.children[l-1]);
            }else{
                c = '';
                location.reload();
            }*/
            location.reload();
       });
    });
    var ns = document.createElement("script");
    ns.setAttribute("type", "text/javascript");
    if(setUp.switchRecords) webSocket.send(JSON.stringify({chatType: v.id === 'group' ? 'group' : 'room', sender: {id: user.id, name: user.name}, reciever: {id: v.id, name: v.name}, messageType: 'records'}));
}
function showSpe(str){
    var val = str.split('&mtwd:');
    if(val.length<2){
        return '<xmp>'+val[0]+'</xmp>';
    }else{
        val = val[1].split(',');
    }
    return '<img class="emoj" src="../img/emo'+val[1]+'.gif"/>';
}
function addClass(obj, cls) {
    if (!this.hasClass(obj, cls)) {
        obj.className += " " + cls;
    }
}
function removeClass(obj, cls) {
    if (hasClass(obj, cls)) {
        var reg = new RegExp('(\\s|^)' + cls + '(\\s|$)');
        obj.className = obj.className.replace(reg, '');
    }
}
function hasClass(obj, cls) {
    return obj.className.match(new RegExp('(\\s|^)' + cls + '(\\s|$)'));
}
function excuFn(elementArray, paramArray, fn){
    for(var i = 0; i<elementArray.length; i++){
        var e = elementArray[i];
        var str = 'fn(e';
        for(var j = 0; j<paramArray.length; j++){
            str+= ', "'+paramArray[j]+'"';
        }
        str+=')';
        eval(str);
    }
}
function guid(){
    return ('' + [1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, ch => {
        let c = Number(ch);
        return (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    });
}
function checkHistory(contents, node) {
    if(node) {
        let w = node.getElementsByClassName('words')[0],
            b = node.getElementsByClassName('box')[0],
            dom = w.getElementsByClassName('historyContent')[0],
            cscrollDis = b.scrollHeight - b.clientHeight - b.scrollTop;

            str = contents.map(c => {
                let {date, cts} = c;
                cts = JSON.parse(cts);
                return '<div class="time">'+ date +'</div>' + 
                cts.map(m => {
                    let ms = !!m ? JSON.parse(m) : undefined;
                    return !!ms ? '<div class="kf"><span><i><img title="'+ms.sender.name+'" src="../img/user.png"/></i><b title="'+ms.sender.name+'">'+ms.sender.name+'</b></span><div><span>'+showSpe(ms.message)+'</span></div></div>' : '';
                }).join('');
            }).join('');
        dom.innerHTML = str;

        b.scrollTop = b.scrollHeight - b.clientHeight - cscrollDis;
    }
}
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
function toggle() {
    if(hasClass(sumInfo, 'open')) {
        removeClass(sumInfo, 'open');
    } else addClass(sumInfo, 'open');
}
function confirmCallback(isConfirm, noClose) {
    let dom = document.getElementById('cornfirmPop'),
        textDom = document.getElementById('confirmText'),
        customDom = document.getElementById('customBox');
    if(isConfirm) {
        confirmExcution && confirmExcution();
    }
    if(dom.hasAttribute('waitting') && isConfirm) {
        return;
    } else if(dom.hasAttribute('waitting') && !isConfirm)
        dom.removeAttribute('waitting');
    textDom.innerText = '';
    customDom.innerHTML = '';
    confirmExcution = null;
    removeClass(dom, 'active');
}
function triggerConfirm(content, callback) {
    let dom = document.getElementById('cornfirmPop'),
        textDom = document.getElementById('confirmText'),
        customDom = document.getElementById('customBox');
    textDom.innerText = content.text || '';
    customDom.innerHTML = content.code || '';
    confirmExcution = callback;
    addClass(dom, 'active');
}
function selectRoom(roomId){
    let dom = document.getElementById(roomId);
    removeClass(document.getElementById(c.id), 'active');
    removeClass(document.getElementById('v'+c.id), 'active');
    c = rooms.find(r => r.id === roomId);
    addClass(document.getElementById(c.id), 'active');
    addClass(document.getElementById('v'+c.id), 'active');
    removeClass(dom, 'newmsg');
}
function apply() {
    triggerConfirm({
        text: `请设置包厢名、准入的问题和答案：`, 
        code: `<div><input id="applyRoomName" placeholder="房间名" style="width:100%;box-sizing:border-box;outline:none;"/></div>
        <div style="margin-top: 10px;"><input id="applyQuestion" placeholder="问题" style="width:100%;box-sizing:border-box;outline:none;"/></div>
        <div style="margin: 10px 0;"><input id="applyAnswer" placeholder="答案" style="width:100%;box-sizing:border-box;outline:none;"/></div>`
    }, () => {
        let dom = document.getElementById('cornfirmPop');
        dom.setAttribute('waitting', '');
        
    });
}
m.addEventListener('mousedown', (e) => {
    if(sumInfo.contains(e.target)) return;
    if(hasClass(sumInfo, 'open')) {
        removeClass(sumInfo, 'open');
    }
});