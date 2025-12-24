// Login functionality

const form = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const errorDiv = document.getElementById('error');
const successDiv = document.getElementById('success');

// Check if already logged in
const existingSession = localStorage.getItem('chat_session');
if (existingSession) {
    try {
        const s = JSON.parse(existingSession);
        if (s && s.username) {
            window.location.href = '/chat';
        }
    } catch(e) {
        localStorage.removeItem('chat_session');
    }
}

function showError(msg) {
    errorDiv.textContent = msg;
    errorDiv.style.display = 'block';
    successDiv.style.display = 'none';
}

function showSuccess(msg) {
    successDiv.textContent = msg;
    successDiv.style.display = 'block';
    errorDiv.style.display = 'none';
}

async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    
    if (!username || !password) {
        showError('Completa todos los campos');
        return;
    }
    
    loginBtn.disabled = true;
    loginBtn.textContent = 'Iniciando...';
    errorDiv.style.display = 'none';
    
    try {
        const passwordHash = await hashPassword(password);
        
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('username', username)
            .eq('password_hash', passwordHash)
            .single();
        
        if (error || !data) {
            showError('Usuario o contraseña incorrectos');
            loginBtn.disabled = false;
            loginBtn.textContent = 'Iniciar Sesión';
            return;
        }
        
        // Save session
        const session = {
            user_id: data.id,
            username: data.username,
            token: btoa(JSON.stringify({ id: data.id, username: data.username }))
        };
        localStorage.setItem('chat_session', JSON.stringify(session));
        
        showSuccess('¡Bienvenido ' + data.username + '!');
        setTimeout(() => { window.location.href = '/chat'; }, 800);
        
    } catch (err) {
        console.error('[LOGIN] Error:', err);
        showError('Error: ' + err.message);
        loginBtn.disabled = false;
        loginBtn.textContent = 'Iniciar Sesión';
    }
});
