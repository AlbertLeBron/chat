var logginError = document.getElementById('errorMessage'),
    nameSub = document.getElementById('nameSub'),
    pop = document.getElementById('pop'),
    nus = document.getElementById('nus'), 
    sumInfo = document.getElementById('sumInfo'),
    nextus = document.getElementById('nextus'), 
    m = document.getElementById('mwin'), 
    u = document.getElementById('userList'), 
    times = [], c, rooms = [], myRooms = [], url = 'logic.php?', user = {}, webSocket,
    confirmExcution,
    maxSizeInBytes = 100 * 1024,
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
            var id = 'u'+new Date().getTime()+'_'+guid(),
                bgColor = getRandomRGBColor(),
                color = getContrastingColor(bgColor);                
            webSocket.send(JSON.stringify({sender: {id: id, name: name, bgColor, color}, reciever: {id: 'group', name: '群聊'}, messageType: 'login'}));
        };
        webSocket.onclose = function(event){
            console.log("已掉线，请尝试重新登录");
            nameSub.removeAttribute('disabled');
            addClass(pop, 'active');
        }
        webSocket.onmessage = function(event){
            let message = JSON.parse(event.data),
                node = message && message.reciever && message.reciever.id ? document.getElementById('v'+message.reciever.id) : null,
                listNode = message && message.reciever && message.reciever.id ? document.getElementById(message.reciever.id) : null,
                cornfirmPopDom = document.getElementById('cornfirmPop'),
                errorDom = document.getElementById('confirmError'),
                applyId = message && message.message && message.message.applyId;
            
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

                            if(!hasClass(node, 'active') && listNode && !hasClass(listNode, 'newmsg')) addClass(listNode, 'newmsg');
                        }
                        
                        break;
                case 'talk':
                        if(node) {
                            var now = new Date(),
                                w = node.getElementsByClassName('words')[0],
                                b = node.getElementsByClassName('box')[0],
                                tb = node.getElementsByClassName('toBottom')[0];
                            if((now.getTime()-times[message.reciever.id].time.getTime())/(1000*60)>1 || w.children.length <= 1){
                                newItem = document.createElement('div');
                                newItem.className = 'time';
                                times[message.reciever.id].time = now;
                                newItem.innerHTML = formatDate(times[message.reciever.id].time);
                                w.appendChild(newItem);
                            }
                            times[message.reciever.id].time = now;
                            var newItem;
                            if(message.sender.id === user.id) break;
                            newItem = document.createElement('div');
                            newItem.className = 'kf';
                            newItem.innerHTML = '<span><i style="background:'+message.sender.bgColor+';color:'+message.sender.color+'">'+message.sender.name[0]+'</i><b title="'+message.sender.name+'">'+message.sender.name+'</b></span><div><span>'+showSpe(message.message)+'</span></div>';
                            const isAtBottom = Math.abs(b.scrollTop - (b.scrollHeight - b.clientHeight)) <= tolerance;
                            w.appendChild(newItem);
                            if(isAtBottom) {
                                b.scrollTop = b.scrollHeight - b.clientHeight;
                            } else if(!hasClass(tb, 'active')) addClass(tb, 'active');

                            if(!hasClass(node, 'active') && listNode && !hasClass(listNode, 'newmsg')) addClass(listNode, 'newmsg');
                        }
                        break;
                case 'users': 
                        message.message.forEach(room => {
                            let dom = document.getElementById('v'+room.id);
                            if(dom) 
                                dom.getElementsByClassName('clientloc')[0].innerText = '当前'+room.num+'人在线';
                        });
                        break;
                case 'ping':
                        webSocket.send(JSON.stringify({sender: {id: user.id, name: user.name}, messageType: 'pong'}));
                        break;
                case 'applyRoom':
                        if(message.message.error) {
                            if(cornfirmPopDom.getAttribute('popid') === applyId) {
                                cornfirmPopDom.removeAttribute('disabled');
                                cornfirmPopDom.removeAttribute('waitting');
                                errorDom.innerText = '* '+message.message.error;
                            } else {
                                showTipPop({status: 'error', text: message.message.error});
                            }
                        } else{
                            let v = rooms.find(room => room.id === message.reciever.id);
                            if(v) newChatWin(v, {switchRecords: false});
                            if(cornfirmPopDom.getAttribute('popid') === applyId) {
                                closeConfirm();
                                if(v) selectRoom(v.id);
                            }
                            showTipPop({status: 'success', text: `包厢“${message.reciever.name}”申请成功`});
                            refreshMyRooms(message.setUp.myRooms);
                        }
                        break;
                case 'rooms':
                        let orooms = rooms;
                        rooms = message.message;
                        let lostRooms = orooms.filter(or => !rooms.find(r => r.id === or.id));
                        if(lostRooms.length) {
                            showTipPop({status: 'warning', text: `包厢“${lostRooms.map(lr => lr.name).join('、')}”已解散`});
                        }
                        if(lostRooms.find(lr => lr.id === c.id)) {
                            let oDom = document.getElementById('v'+c.id);
                            oDom.parentNode.removeChild(oDom);
                            c = orooms.find(or => rooms.find(r => r.id === or.id));
                            document.getElementById(c.id).click();
                        }
                        u.innerHTML = rooms.map(room => `<div id="${room.id}" class="${room.id === c.id ? 'active' : ''}${myRooms.find(id => id === room.id) ? ' registered' : ''}" onclick="selectRoom('${room.id}')"><span>${room.name}</span></div>`).join('');
                        break;
                case 'checkRoom':
                        if(message.message.error) {
                            if(cornfirmPopDom.getAttribute('popid') === applyId) {
                                cornfirmPopDom.removeAttribute('disabled');
                                cornfirmPopDom.removeAttribute('waitting');
                                errorDom.innerText = '* '+message.message.error;
                            } else {
                                showTipPop({status: 'error', text: message.message.error});
                            }
                        } else{
                            refreshMyRooms(message.setUp.myRooms);
                            let v = rooms.find(r => r.id === message.reciever.id),
                                cDom = document.getElementById(v.id);
                            if(cornfirmPopDom.getAttribute('popid') === applyId) {
                                closeConfirm();
                                let dom = document.getElementById(message.reciever.id),
                                    oDom = document.getElementById(c.id),
                                    ovDom = document.getElementById('v'+c.id);
                                if(cDom) {
                                    if(oDom) removeClass(oDom, 'active');
                                    if(ovDom) removeClass(ovDom, 'active');
                                    addClass(cDom, 'active');
                                    removeClass(dom, 'newmsg');
                                    c = v;
                                    newChatWin(v, {switchRecords: message.setUp.switchRecords}, true);
                                }
                            }
                            if(cDom) addClass(cDom, 'registered');
                            if(v) myRooms.push(v);
                        }
                        break;
                case 'closeRoom':
                        if(message.message.error) {
                            showTipPop({status: 'error', text: message.message.error});
                        }
                        let closeDom = node && node.getElementsByClassName('close')[0];
                        if(closeDom) closeDom.removeAttribute('disabled');
                        break;
                case 'myRooms':
                        refreshMyRooms(message.message);
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
    myRooms = data.setUp.myRooms;
    refreshMyRooms(myRooms);
    let v = rooms.find(room => room.id === data.roomId);

    if(c){
        removeClass(document.getElementById('v'+c.id), 'active');
    }
    c = v;

    u.innerHTML = rooms.map(room => `<div id="${room.id}" class="${room.id === v.id ? 'active' : ''}${myRooms.find(id => id === room.id) ? ' registered' : ''}" onclick="selectRoom('${room.id}')"><span>${room.name}</span></div>`).join('');

    newChatWin(v, {switchRecords: data.setUp.switchRecords}, true);
}
function newChatWin(v, setUp, isActive) {
    var node = document.createElement('div');
    node.id = 'v'+v.id;
    node.className = 'userInfo' + (isActive ? ' active' : '');

    node.innerHTML = `<div class="bar"><span class="clientTitle">${v.name}</span><div class="barSum"><span class="clientloc"></span><span class="modeChange${setUp.switchRecords ? ' active' : ''}">◐</span><span class="close">×</span></div></div>
                        <div class="content">
                            <div class="dialogue">
                                <div class="boxWrap">
                                    <div class="box">
                                        <div class="words"><div class="historyContent">${setUp.switchRecords ? '<div class="loader"><div class="loaderInner"><div></div><div></div><div></div></div></div>' : ''}</div></div>
                                        <div class="toBottom">有新消息 &#8675;</div>
                                    </div>
                                </div>
                                <div class="quick"><span class="expression"><span title="表情包"><em></em><em></em></span></span><div class="emoji">
                                <a title="鼓掌"><img src="../img/emo01.gif"/></a>
                                <a title="偷乐"><img src="../img/emo02.gif"/></a>
                                <a title="点头"><img src="../img/emo03.gif"/></a>
                                <a title="欢呼"><img src="../img/emo04.gif"/></a>
                                <a title="得意"><img src="../img/emo05.gif"/></a>
                                <a title="懵圈"><img src="../img/emo06.gif"/></a>
                                <a title="点赞"><img src="../img/emo07.gif"/></a>
                                <a title="拜拜"><img src="../img/emo08.gif"/></a>
                                <a title="送花"><img src="../img/emo09.gif"/></a>
                                </div><span class="uploadPic"><span>&#x1F5BC;</span><input class="inputPic" type="file" accept="image/*" title="选择图片" /></span></div>
                                <div class="oper">
                                    <textarea class="ipt" maxlength="2000" contenteditable="true" placeholder="输入您想说的话..."></textarea>
                                    <div class="tool"><small class="warn">空的发不了哦</small><span align="right" class="send">发 送</span></div>
                                </div>
                            </div>
                        </div>`;
    m.appendChild(node);

    var w = node.getElementsByClassName('words')[0], s = node.getElementsByClassName('send')[0], a = node.getElementsByClassName('ipt')[0], 
        b = node.getElementsByClassName('box')[0], warn = node.getElementsByClassName('warn')[0], tb = node.getElementsByClassName('toBottom')[0], 
        inputPic = node.getElementsByClassName('inputPic')[0], modeChange = node.getElementsByClassName('modeChange')[0], close = node.getElementsByClassName('close')[0], 
        q = node.getElementsByClassName('quick')[0].getElementsByTagName('a');

    var newItem;
    newItem = document.createElement('div');
    newItem.className = 'time';
    if(!times[v.id]) times[v.id] = {};
    times[v.id].time = new Date();
    newItem.innerHTML = formatDate(times[v.id].time);
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
            a.value = '&hhwd:0,'+this.children[0].getAttribute('src').split('emo')[1].replace('.gif','');
            send();
            a.value = val;
        });
    }
    function send(){
        if(a.value.trim() == ''){
            warn.innerText = '空的发不了哦';
            warn.setAttribute('active', 0);
            clearTimeout(times[v.id].t);
            times[v.id].t = setTimeout(function(){warn.removeAttribute('active');}, 1500);
            return;
        }else{
            warn.removeAttribute('active');
        }
        var now = new Date();
        if((now.getTime()-times[v.id].time.getTime())/(1000*60)>1 || w.children.length <= 1){
            newItem = document.createElement('div');
            newItem.className = 'time';
            times[v.id].time = now;
            newItem.innerHTML = formatDate(times[v.id].time);
            w.appendChild(newItem);
        }
        times[v.id].time = now;
        newItem = document.createElement('div');
        newItem.className = 'user';
        val = a.value;
        newItem.innerHTML = '<div><span>'+showSpe(val)+'</span></div><i style="background:'+user.bgColor+';color:'+user.color+'">'+user.name[0]+'</i>';
        w.appendChild(newItem);
        b.scrollTop = b.scrollHeight - b.clientHeight;
        webSocket.send(JSON.stringify({chatType: v.id === 'group' ? 'group' : 'room', sender: {id: user.id, name: user.name, bgColor: user.bgColor, color: user.color}, reciever: {id: v.id, name: v.name}, messageType: 'talk', message: a.value}));
        a.value = '';
    }
    inputPic.addEventListener('change', function(event) {
        const file = event.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function(e) {
                compressBase64Image(e.target.result, maxSizeInBytes, function(compressedImage) {
                    var val = a.value;
                    a.value = '&hhwd:1,'+compressedImage;
                    send();
                    a.value = val;
                });
            };
            reader.readAsDataURL(file);
            event.target.value = '';
        }
    });
    modeChange.addEventListener('click', function(){
        let isRecording = hasClass(modeChange, 'active'),
            roomStr = v.id === 'group' ? '群聊' : '此包厢';
        triggerConfirm({text: `即将${isRecording ? '删除' + roomStr + '记录并开启无痕模式' : '开启记录模式'}，是否继续？`}, () => {
            webSocket.send(JSON.stringify({chatType: v.id === 'group' ? 'group' : 'room', sender: {id: user.id, name: user.name}, reciever: {id: v.id, name: v.name}, messageType: 'switchRecords', message: !isRecording}));
            closeConfirm();
        });
    });
    close.addEventListener('click', function(){
       triggerConfirm({text: c.id === 'group' ? `即将遁去，是否继续？`: `即将解散包厢“${c.name}”, 是否继续`}, () => {
           /*u.removeChild(liNode);
            m.removeChild(node);
            var l = u.children.length;
            if(l > 0){
                excuFn(u.children[l-1]);
            }else{
                c = '';
                location.reload();
            }*/
            if(c.id === 'group') {
                location.reload();
            } else {
                close.setAttribute('disabled', '');
                webSocket.send(JSON.stringify({sender: {id: user.id, name: user.name}, reciever: {id: v.id, name: v.name}, messageType: 'closeRoom'}));
                closeConfirm();
            }
       });
    });
    var ns = document.createElement("script");
    ns.setAttribute("type", "text/javascript");
    if(setUp.switchRecords) webSocket.send(JSON.stringify({chatType: v.id === 'group' ? 'group' : 'room', sender: {id: user.id, name: user.name}, reciever: {id: v.id, name: v.name}, messageType: 'records'}));
}
function showSpe(str){
    let htmlStr = '',
        val = str.split('&hhwd:');
    if(val.length<2){
        htmlStr = '<xmp>'+val[0]+'</xmp>';
    }else{
        val = val[1].split(',');
        switch(val[0]) {
            case '0': 
                htmlStr = '<img class="emoj" src="../img/emo'+val[1]+'.gif"/>';
                break;
            case '1':
                let imgStr = val.join(',').replace('1,', '');
                htmlStr = '<span class="pic" onclick="showLargeImage(\''+imgStr+'\')"><img src="'+imgStr+'"/></span>';
                break;
        } 
    }
    return htmlStr;
}
function addClass(obj, cls) {
    if (!this.hasClass(obj, cls)) {
        obj.className += " " + cls;
    }
}
function removeClass(obj, cls) {
    if (hasClass(obj, cls)) {
        var reg = new RegExp('(^|\\s)' + cls + '(\\s|$)', 'g');
        
        // 使用正则替换删除类名，确保中间空格不丢失
        obj.className = obj.className.replace(reg, '$1').trim();

        // 确保只有一个空格
        obj.className = obj.className.replace(/\s{2,}/g, ' ');
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
                    return !!ms ? '<div class="kf"><span><i style="background:'+ms.sender.bgColor+';color:'+ms.sender.color+'">'+ms.sender.name[0]+'</i><b title="'+ms.sender.name+'">'+ms.sender.name+'</b></span><div><span>'+showSpe(ms.message)+'</span></div></div>' : '';
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
function triggerClick(event) {
    let dom = document.getElementById('cornfirmPop');
    if(event.keyCode == '13' && !dom.hasAttribute('disabled')) confirmCallback(true);
}
function confirmCallback(isConfirm) {
    let dom = document.getElementById('cornfirmPop'),
        textDom = document.getElementById('confirmText'),
        customDom = document.getElementById('customBox');
    if(isConfirm) {
        confirmExcution && confirmExcution();
    }else closeConfirm();
}
function closeConfirm() {
    let dom = document.getElementById('cornfirmPop'),
        textDom = document.getElementById('confirmText'),
        customDom = document.getElementById('customBox'),
        errorDom = document.getElementById('confirmError');
    textDom.innerText = '';
    customDom.innerHTML = '';
    errorDom.innerText = '';
    confirmExcution = null;
    removeClass(dom, 'active');
    dom.removeAttribute('popid');
    if(dom.hasAttribute('waitting'))
        dom.removeAttribute('waitting');
    if(dom.hasAttribute('disabled'))
        dom.removeAttribute('disabled');
}
function triggerConfirm(content, callback, beforeCallback) {
    let dom = document.getElementById('cornfirmPop'),
        textDom = document.getElementById('confirmText'),
        customDom = document.getElementById('customBox');
    textDom.innerText = content.text || '';
    customDom.innerHTML = content.code || '';
    confirmExcution = callback;
    addClass(dom, 'active');
    dom.setAttribute('popid', guid());
    beforeCallback && beforeCallback();
}
function selectRoom(roomId){
    let oDom = document.getElementById(c.id),
        ovDom = document.getElementById('v'+c.id),
        v = rooms.find(r => r.id === roomId);
    let cDom = document.getElementById(v.id),
        cvDom = document.getElementById('v'+v.id);
    if(cvDom) {
        if(oDom) removeClass(oDom, 'active');
        if(ovDom) removeClass(ovDom, 'active');
        addClass(cDom, 'active');
        addClass(cvDom, 'active');
        removeClass(cDom, 'newmsg');
        c = v;
        let b = cvDom.getElementsByClassName('box')[0]
        b.scrollTop = b.scrollHeight - b.clientHeight;
    } else if(v.question){
        triggerConfirm({
            text: `包厢${v.name}问题为“${v.question}”，请写出答案：`, 
            code: `<div style="margin: 0 0 10px;"><input id="myAnswer" placeholder="答案" style="width:100%;box-sizing:border-box;outline:none;" onkeypress="triggerClick(event)"/></div>`
        }, () => {
            let dom = document.getElementById('cornfirmPop'),
                domAns = document.getElementById('myAnswer'),
                errorDom = document.getElementById('confirmError');
            
            if(domAns.value) {
                errorDom.innerText = '';
                dom.setAttribute('waitting', '');
                dom.setAttribute('disabled', '');
                webSocket.send(JSON.stringify({sender: {id: user.id, name: user.name}, reciever: {id: v.id, name: v.name}, messageType: 'checkRoom', message: {answer: domAns.value, applyId: dom.getAttribute('popid')}}));
            }else {
                errorDom.innerText = '* 所填项不能为空';
            }
        });
    }
}
function apply() {
    triggerConfirm({
        text: `请设置包厢名、准入的问题和答案：`, 
        code: `<div><input id="applyRoomName" placeholder="包厢名" style="width:100%;box-sizing:border-box;outline:none;" onkeypress="triggerClick(event)"/></div>
        <div style="margin-top: 10px;"><input id="applyQuestion" placeholder="问题" style="width:100%;box-sizing:border-box;outline:none;" onkeypress="triggerClick(event)"/></div>
        <div style="margin: 10px 0;"><input id="applyAnswer" placeholder="答案" style="width:100%;box-sizing:border-box;outline:none;" onkeypress="triggerClick(event)"/></div>`
    }, () => {
        let dom = document.getElementById('cornfirmPop'),
            domName = document.getElementById('applyRoomName'),
            domQue = document.getElementById('applyQuestion'),
            domAns = document.getElementById('applyAnswer'),
            errorDom = document.getElementById('confirmError');
        
        if(domName.value && domQue.value && domAns.value) {
            errorDom.innerText = '';
            dom.setAttribute('waitting', '');
            dom.setAttribute('disabled', '');
            webSocket.send(JSON.stringify({sender: {id: user.id, name: user.name}, reciever: {name: domName.value}, messageType: 'applyRoom', message: {question: domQue.value, answer: domAns.value, applyId: dom.getAttribute('popid')}}));
        }else {
            errorDom.innerText = '* 所填项不能为空';
        }
    });
}
function showTipPop(args) {
    let dom = document.getElementById('tipPop'),
        node = document.createElement('span');
    node.className = args.status;
    node.innerText = args.text;
    dom.appendChild(node);
    setTimeout(() => {
        dom.removeChild(node);
    }, 3000);
}
function refreshMyRooms(rs) {
    myRooms = rs;
    Array.from(u.children).forEach(dom => {
        if(myRooms.indexOf(dom.id) > -1) {
            if(!hasClass(dom, 'registered')) addClass(dom, 'registered');
        } else {
            if(hasClass(dom, 'registered')) removeClass(dom, 'registered');
        } 
    });
}
function getRandomRGBColor() {
    const r = Math.floor(Math.random() * 256); // 红色值 (0-255)
    const g = Math.floor(Math.random() * 256); // 绿色值 (0-255)
    const b = Math.floor(Math.random() * 256); // 蓝色值 (0-255)
    return `rgb(${r}, ${g}, ${b})`;
}
function getContrastingColor(backgroundColor) {
    // 提取 RGB 数值（假设背景色是 RGB 格式）
    const rgb = backgroundColor.match(/\d+/g);

    if (!rgb) return 'black';  // 如果无法解析颜色，默认返回黑色

    const [r, g, b] = rgb.map(Number);  // 将字符串数组转换为数字

    // 计算亮度：使用加权的亮度公式
    const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

    // 如果亮度大于 128，则返回黑色，否则返回白色
    return brightness > 128 ? 'black' : 'white';
}
function showLargeImage(imgStr) {
    let imagePop = document.getElementById('imagePop');
    imagePop.innerHTML = '<img src="'+imgStr+'" /><em onclick="closeImage(event)">×</em>';
    if(!hasClass(imagePop, 'active'))
        addClass(imagePop, 'active');
}
function closeImage(e) {
    let imagePop = document.getElementById('imagePop'),
        img = imagePop.getElementsByTagName('img')[0];
    if(img && img.contains(e.target)) return;
    imagePop.innerHTML = '';
    if(hasClass(imagePop, 'active'))
        removeClass(imagePop, 'active');
}

function compressBase64Image(base64, maxSizeInBytes, callback) {
    let img = new Image();
    img.src = base64;

    img.onload = function() {
        let canvas = document.createElement('canvas');
        let ctx = canvas.getContext('2d');

        let width = img.width;
        let height = img.height;

        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(img, 0, 0, width, height);

        let low = 0.1;
        let high = 0.9;
        let quality = high;

        function compress() {
            canvas.toBlob((blob) => {
                let reader = new FileReader();
                reader.onloadend = function() {
                    let compressedBase64 = reader.result;

                    if (compressedBase64.length > maxSizeInBytes && high - low > 0.01) {
                        quality = (low + high) / 2;
                        if (compressedBase64.length > maxSizeInBytes) {
                            high = quality;
                        } else {
                            low = quality;
                        }
                        compress();
                    } else {
                        callback(compressedBase64);
                    }
                };
                reader.readAsDataURL(blob);
            }, 'image/jpeg', quality);
        }

        compress();
    };
}

m.addEventListener('mousedown', (e) => {
    if(sumInfo.contains(e.target)) return;
    if(hasClass(sumInfo, 'open')) {
        removeClass(sumInfo, 'open');
    }
});