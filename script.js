// DOM elements
const messageContainer = document.getElementById('message-container');
const messageForm = document.getElementById('send-container');
const messageInput = document.getElementById('message-input');
const typingIndicator = document.getElementById('typing-indicator');
const connectionStatus = document.getElementById('connection-status');
const loadingOverlay = document.getElementById('loading-overlay');
const connectionMessage = document.getElementById('connection-message');
const switchServerButton = document.getElementById('switch-server');

// Determine server URL based on current host
let usingLocalServer = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
// If we're on render.com, use the render URL directly
let onRenderHost = window.location.hostname.includes('render.com');
let serverUrl = onRenderHost 
  ? window.location.origin  // Use the same origin if on render.com
  : (usingLocalServer ? 'http://localhost:3000' : 'https://anubhav-chat.onrender.com');

let connectionAttempts = 0;
const MAX_LOCAL_ATTEMPTS = 2;

// Hide switch server button if we're on render.com already
if (onRenderHost) {
  switchServerButton.style.display = 'none';
}

// Get username and store in local storage for persistence
let name = localStorage.getItem('chat-username');
if (!name) {
  name = prompt('What is your name?') || 'Anonymous';
  localStorage.setItem('chat-username', name);
}

// Connection status updater
function updateConnectionStatus(status, color, message) {
  connectionStatus.textContent = status;
  connectionStatus.style.backgroundColor = color;
  if (message) {
    appendMessage(message, 'system-message');
  }
}

// Function to handle connection
function connectToServer(url) {
  connectionMessage.textContent = `Attempting to connect to ${usingLocalServer ? 'local' : 'remote'} server...`;
  
  // Create socket connection
  try {
    window.socket = io(url, {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 5000,
      forceNew: true  // Force a new connection
    });
  } catch (error) {
    console.error('Failed to connect to Socket.IO server:', error);
    handleConnectionFailure();
    return;
  }
  
  // Socket event listeners
  window.socket.on('connect', () => {
    console.log('Connected to server:', url);
    loadingOverlay.style.display = 'none';
    updateConnectionStatus('Connected', 'var(--success-color)', 'You joined the chat');
    window.socket.emit('new-user', name);
  });
  
  window.socket.on('disconnect', () => {
    updateConnectionStatus('Disconnected', 'var(--error-color)', 'You have been disconnected from the server');
  });
  
  window.socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    connectionAttempts++;
    
    if (usingLocalServer && connectionAttempts >= MAX_LOCAL_ATTEMPTS) {
      connectionMessage.textContent = 'Could not connect to local server. Click the button to try the remote server.';
    } else if (onRenderHost) {
      connectionMessage.textContent = 'Having trouble connecting to the server. Please wait or refresh the page.';
    } else {
      connectionMessage.textContent = `Connection attempt ${connectionAttempts} failed. Retrying...`;
    }
    
    if (!loadingOverlay.style.display || loadingOverlay.style.display === 'none') {
      loadingOverlay.style.display = 'flex';
    }
  });
  
  // Chat message listeners
  window.socket.on('chat-message', data => {
    appendMessage(`${data.name}: ${data.message}`, 'other-message');
    // Play notification sound if user has been inactive
    if (document.hidden) {
      notifyUser(data.name);
    }
  });
  
  window.socket.on('user-connected', name => {
    appendMessage(`${name} connected`, 'system-message');
  });
  
  window.socket.on('user-disconnected', name => {
    appendMessage(`${name} disconnected`, 'system-message');
  });
  
  // Typing indicators
  window.socket.on('user-typing', username => {
    typingIndicator.textContent = `${username} is typing...`;
  });
  
  window.socket.on('user-stop-typing', () => {
    typingIndicator.textContent = '';
  });
}

// Handle connection failure
function handleConnectionFailure() {
  if (usingLocalServer) {
    connectionMessage.textContent = 'Could not connect to local server. Click the button to try the remote server.';
  } else if (onRenderHost) {
    connectionMessage.textContent = 'Server connection failed. Please check your internet connection and refresh the page.';
  } else {
    connectionMessage.textContent = 'Could not connect to any server. Please check your internet connection and refresh.';
  }
}

// Switch server button handler
switchServerButton.addEventListener('click', () => {
  if (window.socket) {
    window.socket.disconnect();
  }
  
  // Switch to remote server
  usingLocalServer = false;
  serverUrl = 'https://anubhav-chat.onrender.com';
  connectionAttempts = 0;
  
  connectionMessage.textContent = 'Switching to remote server...';
  switchServerButton.disabled = true;
  switchServerButton.textContent = 'Switching...';
  
  // Short delay to show user we're doing something
  setTimeout(() => {
    connectToServer(serverUrl);
    switchServerButton.style.display = 'none';
  }, 1000);
});

// Typing indicator
let typingTimeout;
messageInput.addEventListener('input', () => {
  if (!window.socket || !window.socket.connected) return;
  
  // Emit typing event
  window.socket.emit('typing', name);
  
  // Clear previous timeout
  clearTimeout(typingTimeout);
  
  // Set new timeout to stop showing typing after 2 seconds of inactivity
  typingTimeout = setTimeout(() => {
    if (window.socket && window.socket.connected) {
      window.socket.emit('stop-typing', name);
    }
  }, 2000);
});

// Form submission
messageForm.addEventListener('submit', e => {
  e.preventDefault();
  const message = messageInput.value.trim();
  
  if (message === '' || !window.socket || !window.socket.connected) {
    // If disconnected, show overlay
    if (!window.socket || !window.socket.connected) {
      loadingOverlay.style.display = 'flex';
      connectionMessage.textContent = 'Not connected to server. Trying to reconnect...';
      
      // Try to reconnect
      if (window.socket) {
        window.socket.connect();
      } else {
        connectToServer(serverUrl);
      }
    }
    return;
  }
  
  appendMessage(`${message}`, 'user-message');
  window.socket.emit('send-chat-message', message);
  messageInput.value = '';
  
  // Clear typing indicator when sending message
  window.socket.emit('stop-typing', name);
  
  // Scroll to bottom after sending message
  scrollToBottom();
});

// Append messages to the container
function appendMessage(message, messageClass) {
  const messageElement = document.createElement('div');
  messageElement.innerText = message;
  messageElement.classList.add('message');
  
  if (messageClass) {
    messageElement.classList.add(messageClass);
  }
  
  messageContainer.append(messageElement);
  
  // Scroll to the new message
  scrollToBottom();
}

// Scroll to bottom of messages
function scrollToBottom() {
  messageContainer.scrollTop = messageContainer.scrollHeight;
}

// Notification for new messages when tab is not active
function notifyUser(senderName) {
  // Check if browser supports notifications
  if (!("Notification" in window)) {
    return;
  }
  
  // Check if permission is granted
  if (Notification.permission === "granted") {
    createNotification(senderName);
  } 
  // Otherwise, ask for permission
  else if (Notification.permission !== "denied") {
    Notification.requestPermission().then(permission => {
      if (permission === "granted") {
        createNotification(senderName);
      }
    });
  }
}

// Create browser notification
function createNotification(senderName) {
  const notification = new Notification("New Message from Anubhav Chat", {
    body: `${senderName} sent you a message`,
    icon: "https://cdn-icons-png.flaticon.com/512/3017/3017352.png"
  });
  
  notification.onclick = function() {
    window.focus();
    this.close();
  };
}

// Setup event listener for page visibility change
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    // User is looking at the page, mark messages as read
    // This could interact with a backend endpoint if you implement read receipts
  }
});

// Add manual reconnect button for better UX
window.addEventListener('load', () => {
  const reconnectButton = document.createElement('button');
  reconnectButton.textContent = 'Reconnect';
  reconnectButton.className = 'reconnect-button';
  reconnectButton.style.position = 'fixed';
  reconnectButton.style.top = '10px';
  reconnectButton.style.right = '150px';
  reconnectButton.style.padding = '5px 10px';
  reconnectButton.style.borderRadius = '15px';
  reconnectButton.style.background = 'var(--primary-color)';
  reconnectButton.style.color = 'white';
  reconnectButton.style.border = 'none';
  reconnectButton.style.cursor = 'pointer';
  reconnectButton.style.display = 'none';
  reconnectButton.style.zIndex = '1000';
  
  reconnectButton.addEventListener('click', () => {
    if (!window.socket || !window.socket.connected) {
      updateConnectionStatus('Reconnecting...', 'var(--warning-color)', 'Attempting to reconnect...');
      
      if (window.socket) {
        window.socket.connect();
      } else {
        connectToServer(serverUrl);
      }
    }
  });
  
  document.body.appendChild(reconnectButton);
  
  // Show reconnect button when disconnected
  window.socket?.on('disconnect', () => {
    reconnectButton.style.display = 'block';
  });
  
  window.socket?.on('connect', () => {
    reconnectButton.style.display = 'none';
  });
  
  // Initial connection attempt
  connectToServer(serverUrl);
});

// Initial scroll to bottom on page load
scrollToBottom();