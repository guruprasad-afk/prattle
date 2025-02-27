const express = require("express");
const socketio = require("socket.io");
const Filter = require("bad-words");
const http = require("http");
const path = require("path");
const {
  generateMessage,
  generateLocationMessage
} = require("./utils/messages");
const {
  addUser,
  removeUser,
  getUser,
  getUsersInRoom
} = require("./utils/users");

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const port = process.env.PORT || 3000;
const publicDirectoryPath = path.join(__dirname, "../public");

app.use(express.static(publicDirectoryPath));

io.on("connection", socket => {
  socket.on("join", ({ username, room }, ack) => {
    const { error, user } = addUser({
      id: socket.id,
      username,
      room
    });

    if (error) {
      return ack(error);
    }

    socket.join(user.room);

    socket.emit("message", generateMessage("Welcome!", "Chat-App"));
    socket.broadcast
      .to(user.room)
      .emit(
        "message",
        generateMessage(`${user.username} has joined the chat`, "Chat-App")
      );

    io.to(user.room).emit("updateRoom", {
      room: user.room,
      users: getUsersInRoom(user.room)
    });

    ack();
  });

  socket.on("sendMessage", (message, ack) => {
    const filter = new Filter();

    if (filter.isProfane(message)) {
      return ack("Profanity is not allowed");
    }

    const user = getUser(socket.id);

    io.to(user.room).emit("message", generateMessage(message, user.username));
    ack();
  });

  socket.on("sendLocation", (location, ack) => {
    const user = getUser(socket.id);

    io.to(user.room).emit(
      "sentLocation",
      generateLocationMessage(
        `https://google.com/maps?q=${location.latitude},${location.longitude}`,
        user.username
      )
    );
    ack();
  });

  socket.on("disconnect", () => {
    const user = removeUser(socket.id);

    if (user) {
      io.to(user.room).emit(
        "message",
        generateMessage(`${user.username} has left the chat`, "Chat-App")
      );
      io.to(user.room).emit("updateRoom", {
        room: user.room,
        users: getUsersInRoom(user.room)
      });
    }
  });
});

server.listen(port, () => {
  console.log("Server is running on Port:" + port);
});
