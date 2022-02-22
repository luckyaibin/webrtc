

window.onload=function(){
    console.log("加载完毕打印")
    startup()
} 

const sendJSON = (connection, message) => {
  connection.send(JSON.stringify(message));
};

var signalingAddr = "ws://192.168.1.145:9000"

ws = new WebSocket(signalingAddr)
ws.sendJSON = (json)=>{
  var data = JSON.stringify(json)
  console.log("ws发送:",data)
  ws.send(data)
}

ws.onopen = function(evt) { 
    console.log("连接打开",evt)
}; 
ws.onclose = function(evt) { 
    console.log("连接断开",evt)
}; 

ws.onerror = function(evt) { 
  console.log("连接出错",evt)
}; 

ws.onmessage = function(evt) { 
    let data;
    try {
      data = JSON.parse(evt.data);
    } catch (e) {
      console.log("Invalid JSON");
      data = {};
    }
    console.log("收到消息",data)
    var type = data.type;
    switch (type) {
      case "signal":
        var fromAccount = data.from;
        var signalData = data.signalData
        var conn= getConnection(fromAccount)
        if (!conn){
          acceptConnection(fromAccount,signalData)
        }else{
          conn.peer.signal(signalData)
        }
      break;
      case "login":
        if (data.success ){
          console.log("login 成功:",data)
          dataNearbyUsers = data.users
          gSelfAccount = data.account
          UISetNearbyList(dataNearbyUsers)
        }else{
          console.log("login 失败",data)
        }
       
        break;
      case "updateUsers"://有新的人出现
        var user = data.user 
        dataNearbyUsers[user.account] = user
        UISetNearbyList(dataNearbyUsers)
        break;
    }
};

function startup() {
    prepareButton = document.getElementById('prepareButton');//准备按钮，点击后连接signaling
    connectButton = document.getElementById('connectButton');
    disconnectButton = document.getElementById('disconnectButton');

    messageInputBox = document.getElementById('message');
    sendButton = document.getElementById('sendButton');    

    document.querySelector('#loginBtn').addEventListener('click', ev => {
      // ev.preventDefault()
      // p.signal(JSON.parse(document.querySelector('#incoming').value))
      console.log("login pressed")
      //var currentAcc = window.location.hash  
      var acc = document.querySelector('#loginAccount').value
      var name = document.querySelector('#loginName').value
      console.log(acc,name,"登录")
      login(acc,name)
    })

    //UISetNearbyList(dataNearbyUsers)
    var recent = localStorage.getItem("recentChat")
    dataRecentChatUsers = JSON.parse(recent)
    console.log("获取当前最近数据",dataNearbyUsers)
    UISetRecentChatList(dataRecentChatUsers)
  }

  //最近联系人
  var dataRecentChatUsers = {
    // "wangaibin":{
    //   "account":"wangaibin",
    //   "name":"Alone",
    //   "messages":[
    //       {
    //         "account":"wangjunhao","name":"Awake","time":"2022-02-17 18:00:00","content":"你好"
    //       },
    //       {
    //         "account":"wangjunhao","name":"Awake","time":"2022-02-17 18:01:00","content":"1?"
    //       },
    //       {
    //         "account":"wangaibin","name":"Alone","time":"2022-02-17 18:01:00","content":"是的,我在"
    //       }
    //     ]//最近100条信息
    // },
    // "wangjunhao":{
    //   "account":"wangjunhao",
    //   "name":"Awake",
    //   "messages":{}
    // }
  }

  var gSelfAccount
  //数据
  var dataNearbyUsers = {
    // "wangaibin":{
    //   "account":"wangaibin",
    //   "name":"Alone",
    //   "distance":560,
    //   "longititude":32.01,
    //   "latitude":152.1,
    // },
    // "wangjunhao":{
    //   "account":"wangjunhao",
    //   "name":"Awake",
    //   "distance":340,
    //   "longititude":32.02,
    //   "latitude":152.3,
    // }
  }

  function UIFillReceiveBox(messages,selfAccount){
    var receiveBox = document.getElementById('receivebox');
    receiveBox.innerHTML = '';//先清空
    messages.forEach((message)=>{
      UIAddOneMessage(message,selfAccount)
    })
  }
  //在内容框内追加一条内容
  function UIAddOneMessage(message,selfAccount){
    var receiveBox = document.getElementById('receivebox');   
    //创建元素(标签)，并放入相应父元素中  
    var op1 = document.createElement("p");
    var odiv = document.createElement("div");

    odiv.style.overflow="hidden";
    odiv.style.overflowY = "auto";

    op1.style.border = "1px solid #ccc";
    op1.style.borderRadius = "10px";//-去掉，小驼峰命名
    //op1.style.maxWidth = "100px";//最大宽度(也是小驼峰)
    op1.style.margin="10px"
    op1.style.padding="5px"
    var now = new Date();
    op1.innerHTML = message.content ;

    //解决子元素float带来的高度塌陷(会同一行显示)
    //messageInputBox.value="";//清空文本域的内容
    if(selfAccount != message.account){
      op1.style.background = "gray";
      op1.style.float="left";
    }else{
      op1.style.background = "gray";
      op1.style.float="right"; 
      console.log("float to where???")
    }
    receiveBox.appendChild(odiv);
    odiv.appendChild(op1);
    receiveBox.scrollTop = receiveBox.scrollHeight;
  }

  function UISetNearbyList(nearbyusers){
    nearbylist = document.getElementById('nearbylist')
    if(nearbylist){
      console.log("附近列表",nearbyusers)
      Object.keys(nearbyusers).forEach(key => {
        var user = nearbyusers[key]

        var name = document.createElement("label")
        name.setAttribute("style","color: rgb(215, 233, 250);")
        //name.innerHTML= user.name + "("+ user.distance + "m)"
        name.innerHTML= user.name
        //列表元素
        var li = document.createElement('li')
        //li.setAttribute("class","messagebox")
  
        var btnChat = document.createElement('button')
        btnChat.setAttribute("class","buttonleft")
        btnChat.data = "hi"
        if (user.signal!="" && user.signal!=null ){ 
          btnChat.innerHTML = 'chat with';
          //btnChat.disabled = false
        }else{
          btnChat.innerHTML = 'no disturb';
          //btnChat.disabled = true
        }
        btnChat.innerHTML = 'chat with';
        btnChat.onclick = function(handler,ev){
          console.log("想要和"+user.account+"建立连接")
          createConnection(btnChat,user.account)
        }
        li.appendChild(name)
        li.appendChild(btnChat)
        //li.appendChild(btnConnect)
        //li.appendChild(btnDisconnect)
      
        nearbylist.appendChild(li)
      });     
    }
  }


  function UISetRecentChatList(users){
    //最近列表
    recentchatlist = document.getElementById('recentchatlist')
    if (!users){
      recentchatlist.innerHTML = ""
    }else {
      console.log("最近列表",recentchatlist)
      recentchatlist.onscroll=function(){
        console.log("滚动中......")
        console.log(recentchatlist.scrollTop() )
        console.log(recentchatlist.height())
      };

      Object.keys(users).forEach(account => {
        //列表元素
        var li = document.createElement('li')
        //li.setAttribute("class","messagebox")

        var user = users[account]
        var name = document.createElement("label")
        name.setAttribute("style","color: rgb(215, 233, 250);")
        name.innerHTML= user.name
    
        var btnChat = document.createElement('button')
        btnChat.setAttribute("class","buttonleft")
        btnChat.data = "hi"
        btnChat.innerHTML = 'chat';
        btnChat.onclick = function(handler,ev){ //打开记录
          //alert("hello from " + btnChat.data + JSON.stringify(handler)+ev)
          UIFillReceiveBox(user.messages,"wangaibin")
        }
        //btnChat.addEventListener('click', sendMessage, false);

        
  
        // var btnConnect = document.createElement('button')
        // btnChat.setAttribute("class","buttonleft")
  
        // btnConnect.data = 'I am btnConnect'
        // btnConnect.innerHTML = 'connect'
        // btnConnect.onclick = function(handler,ev){
        //   alert("hello from " + btnConnect.data)
        // }
  
        var btnDisconnect = document.createElement('button')
        btnChat.setAttribute("class","buttonright")
        btnDisconnect.data = 'I am btnDisconnect'
        btnDisconnect.innerHTML = 'disconnect'
        btnDisconnect.onclick = function(handler,ev){
          alert("hello from " + btnDisconnect.data)
        }
  
   
        li.appendChild(name)
        li.appendChild(btnChat)
        //li.appendChild(btnConnect)
        li.appendChild(btnDisconnect)
      
        recentchatlist.appendChild(li)
      });     
    }
  }
 
  function handleSendChannelStatusChange(event){
       if (sendChannel){
          var status = sendChannel.readyState;
          console.log("发送端: DataChannel状态改变:",event)
          if (status=="open"){
              messageInputBox.disabled = false;
              messageInputBox.focus();
              sendButton.disabled = false;
              disconnectButton.disabled = false;
              connectButton.disabled = true;
          }else{
              messageInputBox.disabled = true;
              sendButton.disabled = true;
              connectButton.disabled = false;
              disconnectButton.disabled = true;
          }
      }
  }

  //主动告诉其他人:我是可以接收你们webrtc连接的
  function login(currentAcc,name){
    //等待其他人来连接的webrtc
    //建立远程节点
    ws.sendJSON({
        type:"login",
        account:currentAcc,
        name:name
      })
  }

var currentConnections = {
  /*和其他用户建立的所有的本地连接
    "wangjunhao":{ "ok"=true,"initiator":true,"peer":SimplePeer,"funcs":{} }
  */
}

//获取和某个用户的连接
function getConnection(connectToAcc){
  return currentConnections[connectToAcc]
}

//主动发起连接
function createConnection(btnChat,connectToAcc){
  console.log("开始建立主动连接:",connectToAcc)
    const p = new SimplePeer({
      initiator: true,
      trickle: false
    })
    var connConf = {
      "initiator":true,
      "peer":p,
      "funcs":{},
    }
    currentConnections[connectToAcc] = connConf

    p.on('error', err => {
      //出错了就删除
      console.log('error', err)
      delete currentConnections[connectToAcc]
    })

    //本地signal通知回调，需要发送给远端
    p.on('signal', data => {
      console.log('SIGNAL', JSON.stringify(data))
      document.querySelector('#outgoing').textContent = JSON.stringify(data)
      console.log("发送offer给",connectToAcc)
       ws.sendJSON({
        "type":"signal",
        "signalData":data,
        "to":connectToAcc,
       })
    })
    //把远端的signal设置给本地
    // document.querySelector('form').addEventListener('submit', ev => {
    //   ev.preventDefault()
    //   p.signal(JSON.parse(document.querySelector('#incoming').value))
    // })

    p.on('connect', () => {
      console.log('CONNECT'+" to:"+connectToAcc+'主动连接建立成功')
      p.send('whatever' + Math.random())
      btnChat.innerHTML = "disconnect"

      var recent = localStorage.getItem("recentChat")
      dataRecentChatUsers = JSON.parse(recent)
      if  (!dataRecentChatUsers){
        dataRecentChatUsers = {}
      }
      if (!dataRecentChatUsers[connectToAcc]){
        dataRecentChatUsers[connectToAcc] = {
          "account":connectToAcc,
          //"name":"Alone",
          "messages":[]
          }
      }
    })
    p.on('data', data => {
      console.log('data: ' + data)
      if  (!dataRecentChatUsers){
        dataRecentChatUsers = {}
      }
      if (!dataRecentChatUsers[connectToAcc]){
        dataRecentChatUsers[connectToAcc] = {
          "account":connectToAcc,
          //"name":"Alone",
          "messages":[]
          }
      }
      var newMsg = {
        "account":"wangjunhao",
        "time":unixMs,
        "content":data
      }
      //添加一条记录
      var now = new Date();
      var unixMs = now.getTime()
      dataRecentChatUsers[connectToAcc].messages.push(newMsg)
      var recent = JSON.stringify(dataRecentChatUsers)
      localStorage.setItem("recentChat",recent)

      UIAddOneMessage(newMsg,gSelfAccount)
    })
  }
  //可以主动响应别人发起的连接
function acceptConnection(connectFromAcc,signalData){
    console.log("接收新连接:"+connectFromAcc,signalData)
    const p = new SimplePeer({
      initiator: false,
      trickle: false
    })

    currentConnections[connectFromAcc] = {
      "initiator":false,
      "peer":p,
      "funcs":{},
    }

    p.on('error', err => {
      //出错了就删除
      console.log('error', err)
      delete currentConnections[connectFromAcc]
    })
    
    p.signal(signalData)
  
    p.on('signal', data => {
      console.log('SIGNAL 被动连接收到signal通知?????', JSON.stringify(data))

      ws.sendJSON({
        "type":"signal",
        "signalData":data,
        "to":connectFromAcc,
      })
    })
    p.on('connect', () => {
      console.log('CONNECT'+" from:"+connectFromAcc+'被动连接建立成功')
      p.send('whatever' + Math.random())
    })
    p.on('data', data => {
      console.log('data: ' + data)
    })
  }
 
  //本地发送消息
  function sendMessage(){
    var message = messageInputBox.value;
    sendChannel.send(message);

    messageInputBox.value = "";
    messageInputBox.focus();
  }

  //远端接收消息
  function handleReceiveMessage(event){
      var el = document.createElement("p");
      var txtNode = document.createTextNode(event.data);

      el.appendChild(txtNode)
      receiveBox.appendChild(el);
  }

  //断开
  function disconnectPeers(){
    console.log("发送端: 主动断开连接")
    // Close the RTCDataChannels if they're open.
    sendChannel.close();
    receiveChannel.close();
    // Close the RTCPeerConnections
    localConnection.close();
    remoteConnection.close();
    sendChannel = null;
    receiveChannel = null;
    localConnection = null;
    remoteConnection = null;

    // Update user interface elements

    connectButton.disabled = false;
    disconnectButton.disabled = true;
    sendButton.disabled = true;

    messageInputBox.value = "";
    messageInputBox.disabled = true;
  }

  