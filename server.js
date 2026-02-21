const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const { createServer } = require('http');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

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

app.use(express.json());

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase credentials not found in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// --- ENDPOINTS ---

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Registration
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const { data, error } = await supabase
      .from('users')
      .insert([{ username: username.toLowerCase(), password_hash: hashedPassword }])
      .select();

    if (error) {
      if (error.code === '23505') return res.status(400).json({ error: 'Username already exists' });
      return res.status(500).json({ error: error.message });
    }

    res.status(201).json({ message: 'User registered', user: { id: data[0].id, username: data[0].username } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username.toLowerCase())
      .maybeSingle();

    if (error || !user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    res.json({ message: 'Login successful', user: { id: user.id, username: user.username } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
