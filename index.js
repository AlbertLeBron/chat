var nus = document.getElementById('nus'), nextus = document.getElementById('nextus'), m = document.getElementById('mwin'), u = document.getElementById('userList'), t, num = 0, state = 0, c = '', time, user = {}, webSocket;

function openClient() {
    var name = document.getElementById('nameIpt').value;
    if(name && name.trim()) {

        webSocket = new WebSocket('ws://119.3.144.14:8870');  

        webSocket.onerror = function(event) {  
            alert('系统忙碌中，请稍等片刻');  
        };
        webSocket.onopen = function(event) {
            var id = 'v'+new Date().getTime()+''+Math.floor(Math.random()*899+100);                
            webSocket.send(JSON.stringify({sender: {id: id, name: name}, messageType: 'login'}));
        };
        webSocket.onclose = function(event){
            console.log("服务器关闭");
        }
        webSocket.onmessage = function(event){
            var message = JSON.parse(event.data);
            
            switch(message.messageType){
                case 'login': 
                        user = message.sender;
                        newUser({chatType: 'group', sender: {id: 'group', name: '群聊'}, reciever: {id: user.id, name: user.name}, messageType: 'talk', message: '一起来嗨吧~'});
                        removeClass(document.getElementById('login'), 'active');
                        break;
                case 'talk':
                        var now = new Date(),
                            node = document.getElementById('v'+c),
                            w = node.getElementsByClassName('words')[0],
                            b = node.getElementsByClassName('box')[0];
                        if((now.getTime()-time.getTime())/(1000*60)>1){
                            newItem = document.createElement('div');
                            newItem.className = 'time';
                            time = now;
                            newItem.innerHTML = time.toLocaleString();
                            w.appendChild(newItem);
                        }
                        time = now;
                        var newItem;
                        if(message.sender.id == user.id) break;
                        newItem = document.createElement('div');
                        newItem.className = 'kf';
                        newItem.innerHTML = '<i><img title="'+message.sender.name+'" src="../img/user.png"/></i><b title="'+message.sender.name+'">'+message.sender.name+'</b><span>'+showSpe(message.message)+'</span>';
                        w.appendChild(newItem);
                        b.scrollTop = 99999;
                        break;
                case 'users': 
                        document.getElementById('v'+c).getElementsByClassName('clientloc')[0].innerText = '当前'+message.message+'人在线';
                        break;
            }
        }
        window.onunload = () => {
		  webSocket.send(JSON.stringify({sender: {id: id, name: name}, messageType: 'close'}));
		}
    } else alert('请输入昵称');
}

function pressOpen(event) {
    if(event.keyCode == '13'){
        document.getElementById('nameSub').click();
    }
}

function newUser(data){
    if(!data){
        alert('创建失败，请稍等片刻')
        return;
    }
    var v = data.sender.id;

    if(c != ''){
        removeClass(document.getElementById(c), 'active');
        removeClass(document.getElementById('v'+c), 'active');
    }
    c = v;
    
    var liNode = document.createElement('div');               
    liNode.id = v;
    liNode.className = 'active';
    liNode.innerText = data.sender.name;
    u.appendChild(liNode);

    liNode.addEventListener('click', function(){
        removeClass(document.getElementById(c), 'active');
        removeClass(document.getElementById('v'+c), 'active');
        c = this.id;
        addClass(document.getElementById(c), 'active');
        addClass(document.getElementById('v'+c), 'active');
        removeClass(this, 'newmsg');
    });

    var node = document.createElement('div');
    node.id = 'v'+v;
    node.className = 'userInfo active';

    node.innerHTML = '<div class="bar">'+data.sender.name+'<span class="close">×</span><span class="clientloc"></span></div>'+
                        '<div class="content">'+
                            '<div class="dialogue">'+
                                '<div class="box">'+
                                    '<div class="words">'+                            
                                    '</div>'+
                                '</div>'+
                                '<div id="quick" class="quick"><span title="表情包">&#9786</span>'+
                                '<a title="鼓掌"><img src="../img/emo01.gif"/></a>'+
                                '<a title="偷乐"><img src="../img/emo02.gif"/></a>'+
                                '<a title="点头"><img src="../img/emo03.gif"/></a>'+
                                '<a title="欢呼"><img src="../img/emo04.gif"/></a>'+
                                '<a title="得意"><img src="../img/emo05.gif"/></a>'+
                                '<a title="懵圈"><img src="../img/emo06.gif"/></a>'+
                                '<a title="点赞"><img src="../img/emo07.gif"/></a>'+
                                '<a title="拜拜"><img src="../img/emo08.gif"/></a>'+
                                '<a title="送花"><img src="../img/emo09.gif"/></a>'+
                                '</div>'+
                                '<div class="oper">'+
                                    '<textarea class="ipt" maxlength="120" contenteditable="true" placeholder="输入您想说的话..."></textarea>'+
                                    '<div class="tool"><small class="warn">空的发不了哦</small><span align="right" class="send">发 送</span></div>'+
                                '</div>'+
                            '</div>'+
                        '</div>';
    m.appendChild(node);

    var w = node.getElementsByClassName('words')[0], s = node.getElementsByClassName('send')[0], a = node.getElementsByClassName('ipt')[0], 
        b = node.getElementsByClassName('box')[0], warn = node.getElementsByClassName('warn')[0], close = node.getElementsByClassName('close')[0],
        q = node.getElementsByClassName('quick')[0].getElementsByTagName('a');

    var newItem;
    newItem = document.createElement('div');
    newItem.className = 'time';
    time = new Date();
    newItem.innerHTML = time.toLocaleString();
    w.appendChild(newItem);

    newItem = document.createElement('div');
    newItem.className = 'kf';
    newItem.innerHTML = '<i><img title="'+data.sender.name+'" src="../img/user.png"/></i><b title="'+data.sender.name+'">'+data.sender.name+'</b><span><xmp>'+data.message+'</xmp></span>';
    w.appendChild(newItem);

    b.scrollTop = w.offsetHeight;
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
        if((now.getTime()-time.getTime())/(1000*60)>1){
            newItem = document.createElement('div');
            newItem.className = 'time';
            time = now;
            newItem.innerHTML = time.toLocaleString();
            w.appendChild(newItem);
        }
        time = now;
        newItem = document.createElement('div');
        newItem.className = 'user';
        val = a.value;
        newItem.innerHTML = '<span>'+showSpe(val)+'</span><i><img src="../img/user.png"/></i>';
        w.appendChild(newItem);
        b.scrollTop = 99999;
        webSocket.send(JSON.stringify({chatType: 'group', sender: {id: user.id, name: user.name}, reciever: {id: 'group', name: '群聊'}, messageType: 'talk', message: a.value}));
        a.value = '';
    }
    close.addEventListener('click', function(){
       if(confirm("即将遁去，是否继续？")){
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
       }
    });
    var ns = document.createElement("script");
    ns.setAttribute("type", "text/javascript");
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

