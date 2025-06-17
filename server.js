const PORT = process.env.PORT || 3000;
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: {
    origin: "*", // Allow all origins
    methods: ["GET", "POST"]
  }
});

// Serve static files
app.use(express.static(__dirname));

// Serve index.html for all routes to support client-side routing
app.get('*', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

const users = {};
console.log("Anubhav Chat Server Started");

io.on('connection', socket => {
  console.log('User connected:', socket.id);

  socket.on('new-user', name => {
    users[socket.id] = name;
    console.log(`${name} joined the chat`);
    socket.broadcast.emit('user-connected', name);
  });

  socket.on('send-chat-message', message => {
    console.log(`Message from ${users[socket.id]}: ${message}`);
    socket.broadcast.emit('chat-message', { 
      message: message, 
      name: users[socket.id] || 'Anonymous'
    });
  });

  // Handle typing indicators
  socket.on('typing', name => {
    socket.broadcast.emit('user-typing', name);
  });

  socket.on('stop-typing', name => {
    socket.broadcast.emit('user-stop-typing');
  });

  socket.on('disconnect', () => {
    if (users[socket.id]) {
      console.log(`${users[socket.id]} disconnected`);
      socket.broadcast.emit('user-disconnected', users[socket.id]);
      delete users[socket.id];
    }
  });
});

// Start the server
http.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});