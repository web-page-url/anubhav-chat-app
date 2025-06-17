const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatar: { type: String },
  status: { type: String, default: 'Hey there! I am using Chat App.' },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
