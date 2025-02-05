require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '../public')));

// Connect to MongoDB Atlas
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Define Chat Schema
const chatSchema = new mongoose.Schema({
    sender: String,
    room: String,
    text: String,
    timestamp: { type: Date, default: Date.now }
});
const Chat = mongoose.model('Chat', chatSchema);

let users = {};

io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('join', async ({ username, room }) => {
        users[socket.id] = { username, room };
        socket.join(room);
        socket.emit('loadMessages', await Chat.find({ room }).sort({ timestamp: 1 }));
    });

    socket.on('message', async (msg) => {
        const user = users[socket.id];
        if (!user || !user.username) return;

        const chatMessage = new Chat({
            sender: user.username,
            room: user.room,
            text: msg
        });

        await chatMessage.save();
        io.to(user.room).emit('message', { sender: user.username, text: msg });
    });

    socket.on('disconnect', () => {
        delete users[socket.id];
        console.log('User disconnected');
    });
});

server.listen(3000, () => {
    console.log('Server is running on port 3000');
});