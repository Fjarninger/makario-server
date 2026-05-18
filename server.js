// ═══════════════════════════════════════════════════════════════
//  MAKARIO BACKEND — server.js
//  Stack : Node.js + Express + Socket.io  |  Stockage : mémoire
//  Port  : 3000 (local) ou PORT (Railway/Render)
// ═══════════════════════════════════════════════════════════════

const express    = require('express');
const http       = require('http');
const cors       = require('cors');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const path       = require('path');
const fs         = require('fs');
const multer     = require('multer');
const { Server } = require('socket.io');

const app        = express();
const httpServer = http.createServer(app);
const io         = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'makario_secret_2024_congo';

app.use(cors());
app.use(express.json());

// ─── UPLOAD (Multer) ──────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, unique + path.extname(file.originalname).toLowerCase());
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const valid = allowed.test(path.extname(file.originalname).toLowerCase())
               && allowed.test(file.mimetype);
    if (valid) cb(null, true);
    else cb(new Error('Seules les images sont acceptées (jpg, png, gif, webp)'));
  },
});

// ─── SOCKET.IO ────────────────────────────────────────────────────
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Non authentifié'));
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.users.find(u => u.id === payload.id);
    if (!user) return next(new Error('Utilisateur introuvable'));
    socket.user = { id: user.id, name: user.name };
    next();
  } catch { next(new Error('Token invalide')); }
});

io.on('connection', (socket) => {
  socket.on('join_conv', (convId) => {
    const conv = db.conversations.find(c => c.id === parseInt(convId));
    if (conv && conv.participants.includes(socket.user.id)) {
      socket.join('conv_' + convId);
    }
  });
  socket.on('leave_conv', (convId) => socket.leave('conv_' + convId));
});

// ─── BASE DE DONNÉES EN MÉMOIRE ───────────────────────────────────
let db = {
  users: [],
  companies: [
    { id:1, name:'SIGTH-TECH CONGO', sector:'TIC', city:'Brazzaville', services:'Développement web et mobile, solutions informatiques sur mesure, hébergement cloud.', vision:'Être le partenaire N°1 du peuple congolais dans le domaine des TIC.', address:'84, Rue Mayama, Brazzaville', cover:'💻', init:'ST', ownerId:null },
    { id:2, name:'BEST INFORMATIQUE', sector:'TIC', city:'Pointe-Noire', services:'Vente de matériel informatique, maintenance, formation, réseaux.', vision:'Digitaliser les entreprises congolaises à moindre coût.', address:'Centre-ville, Pointe-Noire', cover:'🖥️', init:'BI', ownerId:null },
    { id:3, name:'EGCM', sector:'Éducation & Formation', city:'Brazzaville', services:'Formation professionnelle qualifiante, coaching emploi, stages en entreprise.', vision:"Former la jeunesse congolaise pour l'emploi de demain.", address:'84, Rue Mayama, Immeuble BGF1, 1er étage', cover:'📚', init:'EG', ownerId:null },
    { id:4, name:'AOFIP', sector:'Éducation & Formation', city:'Brazzaville', services:'Formation professionnelle et qualifiante, insertion professionnelle, coaching.', vision:"Vers l'emploi, mais pas seul.", address:'Rue Matsoua, Brazzaville', cover:'🎓', init:'AO', ownerId:null },
    { id:5, name:'AI COMMUNICATION', sector:'TIC', city:'Brazzaville', services:'Agence de communication digitale, création de contenu, réseaux sociaux, branding.', vision:'Booster la visibilité des marques congolaises.', address:'Plateau de 15 ans, Brazzaville', cover:'📡', init:'AI', ownerId:null },
    { id:6, name:'MAGIC DESIGN', sector:'Culture & Arts', city:'Pointe-Noire', services:'Design graphique, identité visuelle, création de logo, impression.', vision:"L'art au service des entreprises.", address:'Lumumba, Pointe-Noire', cover:'🎨', init:'MD', ownerId:null },
    { id:7, name:'MUSAS CONGO', sector:'Commerce', city:'Brazzaville', services:'Distribution alimentaire, import-export, grossiste, livraison.', vision:'Nourrir le Congo, de Brazzaville à Owando.', address:'Marché Total, Brazzaville', cover:'🛒', init:'MC', ownerId:null },
    { id:8, name:'BTP PRO CONGO', sector:'BTP', city:'Dolisie', services:'Construction, rénovation, génie civil, architecture, études techniques.', vision:'Bâtir le Congo moderne, pierre par pierre.', address:'Centre, Dolisie', cover:'🏗️', init:'BP', ownerId:null },
  ],
  sectors: [
    { id:'tic',       label:'TIC',                    icon:'💻', count:124 },
    { id:'commerce',  label:'Commerce',                icon:'🛒', count:312 },
    { id:'services',  label:'Prestations de services', icon:'⚙️', count:198 },
    { id:'btp',       label:'BTP',                    icon:'🏗️', count:87  },
    { id:'tourisme',  label:'Tourisme & Restauration', icon:'🍽️', count:64  },
    { id:'culture',   label:'Culture & Arts',          icon:'🎨', count:43  },
    { id:'sante',     label:'Santé',                  icon:'🏥', count:91  },
    { id:'education', label:'Éducation & Formation',  icon:'📚', count:76  },
  ],
  news: [
    { id:1, company:'EGCM', avatar:'EG', title:'Formation Femme & TIC — Inscriptions ouvertes!', body:'La prochaine session de formation Excel, comptabilité et bureautique commence le 14 Mars.', emoji:'📊', date:new Date(Date.now()-3600000).toISOString(), likes:24, authorId:null },
    { id:2, company:'AOFIP', avatar:'AO', title:'Offre de stage bénévole en entreprise', body:"Je prépare mon stage en entreprise. Vers l'emploi mais pas seul.", emoji:'💼', date:new Date(Date.now()-7200000).toISOString(), likes:41, authorId:null },
    { id:3, company:'AI COMMUNICATION', avatar:'AI', title:'Nouveau service : Community Management', body:'Nous lançons notre offre de gestion des réseaux sociaux pour les PME.', emoji:'📱', date:new Date(Date.now()-86400000).toISOString(), likes:18, authorId:null },
    { id:4, company:'SIGTH-TECH CONGO', avatar:'ST', title:"Développement d'application mobile sur mesure", body:"Vous avez un projet d'application ? Nous transformons vos idées en solutions numériques performantes.", emoji:'📲', date:new Date(Date.now()-172800000).toISOString(), likes:56, authorId:null },
  ],
  conversations:  [],
  messages:       {},  // { convId: [msg, ...] }
  favorites:      {},  // { userId: [companyId, ...] }
  newsLikes:      {},  // { newsId: [userId, ...] }
  subscriptions:  {},  // { userId: { plan, method, price, activatedAt } }
  nextId: {
    user:5, company:9, news:5, conv:1
  }
};

// ─── MIDDLEWARE AUTH ───────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.json({ success:false, error:'Non authentifié' });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    req.user = db.users.find(u => u.id === payload.id);
    if (!req.user) return res.json({ success:false, error:'Utilisateur introuvable' });
    next();
  } catch {
    return res.json({ success:false, error:'Token invalide' });
  }
}

function safeUser(u) {
  const { password, ...safe } = u;
  return safe;
}

// ═══════════════════════════════════════════════════════════════
//  ROUTES
// ═══════════════════════════════════════════════════════════════

// ── HEALTH ────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ success:true, message:'Makario API opérationnelle', version:'1.0.0' });
});

// ── AUTH ──────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, company } = req.body;
  if (!name || !email || !password)
    return res.json({ success:false, error:'Champs requis manquants' });
  if (db.users.find(u => u.email === email))
    return res.json({ success:false, error:'Email déjà utilisé' });

  const hashed = await bcrypt.hash(password, 10);
  const user = { id: db.nextId.user++, name, email, password:hashed, company: company||null, createdAt: new Date().toISOString() };
  db.users.push(user);

  const token = jwt.sign({ id:user.id }, JWT_SECRET, { expiresIn:'30d' });
  res.json({ success:true, data:{ token, user:safeUser(user) } });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = db.users.find(u => u.email === email);
  if (!user) return res.json({ success:false, error:'Email ou mot de passe incorrect' });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.json({ success:false, error:'Email ou mot de passe incorrect' });

  const token = jwt.sign({ id:user.id }, JWT_SECRET, { expiresIn:'30d' });
  res.json({ success:true, data:{ token, user:safeUser(user) } });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ success:true, data:safeUser(req.user) });
});

app.put('/api/auth/profile', authMiddleware, (req, res) => {
  const user = db.users.find(u => u.id === req.user.id);
  if (!user) return res.json({ success:false, error:'Utilisateur introuvable' });
  const { name, profession, city, avatar } = req.body;
  if (name) user.name = name;
  if (profession !== undefined) user.profession = profession;
  if (city !== undefined) user.city = city;
  if (avatar !== undefined) user.avatar = avatar;
  res.json({ success:true, data:safeUser(user) });
});

// ── COMPANIES ─────────────────────────────────────────────────────
app.get('/api/companies', (req, res) => {
  res.json({ success:true, data:db.companies });
});

app.get('/api/companies/:id', (req, res) => {
  const c = db.companies.find(c => c.id === parseInt(req.params.id));
  if (!c) return res.json({ success:false, error:'Entreprise introuvable' });
  res.json({ success:true, data:c });
});

app.post('/api/companies', authMiddleware, (req, res) => {
  const { name, sector, city, services, vision, address } = req.body;
  if (!name || !sector) return res.json({ success:false, error:'Nom et secteur requis' });
  const c = {
    id: db.nextId.company++,
    name, sector, city: city||'', services: services||'', vision: vision||'',
    address: address||'', cover:'🏢', init: name.slice(0,2).toUpperCase(),
    ownerId: req.user.id, createdAt: new Date().toISOString()
  };
  db.companies.push(c);
  res.json({ success:true, data:c });
});

// ── SECTORS ───────────────────────────────────────────────────────
app.get('/api/sectors', (req, res) => {
  res.json({ success:true, data:db.sectors });
});

// ── NEWS ──────────────────────────────────────────────────────────
app.get('/api/news', (req, res) => {
  res.json({ success:true, data:[...db.news].reverse() });
});

app.post('/api/news', authMiddleware, (req, res) => {
  const { title, body, emoji } = req.body;
  if (!title || !body) return res.json({ success:false, error:'Titre et contenu requis' });
  const n = {
    id: db.nextId.news++,
    company: req.user.name,
    avatar: req.user.name.slice(0,2).toUpperCase(),
    title, body, emoji: emoji||'📢',
    date: new Date().toISOString(),
    likes: 0, authorId: req.user.id
  };
  db.news.push(n);
  res.json({ success:true, data:n });
});

app.post('/api/news/:id/like', authMiddleware, (req, res) => {
  const n = db.news.find(x => x.id === parseInt(req.params.id));
  if (!n) return res.json({ success:false, error:'Publication introuvable' });
  const uid = req.user.id;
  if (!db.newsLikes[n.id]) db.newsLikes[n.id] = [];
  if (!db.newsLikes[n.id].includes(uid)) {
    db.newsLikes[n.id].push(uid);
    n.likes++;
  }
  res.json({ success:true, data:n });
});

app.post('/api/news/:id/unlike', authMiddleware, (req, res) => {
  const n = db.news.find(x => x.id === parseInt(req.params.id));
  if (!n) return res.json({ success:false, error:'Publication introuvable' });
  const uid = req.user.id;
  if (db.newsLikes[n.id]) {
    const idx = db.newsLikes[n.id].indexOf(uid);
    if (idx > -1) { db.newsLikes[n.id].splice(idx,1); n.likes = Math.max(0, n.likes-1); }
  }
  res.json({ success:true, data:n });
});

// ── FAVORITES ─────────────────────────────────────────────────────
app.get('/api/favorites', authMiddleware, (req, res) => {
  const favIds = db.favorites[req.user.id] || [];
  const list = db.companies.filter(c => favIds.includes(c.id));
  res.json({ success:true, data:list });
});

app.post('/api/favorites/:companyId', authMiddleware, (req, res) => {
  const cid = parseInt(req.params.companyId);
  if (!db.favorites[req.user.id]) db.favorites[req.user.id] = [];
  if (db.favorites[req.user.id].includes(cid))
    return res.json({ success:false, error:'Déjà en favoris' });
  db.favorites[req.user.id].push(cid);
  res.json({ success:true });
});

app.delete('/api/favorites/:companyId', authMiddleware, (req, res) => {
  const cid = parseInt(req.params.companyId);
  if (db.favorites[req.user.id]) {
    db.favorites[req.user.id] = db.favorites[req.user.id].filter(id => id !== cid);
  }
  res.json({ success:true });
});

// ── CONVERSATIONS & MESSAGES ──────────────────────────────────────
app.get('/api/conversations', authMiddleware, (req, res) => {
  const uid = req.user.id;
  const list = db.conversations
    .filter(c => c.participants.includes(uid))
    .map(c => {
      const msgs = db.messages[c.id] || [];
      const last = msgs[msgs.length-1];
      return { ...c, preview: last?.text?.slice(0,40)||'', time: last?.date||c.createdAt, unread:0 };
    });
  res.json({ success:true, data:list });
});

app.post('/api/conversations', authMiddleware, (req, res) => {
  const { recipientId, companyId } = req.body;
  const uid = req.user.id;
  const existing = db.conversations.find(c =>
    c.participants.includes(uid) && c.participants.includes(recipientId||0)
  );
  if (existing) return res.json({ success:true, data:existing });

  const conv = {
    id: db.nextId.conv++,
    participants: [uid, recipientId||99],
    companyId: companyId||null,
    name: req.body.name || 'Conversation',
    init: req.body.init || '?',
    createdAt: new Date().toISOString()
  };
  db.conversations.push(conv);
  db.messages[conv.id] = [];
  res.json({ success:true, data:conv });
});

app.get('/api/conversations/:id/messages', authMiddleware, (req, res) => {
  const cid = parseInt(req.params.id);
  const msgs = (db.messages[cid] || []).map(m => ({
    ...m, sent: m.senderId === req.user.id
  }));
  res.json({ success:true, data:msgs });
});

app.post('/api/conversations/:id/messages', authMiddleware, (req, res) => {
  const cid = parseInt(req.params.id);
  const { text } = req.body;
  if (!text) return res.json({ success:false, error:'Message vide' });
  if (!db.messages[cid]) db.messages[cid] = [];
  const msg = { id: Date.now(), senderId: req.user.id, text, date: new Date().toISOString() };
  db.messages[cid].push(msg);
  io.to('conv_' + cid).emit('new_message', { ...msg, sent: false });
  res.json({ success:true, data:{ ...msg, sent:true } });
});

// ── STATS ─────────────────────────────────────────────────────────
app.get('/api/stats', (req, res) => {
  res.json({ success:true, data:{
    totalCompanies: db.companies.length,
    totalUsers:     db.users.length,
    totalNews:      db.news.length,
    totalSectors:   db.sectors.length
  }});
});

// ── SUBSCRIPTIONS ─────────────────────────────────────────────────
app.get('/api/subscriptions', authMiddleware, (req, res) => {
  const sub = db.subscriptions[req.user.id] || null;
  res.json({ success:true, data:sub });
});

app.post('/api/subscriptions', authMiddleware, (req, res) => {
  const { plan, method, price } = req.body;
  const sub = { plan, method, price, activatedAt: new Date().toISOString(), userId: req.user.id };
  db.subscriptions[req.user.id] = sub;
  res.json({ success:true, data:sub });
});

// ── UPLOAD IMAGE ──────────────────────────────────────────────────
app.post('/api/upload', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) return res.json({ success:false, error:'Aucun fichier reçu' });
  const url = `/uploads/${req.file.filename}`;
  res.json({ success:true, data:{ url, filename: req.file.filename, size: req.file.size } });
});

app.use('/uploads', express.static(UPLOAD_DIR));

// ── 404 ───────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success:false, error:'Route introuvable' });
});

// ─── DÉMARRAGE ────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Makario API — démarré (mode mémoire)     ║');
  console.log('╠════════════════════════════════════════════╣');
  console.log(`║   → http://localhost:${PORT}/api/health        ║`);
  console.log('║   → Socket.io : actif                      ║');
  console.log('║   → Upload    : /api/upload                ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log('');
});
