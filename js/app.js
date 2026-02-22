// amamus34 client helpers
const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_URL = 'https://amamus-birthday.onrender.com';
const AUTH_USER_KEY = 'amamus34_user';

const SB_URL = 'https://wiqptoiikgjvjtwzpxjd.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpcXB0b2lpa2dqdmp0d3pweGpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0NDE4MzIsImV4cCI6MjA4MzAxNzgzMn0.OeNZKRx-FZN6Mjw9-kuPYy2HEA6Xkb-Sf6xRlscTMUc';

const sb = window.supabase ? window.supabase.createClient(SB_URL, SB_KEY) : null;
if (sb) window.sb = sb;

function getCurrentUser() {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function setCurrentUser(user) {
  if (user) localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(AUTH_USER_KEY);
}

async function checkAuth() {
  try {
    const response = await fetch(`${API_URL}/api/me`, {
      method: 'GET',
      credentials: 'include'
    });
    if (!response.ok) {
      setCurrentUser(null);
      return null;
    }
    const data = await response.json();
    const user = data && data.user ? data.user : null;
    setCurrentUser(user);
    return user;
  } catch (_) {
    setCurrentUser(null);
    return null;
  }
}

function validateAuthInput(username, password) {
  const usernameClean = (username || '').trim().toLowerCase();
  const passwordClean = (password || '').trim();
  if (!/^[a-z0-9_]{3,30}$/.test(usernameClean)) {
    return { ok: false, error: 'Ник: 3-30 символов, только a-z 0-9 _' };
  }
  if (passwordClean.length < 8 || passwordClean.length > 128) {
    return { ok: false, error: 'Пароль: 8-128 символов' };
  }
  return { ok: true, username: usernameClean, password: passwordClean };
}

async function registerUser(username, password) {
  const valid = validateAuthInput(username, password);
  if (!valid.ok) return { ok: false, error: valid.error };

  try {
    const response = await fetch(`${API_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username: valid.username, password: valid.password })
    });

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const result = contentType.includes('application/json')
      ? await response.json()
      : { error: await response.text() || 'Invalid server response' };

    if (!response.ok) return { ok: false, error: result.error || 'Ошибка регистрации' };

    setCurrentUser(result.user || null);
    return { ok: true };
  } catch (_) {
    return { ok: false, error: 'Сервер недоступен. Попробуйте позже.' };
  }
}

async function loginUser(username, password) {
  const valid = validateAuthInput(username, password);
  if (!valid.ok) return { ok: false, error: valid.error };

  try {
    const response = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username: valid.username, password: valid.password })
    });

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const result = contentType.includes('application/json')
      ? await response.json()
      : { error: await response.text() || 'Invalid server response' };

    if (!response.ok) return { ok: false, error: result.error || 'Ошибка входа' };

    setCurrentUser(result.user || null);
    return { ok: true };
  } catch (_) {
    return { ok: false, error: 'Сервер недоступен. Попробуйте позже.' };
  }
}

async function logoutUser(shouldReload = true) {
  try {
    await fetch(`${API_URL}/api/logout`, {
      method: 'POST',
      credentials: 'include'
    });
  } catch (_) {
    // ignore network error, clear local state anyway
  } finally {
    setCurrentUser(null);
    if (shouldReload) window.location.reload();
  }
}

function renderHeader(currentPage) {
  currentPage = currentPage || '';
  const user = getCurrentUser();
  const nav = [
    { href: 'posts.html', label: 'Posts' },
    { href: 'comments.html', label: 'Comments' },
    { href: 'video.html', label: 'Video' },
    { href: 'upload.html', label: 'Upload' },
    { href: 'upload-video.html', label: 'Upload Video' },
    { href: 'random.html', label: 'Random' }
  ];
  let html = '<header class="site-header"><a href="index.html" class="site-logo">amamus34</a><nav class="nav-links">';
  if (user) {
    html += '<a href="account.html">My Account (' + user.username + ')</a><span class="sep">|</span><a href="#" onclick="logoutUser(true); return false;">Logout</a>';
  } else {
    html += '<a href="login.html">Login</a><span class="sep">|</span><a href="register.html">Sign Up</a>';
  }
  nav.forEach((n) => {
    html += '<span class="sep">|</span><a href="' + n.href + '"' + (currentPage === n.href ? ' style="font-weight:bold"' : '') + '>' + n.label + '</a>';
  });
  html += '<span class="sep">|</span><a href="memorial.html">04.01.2026</a>';
  html += '</nav></header>';
  return html;
}

function initHeader(currentPage) {
  const el = document.getElementById('header-placeholder');
  if (el) el.innerHTML = renderHeader(currentPage || '');
}

window.checkAuth = checkAuth;
window.getCurrentUser = getCurrentUser;
window.logoutUser = logoutUser;
window.API_URL = API_URL;
window.IS_LOCAL = IS_LOCAL;
// amamus34 вЂ” РєР»РёРµРЅС‚СЃРєР°СЏ Р±РёР±Р»РёРѕС‚РµРєР°
// API URL - only works locally, NOT on production (static hosting)
const IS_LOCAL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const API_URL = 'https://amamus-birthday.onrender.com';
const AUTH_USER_KEY = 'amamus34_user';

const SB_URL = 'https://wiqptoiikgjvjtwzpxjd.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpcXB0b2lpa2dqdmp0d3pweGpkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0NDE4MzIsImV4cCI6MjA4MzAxNzgzMn0.OeNZKRx-FZN6Mjw9-kuPYy2HEA6Xkb-Sf6xRlscTMUc';

const sb = window.supabase ? window.supabase.createClient(SB_URL, SB_KEY) : null;
if (sb) window.sb = sb;

async function checkAuth() {
  const user = getCurrentUser();
  return user;
}

function getCurrentUser() {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

function setCurrentUser(user) {
  if (user) localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(AUTH_USER_KEY);
}

async function registerUser(username, password) {
  const usernameClean = (username || '').trim().toLowerCase();
  const passwordClean = (password || '').trim();
  if (!usernameClean || usernameClean.length < 2) return { ok: false, error: 'Ник от 2 символов' };
  if (!passwordClean || passwordClean.length < 4) return { ok: false, error: 'Пароль от 4 символов' };

  try {
    const response = await fetch(`${API_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: usernameClean, password: passwordClean })
    });

    let result = {};
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('application/json')) {
      result = await response.json();
    } else {
      const rawText = await response.text();
      result = { error: rawText || 'Invalid server response' };
    }

    if (!response.ok) return { ok: false, error: result.error || 'Ошибка регистрации' };
    setCurrentUser(result.user);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: 'Сервер недоступен. Попробуйте позже.' };
  }
}
async function loginUser(username, password) {
  const usernameClean = (username || '').trim().toLowerCase();
  const passwordClean = (password || '').trim();
  if (!usernameClean || !passwordClean || passwordClean.length < 4) return { ok: false, error: 'Введите корректные данные' };

  try {
    const response = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: usernameClean, password: passwordClean })
    });

    let result = {};
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (contentType.includes('application/json')) {
      result = await response.json();
    } else {
      const rawText = await response.text();
      result = { error: rawText || 'Invalid server response' };
    }

    if (!response.ok) return { ok: false, error: result.error || 'Ошибка входа' };
    setCurrentUser(result.user);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: 'Сервер недоступен. Попробуйте позже.' };
  }
}
function logoutUser() {
  setCurrentUser(null);
  window.location.reload();
}

function renderHeader(currentPage) {
  currentPage = currentPage || '';
  const user = getCurrentUser();
  const nav = [
    { href: 'posts.html', label: 'Posts' },
    { href: 'comments.html', label: 'Comments' },
    { href: 'video.html', label: 'Video' },
    { href: 'upload.html', label: 'Upload' },
    { href: 'upload-video.html', label: 'Upload Video' },
    { href: 'random.html', label: 'Random' },
  ];
  let html = '<header class="site-header"><a href="index.html" class="site-logo">amamus34</a><nav class="nav-links">';
  if (user) {
    html += '<a href="account.html">My Account (' + user.username + ')</a><span class="sep">|</span><a href="#" onclick="logoutUser(); return false;">Logout</a>';
  } else {
    html += '<a href="login.html">Login</a><span class="sep">|</span><a href="register.html">Sign Up</a>';
  }
  nav.forEach(n => {
    html += '<span class="sep">|</span><a href="' + n.href + '"' + (currentPage === n.href ? ' style="font-weight:bold"' : '') + '>' + n.label + '</a>';
  });
  html += '<span class="sep">|</span><a href="memorial.html">04.01.2026</a>';
  html += '</nav></header>';
  return html;
}

function initHeader(currentPage) {
  const el = document.getElementById('header-placeholder');
  if (el) el.innerHTML = renderHeader(currentPage || '');
}

window.checkAuth = checkAuth;
window.API_URL = API_URL;
window.IS_LOCAL = IS_LOCAL;

