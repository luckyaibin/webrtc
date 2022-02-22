const express = require("express");
const WebSocket = require("ws");
const http = require("http");
const uuidv4 = require("uuid").v4;
//const { uuidv4:uuidv4} = require("uuid");

console.log(uuidv4)

const app = express();

const port = process.env.PORT || 9000;

//initialize a http server
const server = http.createServer(app);

//initialize the WebSocket server instance
const wss = new WebSocket.Server({ server });

let users = {};

const sendTo = (connection, message) => {
  connection.send(JSON.stringify(message));
};

const sendToAll = (clients, type, { name, account,longititude,latitude }) => {
  Object.values(clients).forEach(client => {
    if (client.account !== account) {
      client.send(
        JSON.stringify({
          type,
          user: { name, account ,longititude,latitude}
        })
      );
    }
  });
};

wss.on("connection", ws => {
  ws.on("message", msg => {
    
    let data;
    //accept only JSON messages
    try {
      data = JSON.parse(msg);
    } catch (e) {
      console.log("Invalid JSON");
      data = {};
    }
    console.log("收到消息:",data,ws._socket.remoteAddress,ws._socket.remotePort)
    const { offer, answer, candidate } = data;
    const type = data.type
    
    //保证要先登录
    // if (users[name]==null && type!="login"){
    //   ws.send(JSON.stringify({"error":"请先登录"}))
    //   return 
    // }

    switch (type) {
      case "prepare":

      //when a user tries to login
      case "login":
        var name = data.name
        //var account = data.account
        //Check if username is available
        // if (users[account]) {
        //   sendTo(ws, {
        //     type: "login",
        //     success: false,
        //     message: "account is already online"
        //   });
        // } else {
          const account = data.account || uuidv4();
          const loggedIn = Object.values(
            users
          ).map(({ account, name }) => ({ account, name }));

          //保存连接
          users[account] = ws;
          ws.account = account;
          ws.name = name;
          ws.longititude = (Math.random() - 0.5) * 180
          ws.latitude = (Math.random() - 0.5) * 90
          //回复登录成功
          sendTo(ws, {
            type: "login",
            success: true,
            account:account,
            users: loggedIn
          });
          //把当前登录用户给所有人返回一遍
          sendToAll(users, "updateUsers", ws);
        //}
        break;
      case "signal":
        const toAccount = data.to
        const signalData = data.signalData
        //转发给对应的人
        const signalRecipient = users[toAccount];
        if (!!signalRecipient) {
          sendTo(signalRecipient, {
            type: "signal",
            signalData,
            from: ws.account
          });
        } else {
          sendTo(ws, {
            type: "error",
            message: `User ${toAccount} does not exist!`
          });
        }
        break;
      // case "offer":
      //   //Check if user to send offer to exists
      //   const toAccount = data.to
      //   //转发给对应的人
      //   const offerRecipient = users[toAccount];
      //   if (!!offerRecipient) {
      //     sendTo(offerRecipient, {
      //       type: "offer",
      //       offer,
      //       from: ws.account
      //     });
      //   } else {
      //     sendTo(ws, {
      //       type: "error",
      //       message: `User ${toAccount} does not exist!`
      //     });
      //   }
      //   break;
      // case "answer"://转发应答
      //   //Check if user to send answer to exists
      //   const toAccount = data.to
      //   const answerRecipient = users[toAccount];
      //   if (!!answerRecipient) {
      //     sendTo(answerRecipient, {
      //       type: "answer",
      //       answer,
      //       from:ws.account
      //     });
      //   } else {
      //     sendTo(ws, {
      //       type: "error",
      //       message: `User ${toAccount} does not exist!`
      //     });
      //   }
      //   break;
      // case "candidate":
      //   const candidateRecipient = users[name];
      //   if (!!candidateRecipient) {
      //     sendTo(candidateRecipient, {
      //       type: "candidate",
      //       candidate
      //     });
      //   }
      //   break;
      case "leave":
        sendToAll(users, "leave", ws);
        break;
      default:
        sendTo(ws, {
          type: "error",
          message: "Command not found: " + type
        });
        break;
    }
  });
  ws.on("close", function() {
    delete users[ws.account];
    sendToAll(users, "leave", ws);
  });
  //send immediately a feedback to the incoming connection
  ws.send(
    JSON.stringify({
      type: "connect",
      message: "Well hello there, I am a WebSocket server"
    })
  );
});
//start our server
server.listen(port, () => {
  console.log(`Signaling Server running on port: ${port}`);
});
