

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
    //accept only JSON messages
    try {
      data = JSON.parse(evt.data);
    } catch (e) {
      console.log("Invalid JSON");
      data = {};
    }
    console.log("收到消息",data)
    var type = data.type;
    var name = data.name;
    switch (type) {
      case "offer": //收到远端的邀请，自己相当于是服务器
        isServer = true

        var offer = data.offer 
        var open_YN = confirm("是否打开新窗口");
        if(open_YN){
          console.log("Yes")
        }
        //创建新的
        remoteConnection = new RTCPeerConnection()
        //创建对 datachannel 的事件处理回调；数据通道打开时该逻辑将被执行， 该回调处理将接收到一个 RTCDataChannel 对象
        remoteConnection.ondatachannel = receiveChannelCallback;
        remoteConnection.onicecandidate = e=> 
        {
            if (e.candidate){
                console.log("远端设置ICE候选人并设置本地的候选人")
                //localConnection.addIceCandidate(e.candidate).catch(handleAddCandidateError)
                ws.sendJSON({
                  "type":"candidate",
                  "candidate":e.candidate,
                  "name":name,
                })
            }
        }
        remoteConnection.setRemoteDescription(new RTCSessionDescription(offer))
        remoteConnection.createAnswer() 
        .then( (answer)=>{
            console.log("offer is:", offer)
            console.log("answer is:",answer)

            remoteConnection.setLocalDescription(answer)
            .then(()=>{
              console.log("remoteConneciton的local,currentlocal description:",remoteConnection.localDescription,remoteConnection.currentLocalDescription)
            //把answer返回给邀请的人
              ws.sendJSON({
                "type":"answer",
                "name":name,
                "answer":remoteConnection.currentLocalDescription,//不能直接使用createAnswer产生的answer
              })
            })
        })
        break;
      case "answer"://自己发出邀请后收到对方响应，自己是客户端，相当于连接上了服务器
          isServer = false
          var answer=data.answer
          console.log("自己发出邀请后收到了响应:",answer)
          var desc = new RTCSessionDescription(answer)
          localConnection.setRemoteDescription(desc)
          break;
      case "candidate"://客户端或服务器收到对方的candidate消息
          console.log("客户端或服务器收到对方的candidate消息",isServer)
          var candidate = data.candidate
          if (isServer) {
            remoteConnection.addIceCandidate(new RTCIceCandidate(candidate))
          }else{
            localConnection.addIceCandidate(new RTCIceCandidate(candidate))
          }
    }
};



function startup() {
    prepareButton = document.getElementById('prepareButton');//准备按钮，点击后连接signaling
    connectButton = document.getElementById('connectButton');
    disconnectButton = document.getElementById('disconnectButton');

    messageInputBox = document.getElementById('message');
    sendButton = document.getElementById('sendButton');    

    // Set event listeners for user interface widgets
  
    //prepareButton.addEventListener('click', prepare, false);
    //connectButton.addEventListener('click', connectPeers, false);
    //disconnectButton.addEventListener('click', disconnectPeers, false);
    //sendButton.addEventListener('click', sendMessage, false);

    //UISetRecentChatList([{"account":"wangaibin"}])

    UISetNearbyList(dataNearbyUsers)

    UISetRecentChatList(dataRecentChatUsers)
  }

  

  //最近联系人
  var dataRecentChatUsers = {
    "wangaibin":{
      "account":"wangaibin",
      "name":"Alone",
      "messages":[
          {
            "account":"wangjunhao","name":"Awake","time":"2022-02-17 18:00:00","content":"你好"
          },
          {
            "account":"wangjunhao","name":"Awake","time":"2022-02-17 18:01:00","content":"1?"
          },
          {
            "account":"wangaibin","name":"Alone","time":"2022-02-17 18:01:00","content":"是的,我在"
          }
        ]//最近100条信息
    },
    "wangjunhao":{
      "account":"wangjunhao",
      "name":"Awake",
      "messages":{}
    }
  }

  //数据
  var dataNearbyUsers = {
    "wangaibin":{
      "account":"wangaibin",
      "name":"Alone",
      "distance":560,
      "longititude":32.01,
      "latitude":152.1,
      "signal":"signal data from 1???"
    },
    "wangjunhao":{
      "account":"wangjunhao",
      "name":"Awake",
      "distance":340,
      "longititude":32.02,
      "latitude":152.3,
      "signal":"signal data from 2???"
    }
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
        name.innerHTML= user.name + "("+ user.distance + "m)"
        //列表元素
        var li = document.createElement('li')
        //li.setAttribute("class","messagebox")
  
        var btnChat = document.createElement('button')
        btnChat.setAttribute("class","buttonleft")
        btnChat.data = "hi"
        if (user.signal!="" && user.signal!=null ){ 
          btnChat.innerHTML = 'chat with';
          btnChat.disabled = false
        }else{
          btnChat.innerHTML = 'no disturb';
          btnChat.disabled = true
        }

        btnChat.onclick = function(handler,ev){
          //alert("hello from " + btnChat.data)
          //connectPeers()
          console.log("想要和"+user.account+"建立连接")
          connectTo(user.account)
        }
  
        // var btnConnect = document.createElement('button')
        // btnChat.setAttribute("class","buttonleft")
  
        // btnConnect.data = 'I am btnConnect'
        // btnConnect.innerHTML = 'connect'
        // btnConnect.onclick = function(handler,ev){
        //   alert("hello from " + btnConnect.data)
        // }
  
        // var btnDisconnect = document.createElement('button')
        // btnChat.setAttribute("class","buttonright")
  
        // btnDisconnect.data = 'I am btnDisconnect'
        // btnDisconnect.innerHTML = 'disconnect'
        // btnDisconnect.onclick = function(handler,ev){
        //   alert("hello from " + btnDisconnect.data)
        // }
  
   
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
    if(recentchatlist){
      console.log("最近列表",recentchatlist)
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

  function handleLocalAddCandidateSuccess(){
    connectButton.disabled = true;
  }

  function handleRemoteAddCandidateSuccess(){
    disconnectButton.disabled = false;
  }

  function handleCreateDiscriptionError(err){
    console.error("启动连接尝试出错：",err)
  }

  //RTCPeerConnection 一旦open, 事件datachannel 被发送到远端以完成打开数据通道的处理， 该事件触发 receiveChannelCallback() 方法
  function receiveChannelCallback(event){
    console.log("receiveChannelCallback,通道建立完成!!!!!!!!!!")
    receiveChannel = event.channel;
    receiveChannel.onmessage = handleReceiveMessage;
    receiveChannel.onopen = handleReceiveChannelStatusChange;
    receiveChannel.onclose = handleReceiveChannelStatusChange;
  }

  function handleAddCandidateError(err){
    console.error("发送或接受端 添加候选人出错",err)
  }

  //远端直接忽略这些事件，只打印
  function handleReceiveChannelStatusChange(event){
    if (receiveChannel){
        console.log("接收端: 管道状态改变为:"+receiveChannel.readyState)
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
  var currentAcc
  var connectToAcc
  var isServer
  //主动告诉其他人:我是可以接收你们webrtc连接的
  function prepare(){
    //等待其他人来连接的webrtc
    //建立远程节点
    currentAcc = window.location.hash  
    ws.sendJSON({
        type:"login",
        name:currentAcc,
      })
  }

var currentConnections = {
  /*和其他用户建立的所有的本地连接
    "wangjunhao":{ "ok"=true,"initiator":true,"peer":SimplePeer,"funcs":{} }
  */
}

//主动发起连接
  function connectTo(connectToAcc){
    if (currentConnections[connectToAcc]){
      return
    }
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
    p.on('signal', data => {
      console.log('SIGNAL', JSON.stringify(data))
      document.querySelector('#outgoing').textContent = JSON.stringify(data)
      console.log("发送offer给",connectToAcc)
       ws.sendJSON({
        "type":"offer",
        "offer":data,
        "name":connectToAcc,
       })
    })
    document.querySelector('form').addEventListener('submit', ev => {
      ev.preventDefault()
      p.signal(JSON.parse(document.querySelector('#incoming').value))
    })

    p.on('connect', () => {
      console.log('CONNECT')
      p.send('whatever' + Math.random())
    })
    p.on('data', data => {
      console.log('data: ' + data)
    })
  }
  //可以主动响应别人发起的连接
  function accept(connectFromAcc,signalData){
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
    // p.on('signal', data => {
    //   console.log('SIGNAL', JSON.stringify(data))
    //   document.querySelector('#outgoing').textContent = JSON.stringify(data)
    //   console.log("发送answer给",connectToAcc)
    //    ws.sendJSON({
    //     "type":"answer",
    //     "answer":data,
    //     "name":connectToAcc,
    //    })
    // })
    

    document.querySelector('form').addEventListener('submit', ev => {
      ev.preventDefault()
      p.signal(JSON.parse(document.querySelector('#incoming').value))
    })

    p.on('connect', () => {
      console.log('CONNECT')
      p.send('whatever' + Math.random())
    })
    p.on('data', data => {
      console.log('data: ' + data)
    })

    p.signal(signalData)
  }

  function connectPeers(btnEvt){
      console.log("点击了连接按钮")

      var ElementConnectTo = document.getElementById('connectTo')
      //连接的远端
      connectToAcc = ElementConnectTo.value;

       

      localConnection = new RTCPeerConnection()
      localConnection.ondatachannel = (c)=>{console.log("本地datachannel建立完成!!!!",c)};
      sendChannel = localConnection.createDataChannel("sendChannel");
      sendChannel.onopen = handleSendChannelStatusChange;
      sendChannel.onclose = handleSendChannelStatusChange;

      // //建立远程节点
      // remoteConnection = new RTCPeerConnection()
      // //创建对 datachannel 的事件处理回调；数据通道打开时该逻辑将被执行， 该回调处理将接收到一个 RTCDataChannel 对象
      // remoteConnection.ondatachannel = receiveChannelCallback;
      // remoteConnection.onicecandidate = e=> 
      // {
      //     if (e.candidate){
      //         console.log("远端设置ICE候选人并设置本地的候选人")
      //         localConnection.addIceCandidate(e.candidate).catch(handleAddCandidateError)
      //     }
      // }
      //设立ICE 候选人
      localConnection.onicecandidate = e=> {
            if(e.candidate){
                console.log("本地设置ICE候选人并设置远端的候选人")
               //remoteConnection.addIceCandidate(e.candidate).catch(handleAddCandidateError)
                ws.sendJSON({
                  "type":"candidate",
                  "candidate":e.candidate,
                  "name":connectToAcc,
                })

            }
        }
     
      
        
        // localConnection.onicecandidate = e => !e.candidate
        // || remoteConnection.addIceCandidate(e.candidate)
        // .catch(handleAddCandidateError);

        // remoteConnection.onicecandidate = e => !e.candidate
        // || localConnection.addIceCandidate(e.candidate)
        // .catch(handleAddCandidateError);

     //启动连接尝试
     localConnection.createOffer()
     .then(offer => {
       localConnection.setLocalDescription(offer)
       console.log("发送offer给",connectToAcc)
       ws.sendJSON({
        "type":"offer",
        "offer":offer,
        "name":connectToAcc,
       })
     })
     //.then(()=>remoteConnection.setRemoteDescription(localConnection.localDescription))
    // .then(()=>remoteConnection.createAnswer())
    // .then( answer=>remoteConnection.setLocalDescription(answer))
    // .then(()=>localConnection.setRemoteDescription(remoteConnection.localDescription))
     .catch(handleCreateDiscriptionError);
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