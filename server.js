import { createServer } from "http";
import { Server } from "socket.io";

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: "http://localhost:5173/",
});

const allUsers = new Map();

io.on("connection", (socket) => {
  let opponent = null;
  socket.roomName = null;
  allUsers.set(socket.id, { Socket: socket, online: true, playing: false, username: "demo", playingAs: "" });

  socket.on("req_to_play", (data) => {
    const currUser = allUsers.get(socket.id);
    currUser.username = data.playerName;

    allUsers.set(socket.id, currUser);

    for (let [id, user] of allUsers) {
      if (user.online && !user.playing && id !== socket.id && user.username !== "demo") {
        currUser.playing = true;
        currUser.Socket.roomName = `room-${currUser.username}-${currUser.Socket.id}`;
        allUsers.set(socket.id, currUser);
        opponent = user;
        opponent.playing = true;
        opponent.Socket.roomName = currUser.Socket.roomName;
        allUsers.set(opponent.Socket.id, opponent);
        break;
      }
    }

    if (opponent) {
      // console.log(opponent.Socket.roomName, currUser.Socket.roomName);
      // console.log(opponent, currUser);
      socket.join(currUser.Socket.roomName);
      opponent.Socket.join(opponent.Socket.roomName);
      io.to(socket.roomName).emit("roomJoined", {
        room: socket.roomName,
        players: {
          currentPlayer: { playerId: currUser.Socket.id, playerName: currUser.username, playingAs: "cross" },
          opponentPlayer: { playerId: opponent.Socket.id, playerName: opponent.username, playingAs: "circle" },
        },
      });
    } else {
      currUser.Socket.emit("opponentNotFound");
    }
  });

  socket.on("messageSent", function (data) {
    // console.log(data);
    io.to(socket.roomName).emit("messageRecieved", {
      message: data,
      sender: socket.id,
    });
  });

  socket.on("playerMoveUser", function (data) {
    // console.log(data);
    if (socket.roomName) {
      io.to(socket.roomName).emit("updateState", { ...data });
    }
  });

  socket.on("disconnect", function () {
    if (socket.roomName) {
      io.to(socket.roomName).emit("playerExit");
      allUsers.delete(socket.id);
    }
  });
  socket.on("removePlayer", function () {
    if (socket.roomName) {
      allUsers.delete(socket.id);
      io.to(socket.roomName).emit("playerExit");
    }
  });
  socket.on("removePlayerFromSet", function () {
    allUsers.delete(socket.id);
  });
});

httpServer.listen(3000);
