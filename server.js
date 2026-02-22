const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const { createServer } = require('http');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
app.set('trust proxy', 1);

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Отключаем CSP для работы с CDN библиотеками (можно настроить позже)
}));

app.use(cors({
  origin: process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : ['http://localhost:3000', 'https://wtatat.github.io', 'https://amamus34.ru'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Upload endpoint accepts base64 images, so JSON body must allow larger payloads.
app.use(express.json({ limit: '20mb' }));
app.use(cookieParser());

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase credentials not found in environment variables');
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('WARNING: SUPABASE_SERVICE_ROLE_KEY is not set. Using anon key on backend is less secure.');
}

const supabase = createClient(supabaseUrl, supabaseKey);
const FRONTEND_URL = (process.env.FRONTEND_URL || '').split(',').map((s) => s.trim()).filter(Boolean);
const SESSION_COOKIE = 'amamus34_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const sessions = new Map();

function cleanExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (!session || session.expiresAt <= now) {
      sessions.delete(token);
    }
  }
}

function getCookieOptions(req) {
  const origin = req.headers.origin || '';
  let originUrl = null;
  try {
    originUrl = origin ? new URL(origin) : null;
  } catch (_) {
    originUrl = null;
  }

  const requestHost = (req.get('host') || '').split(':')[0];
  const originHost = originUrl ? originUrl.hostname : '';
  const isCrossOrigin = Boolean(originHost && requestHost && originHost !== requestHost);
  const isHttpsOrigin = Boolean(originUrl && originUrl.protocol === 'https:');
  const isLocalhost = originHost === 'localhost' || originHost === '127.0.0.1';
  const secure = isCrossOrigin ? true : (isHttpsOrigin || (process.env.NODE_ENV === 'production' && !isLocalhost));

  return {
    httpOnly: true,
    secure,
    sameSite: isCrossOrigin ? 'none' : 'lax',
    maxAge: SESSION_TTL_MS,
    path: '/'
  };
}

function setSessionCookie(req, res, token) {
  const cookieOptions = getCookieOptions(req);
  res.cookie(SESSION_COOKIE, token, {
    ...cookieOptions
  });
}

function clearSessionCookie(req, res) {
  const cookieOptions = getCookieOptions(req);
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: cookieOptions.httpOnly,
    secure: cookieOptions.secure,
    sameSite: cookieOptions.sameSite,
    path: cookieOptions.path
  });
}

function createSession(user) {
  cleanExpiredSessions();
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, {
    user: { id: user.id, username: user.username },
    expiresAt: Date.now() + SESSION_TTL_MS
  });
  return token;
}

function getSessionUser(req) {
  const token = req.cookies && req.cookies[SESSION_COOKIE];
  if (!token) return null;

  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session.user;
}

function requireAuth(req, res, next) {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Authentication required' });
  req.user = user;
  return next();
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
});

const postLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
});

const deletionRequestLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false
});

function validateUsername(value) {
  const username = (value || '').toString().trim().toLowerCase();
  if (!/^[a-z0-9_]{3,30}$/.test(username)) return null;
  return username;
}

function getClientIp(req) {
  const ip = req.headers['x-forwarded-for'] || req.ip || '';
  return String(ip).split(',')[0].trim();
}

async function notifyAdmin(messageText) {
  const webhook = (process.env.ADMIN_NOTIFY_WEBHOOK_URL || '').trim();
  const botToken = (process.env.ADMIN_TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = (process.env.ADMIN_TELEGRAM_CHAT_ID || '').trim();

  if (webhook) {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: messageText })
    });
  }

  if (botToken && chatId) {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText
      })
    });
  }
}

// --- ENDPOINTS ---

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Registration
app.post('/api/register', authLimiter, async (req, res) => {
  const { username, password } = req.body;
  const usernameClean = validateUsername(username);
  if (!usernameClean || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: 'Password must be 8-128 chars' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const { data, error } = await supabase
      .from('users')
      .insert([{ username: usernameClean, password_hash: hashedPassword }])
      .select();

    if (error) {
      if (error.code === '23505') return res.status(400).json({ error: 'Username already exists' });
      return res.status(500).json({ error: error.message });
    }

    const safeUser = { id: data[0].id, username: data[0].username };
    const token = createSession(safeUser);
    setSessionCookie(req, res, token);
    res.status(201).json({ message: 'User registered', user: safeUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
app.post('/api/login', authLimiter, async (req, res) => {
  const { username, password } = req.body;
  const usernameClean = validateUsername(username);
  if (!usernameClean || !password) {
    return res.status(400).json({ error: 'Invalid credentials' });
  }
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', usernameClean)
      .maybeSingle();

    if (error || !user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const safeUser = { id: user.id, username: user.username };
    const token = createSession(safeUser);
    setSessionCookie(req, res, token);
    res.json({ message: 'Login successful', user: safeUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/me', (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  return res.json({ user });
});

app.post('/api/logout', (req, res) => {
  const token = req.cookies && req.cookies[SESSION_COOKIE];
  if (token) sessions.delete(token);
  clearSessionCookie(req, res);
  return res.json({ message: 'Logout successful' });
});

// Comments
app.get('/api/comments', async (req, res) => {
  try {
    const { post_id } = req.query;
    let query = supabase
      .from('post_comments')
      .select('id, post_id, author_name, content, random_id, parent_id, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (post_id) {
      query = supabase
        .from('post_comments')
        .select('id, post_id, author_name, content, random_id, parent_id, created_at')
        .eq('post_id', post_id)
        .order('created_at', { ascending: true });
    }

    const { data: comments, error } = await query;

    if (error) return res.status(500).json({ error: error.message });
    res.json({ comments: comments || [] });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Post comment
app.post('/api/comments', async (req, res) => {
  try {
    const { post_id, author_name, content, parent_id } = req.body;
    if (!post_id || !author_name || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const random_id = Math.floor(Math.random() * 99999999).toString();
    const { data, error } = await supabase
      .from('post_comments')
      .insert([{ post_id, author_name, content, parent_id, random_id }])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json({ comment: data });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single post
app.get('/api/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data: post, error } = await supabase
      .from('posts')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json({ post });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create post
app.post('/api/posts', requireAuth, postLimiter, async (req, res) => {
  try {
    const { image_data, character_tags, general_tags, meta_tags } = req.body || {};

    if (!image_data || typeof image_data !== 'string') {
      return res.status(400).json({ error: 'image_data is required' });
    }

    // Only Data URL images are expected from upload.html
    if (!image_data.startsWith('data:image/')) {
      return res.status(400).json({ error: 'image_data must be a valid image Data URL' });
    }

    const { data: post, error } = await supabase
      .from('posts')
      .insert([{
        author_username: req.user.username,
        image_url: image_data,
        character_tags: (character_tags || '').toString().trim(),
        general_tags: (general_tags || '').toString().trim(),
        meta_tags: (meta_tags || '').toString().trim()
      }])
      .select('id')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ postId: post.id });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/deletion-requests', deletionRequestLimiter, async (req, res) => {
  try {
    const { post_id, reason } = req.body || {};
    const postId = (post_id || '').toString().trim();
    const reasonText = (reason || '').toString().trim();

    if (!postId) return res.status(400).json({ error: 'post_id is required' });
    if (reasonText.length < 10) return res.status(400).json({ error: 'Reason must be at least 10 chars' });
    if (reasonText.length > 2000) return res.status(400).json({ error: 'Reason is too long' });

    const sessionUser = getSessionUser(req);
    const requesterUsername = sessionUser ? sessionUser.username : null;
    const requesterUserId = sessionUser ? sessionUser.id : null;
    const requesterIp = getClientIp(req);
    const userAgent = (req.headers['user-agent'] || '').toString().slice(0, 500);
    const primaryFrontend = FRONTEND_URL[0] || `${req.protocol}://${req.get('host')}`;
    const postUrl = `${primaryFrontend.replace(/\/+$/, '')}/post.html?id=${encodeURIComponent(postId)}`;

    const { error } = await supabase
      .from('deletion_requests')
      .insert([{
        post_id: postId,
        reason: reasonText,
        requester_username: requesterUsername,
        requester_user_id: requesterUserId,
        requester_ip: requesterIp,
        user_agent: userAgent
      }]);

    if (error) return res.status(500).json({ error: error.message });

    const msg = [
      'New deletion request',
      `Post ID: ${postId}`,
      `Post URL: ${postUrl}`,
      `User: ${requesterUsername || 'anonymous'}`,
      `IP: ${requesterIp || 'unknown'}`,
      `Reason: ${reasonText}`
    ].join('\n');

    try {
      await notifyAdmin(msg);
    } catch (notifyErr) {
      console.warn('Admin notification failed:', notifyErr.message);
    }

    return res.status(201).json({ message: 'Request sent to admin' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get posts (for upload page)
app.get('/api/posts', async (req, res) => {
  try {
    const { data: posts, error } = await supabase
      .from('posts')
      .select('id, author_username, image_url, character_tags, general_tags, meta_tags, score, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ posts: posts || [] });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

const server = createServer(app);
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
