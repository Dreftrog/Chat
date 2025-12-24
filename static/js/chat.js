// Multi-User Chat Application

// State
let ws = null;
let currentUser = null;
let selectedUser = null;  // Currently selected chat partner
let users = {};  // {user_id: {username, online}}
let conversations = {};  // {user_id: [messages]}
let unreadCounts = {};  // {user_id: count}
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

// DOM elements
const chatbox = document.getElementById('chatbox');
const messageInput = document.getElementById('message');
const inputContainer = document.getElementById('inputContainer');
const contactsList = document.getElementById('contactsList');
const currentUsernameEl = document.getElementById('currentUsername');
const selectedUserNameEl = document.getElementById('selectedUserName');
const selectedUserStatusEl = document.getElementById('selectedUserStatus');
const voiceBtn = document.getElementById('voiceBtn');

// Initialize
(function init() {
    const sessionStr = localStorage.getItem('chat_session');
    
    if (!sessionStr) {
        window.location.href = '/login';
        return;
    }
    
    try {
        currentUser = JSON.parse(sessionStr);
    } catch(e) {
        localStorage.removeItem('chat_session');
        window.location.href = '/login';
        return;
    }
    
    if (!currentUser || !currentUser.username) {
        localStorage.removeItem('chat_session');
        window.location.href = '/login';
        return;
    }
    
    if (currentUsernameEl) {
        currentUsernameEl.textContent = currentUser.username;
    }
    
    connectWebSocket();
})();

// WebSocket
function connectWebSocket() {
    if (!currentUser) return;
    
    try {
        ws = new WebSocket(WS_URL);
    } catch (e) {
        console.error('[CHAT] WS Error:', e);
        return;
    }
    
    ws.onopen = () => {
        console.log('[CHAT] Connected!');
        ws.send(JSON.stringify({
            type: 'auth',
            token: currentUser.token || '',
            user_id: currentUser.user_id || '',
            username: currentUser.username
        }));
    };
    
    ws.onmessage = (event) => {
        try {
            handleMessage(JSON.parse(event.data));
        } catch (e) {}
    };
    
    ws.onclose = () => {
        console.log('[CHAT] Disconnected');
        if (currentUser) {
            setTimeout(connectWebSocket, 3000);
        }
    };
    
    ws.onerror = () => {
        console.error('[CHAT] Error');
    };
}

// Notification sound
function playNotificationSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.frequency.value = 587.33;
        osc1.type = 'sine';
        gain1.gain.setValueAtTime(0.2, ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc1.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 0.15);
        
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.value = 880;
        osc2.type = 'sine';
        gain2.gain.setValueAtTime(0.2, ctx.currentTime + 0.12);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc2.start(ctx.currentTime + 0.12);
        osc2.stop(ctx.currentTime + 0.35);
    } catch (e) {}
}

function handleMessage(data) {
    switch (data.type) {
        case 'connected':
            console.log('[CHAT] Authenticated as', data.username);
            break;
            
        case 'users_list':
            // Received list of all users
            data.users.forEach(u => {
                users[u.id] = { username: u.username, online: u.online };
            });
            renderContacts();
            break;
            
        case 'user_online':
            // A user came online
            if (users[data.user_id]) {
                users[data.user_id].online = true;
            } else {
                users[data.user_id] = { username: data.username, online: true };
            }
            renderContacts();
            if (selectedUser === data.user_id) {
                updateSelectedUserUI();
            }
            break;
            
        case 'user_offline':
            // A user went offline
            if (users[data.user_id]) {
                users[data.user_id].online = false;
            }
            renderContacts();
            if (selectedUser === data.user_id) {
                updateSelectedUserUI();
            }
            break;
            
        case 'history':
            // Received conversation history
            const withUserId = data.with_user_id;
            conversations[withUserId] = data.messages || [];
            if (selectedUser === withUserId) {
                renderMessages();
            }
            break;
            
        case 'message':
            // Received a new message
            const senderId = data.sender_id;
            if (!conversations[senderId]) {
                conversations[senderId] = [];
            }
            conversations[senderId].push(data);
            
            // If this chat is selected, render it
            if (selectedUser === senderId) {
                addMessageToUI(data, false);
            } else {
                // Update unread count
                unreadCounts[senderId] = (unreadCounts[senderId] || 0) + 1;
                renderContacts();
            }
            playNotificationSound();
            break;
            
        case 'error':
            console.error('[CHAT] Error:', data.message);
            break;
    }
}

function renderContacts() {
    if (!contactsList) return;
    
    const userIds = Object.keys(users);
    
    if (userIds.length === 0) {
        contactsList.innerHTML = '<div class="no-contacts">No hay contactos</div>';
        return;
    }
    
    // Sort: online first, then alphabetically
    userIds.sort((a, b) => {
        if (users[a].online !== users[b].online) {
            return users[b].online ? 1 : -1;
        }
        return users[a].username.localeCompare(users[b].username);
    });
    
    contactsList.innerHTML = userIds.map(uid => {
        const u = users[uid];
        const isSelected = selectedUser === uid;
        const unread = unreadCounts[uid] || 0;
        
        return `
            <div class="contact-item ${isSelected ? 'selected' : ''} ${u.online ? 'online' : ''}" 
                 onclick="selectUser('${uid}')">
                <div class="contact-avatar">${u.username.charAt(0).toUpperCase()}</div>
                <div class="contact-info">
                    <div class="contact-name">${u.username}</div>
                    <div class="contact-status">${u.online ? 'En línea' : 'Desconectado'}</div>
                </div>
                ${unread > 0 ? `<div class="unread-badge">${unread}</div>` : ''}
            </div>
        `;
    }).join('');
}

function selectUser(userId) {
    selectedUser = userId;
    unreadCounts[userId] = 0;  // Clear unread
    
    renderContacts();
    updateSelectedUserUI();
    
    // Show input container
    if (inputContainer) {
        inputContainer.style.display = 'flex';
    }
    
    // Request conversation history
    if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({
            type: 'get_history',
            with_user_id: userId
        }));
    }
    
    // Clear chatbox and show loading
    if (chatbox) {
        chatbox.innerHTML = '<div class="loading-messages">Cargando mensajes...</div>';
    }
}

function updateSelectedUserUI() {
    if (!selectedUser || !users[selectedUser]) return;
    
    const u = users[selectedUser];
    if (selectedUserNameEl) {
        selectedUserNameEl.textContent = u.username;
    }
    if (selectedUserStatusEl) {
        selectedUserStatusEl.className = 'status ' + (u.online ? 'online' : 'offline');
        selectedUserStatusEl.textContent = u.online ? '🟢 En línea' : '🔴 Desconectado';
    }
}

function renderMessages() {
    if (!chatbox || !selectedUser) return;
    
    const msgs = conversations[selectedUser] || [];
    
    if (msgs.length === 0) {
        chatbox.innerHTML = '<div class="no-messages">No hay mensajes aún. ¡Envía el primero!</div>';
        return;
    }
    
    chatbox.innerHTML = '';
    msgs.forEach(msg => {
        const isSent = msg.sender_id === currentUser.user_id;
        addMessageToUI(msg, isSent);
    });
}

function addMessageToUI(data, isSent) {
    if (!chatbox) return;
    
    // Remove "no messages" or "loading" placeholders
    const placeholder = chatbox.querySelector('.no-messages, .loading-messages, .no-chat-selected');
    if (placeholder) placeholder.remove();
    
    const div = document.createElement('div');
    div.className = 'message ' + (isSent ? 'sent' : 'received');
    
    let html = '';
    
    const isImage = data.message_type === 'image' || 
        (data.file_url && /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(data.file_url));
    const isVoice = data.message_type === 'voice' || 
        (data.file_url && /\.(webm|ogg|mp3|wav)$/i.test(data.file_url) && data.content?.includes('voice'));
    
    if (isImage && data.file_url) {
        html += '<img src="' + data.file_url + '" alt="' + (data.content || 'imagen') + '">';
    } else if (isVoice && data.file_url) {
        html += '<audio controls src="' + data.file_url + '"></audio>';
    } else if (data.file_url) {
        html += '<a href="' + data.file_url + '" target="_blank" class="file-link">📄 ' + (data.content || 'Archivo') + '</a>';
    } else if (data.content) {
        html += '<div>' + data.content.replace(/</g, '&lt;') + '</div>';
    }
    
    if (data.created_at) {
        const t = new Date(data.created_at).toLocaleTimeString('es', {hour:'2-digit', minute:'2-digit'});
        html += '<div class="time">' + t + '</div>';
    }
    
    div.innerHTML = html;
    chatbox.appendChild(div);
    chatbox.scrollTop = chatbox.scrollHeight;
}

function sendMessage() {
    const text = messageInput?.value?.trim();
    if (!text || !ws || ws.readyState !== 1 || !selectedUser) return;
    
    const msgData = {
        type: 'text',
        receiver_id: selectedUser,
        content: text
    };
    
    ws.send(JSON.stringify(msgData));
    
    // Add to local conversation
    const localMsg = {
        sender_id: currentUser.user_id,
        receiver_id: selectedUser,
        content: text,
        message_type: 'text',
        created_at: new Date().toISOString()
    };
    
    if (!conversations[selectedUser]) {
        conversations[selectedUser] = [];
    }
    conversations[selectedUser].push(localMsg);
    addMessageToUI(localMsg, true);
    
    messageInput.value = '';
}

async function handleFileSelect(event, type) {
    const file = event.target.files[0];
    if (file && selectedUser) {
        await uploadAndSend(file, type === 'image' ? 'image' : 'file');
    }
    event.target.value = '';
}

async function uploadAndSend(file, type) {
    if (!currentUser || !selectedUser) return;
    try {
        const path = (currentUser.user_id || 'user') + '/' + Date.now() + '_' + file.name;
        await supabaseClient.storage.from('chat-files').upload(path, file);
        const { data: { publicUrl } } = supabaseClient.storage.from('chat-files').getPublicUrl(path);
        
        ws.send(JSON.stringify({
            type: type,
            receiver_id: selectedUser,
            content: file.name,
            file_url: publicUrl
        }));
        
        const localMsg = {
            sender_id: currentUser.user_id,
            receiver_id: selectedUser,
            content: file.name,
            message_type: type,
            file_url: publicUrl,
            created_at: new Date().toISOString()
        };
        
        if (!conversations[selectedUser]) {
            conversations[selectedUser] = [];
        }
        conversations[selectedUser].push(localMsg);
        addMessageToUI(localMsg, true);
    } catch (e) {
        console.error('Upload error:', e);
    }
}

async function toggleRecording() {
    if (!selectedUser) return;
    
    if (isRecording) {
        mediaRecorder?.stop();
        isRecording = false;
        if (voiceBtn) { voiceBtn.textContent = '🎤'; voiceBtn.classList.remove('recording'); }
    } else {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = async () => {
                const blob = new Blob(audioChunks, { type: 'audio/webm' });
                await uploadAndSend(new File([blob], 'voice_' + Date.now() + '.webm'), 'voice');
                stream.getTracks().forEach(t => t.stop());
            };
            mediaRecorder.start();
            isRecording = true;
            if (voiceBtn) { voiceBtn.textContent = '⏹️'; voiceBtn.classList.add('recording'); }
        } catch (e) {
            console.error('Mic error:', e);
        }
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('chat_session');
    ws?.close();
    window.location.href = '/login';
}

// Image modal
function openImageModal(src) {
    document.getElementById('modalImage').src = src;
    document.getElementById('imageModal').classList.add('active');
}

function closeImageModal() {
    document.getElementById('imageModal').classList.remove('active');
}

chatbox?.addEventListener('click', function(e) {
    if (e.target.tagName === 'IMG') {
        openImageModal(e.target.src);
    }
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeImageModal();
});

if (messageInput) {
    messageInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') sendMessage();
    });
}
