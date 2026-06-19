// ═══════════════════════════════════════════════════════════════
//  MAKARIO BACKEND — server.js  v2.1
//  Stack : Node.js + Express + Socket.io + MongoDB (Mongoose)
// ═══════════════════════════════════════════════════════════════

const express    = require('express');
const http       = require('http');
const cors       = require('cors');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const multer     = require('multer');
const mongoose   = require('mongoose');
const { Server } = require('socket.io');
const cloudinary = require('cloudinary').v2;
const rateLimit  = require('express-rate-limit');

const app        = express();
const httpServer = http.createServer(app);

const PORT        = process.env.PORT       || 3000;
const JWT_SECRET  = process.env.JWT_SECRET || 'makario_secret_2024_congo';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/makario';

if (!process.env.JWT_SECRET)
  console.warn("⚠️  JWT_SECRET non défini — ajoutez-le dans les variables d'environnement Render !");

const ALLOWED_ORIGINS = [
  'https://shimmering-gingersnap-5c4b72.netlify.app',
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
];

const io = new Server(httpServer, {
  cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'] }
});

// ─── CONNEXION MONGODB ────────────────────────────────────────
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB connecté'))
  .catch(err => { console.error('❌ MongoDB:', err.message); process.exit(1); });

app.use(cors({
  origin: (origin, cb) => (!origin || ALLOWED_ORIGINS.includes(origin)) ? cb(null, true) : cb(new Error('CORS bloqué'))
}));
app.use(express.json());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success:false, error:'Trop de tentatives. Réessayez dans 15 minutes.' }
});

// ─── CLOUDINARY ───────────────────────────────────────────────
cloudinary.config({
  cloud_name:  process.env.CLOUDINARY_CLOUD_NAME,
  api_key:     process.env.CLOUDINARY_API_KEY,
  api_secret:  process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    /jpeg|jpg|png|gif|webp/.test(file.mimetype) ? cb(null, true) : cb(new Error('Images uniquement'));
  }
});

// ─── SCHEMAS MONGOOSE ─────────────────────────────────────────
const toJSON = {
  toJSON: {
    virtuals: true,
    transform: (_doc, ret) => { ret.id = ret._id; delete ret._id; delete ret.__v; return ret; }
  }
};

const UserSchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true },
  email:      { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:   { type: String, required: true },
  profession: { type: String, default: '' },
  city:       { type: String, default: '' },
  avatar:     { type: String, default: null },
  favorites:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'Company' }],
  createdAt:  { type: Date, default: Date.now }
}, toJSON);

const CompanySchema = new mongoose.Schema({
  name:      { type: String, required: true, trim: true },
  sector:    { type: String, default: '', index: true },
  city:      { type: String, default: '', index: true },
  services:  { type: String, default: '' },
  vision:    { type: String, default: '' },
  address:   { type: String, default: '' },
  phone:     { type: String, default: '' },
  email:     { type: String, default: '' },
  website:   { type: String, default: '' },
  cover:     { type: String, default: '🏢' },
  initials:  { type: String, default: '?' },
  ownerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  verified:  { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}, toJSON);

const SectorSchema = new mongoose.Schema({
  slug:  { type: String, unique: true },
  label: String,
  icon:  String,
  count: { type: Number, default: 0 }
}, toJSON);

const NewsSchema = new mongoose.Schema({
  company:  { type: String, default: 'Makario' },
  avatar:   { type: String, default: 'MK' },
  title:    { type: String, required: true },
  body:     { type: String, required: true },
  emoji:    { type: String, default: '📢' },
  image:    { type: String, default: null },
  likes:    { type: Number, default: 0 },
  likedBy:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments: { type: Array, default: [] },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  date:     { type: Date, default: Date.now }
}, toJSON);

const ConversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  name:      { type: String, default: 'Conversation' },
  initials:  { type: String, default: '?' },
  createdAt: { type: Date, default: Date.now }
}, toJSON);

const MessageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  senderId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text:           { type: String, required: true },
  date:           { type: Date, default: Date.now }
}, toJSON);

const SubscriptionSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  plan:        { type: String, default: 'Gratuit' },
  method:      { type: String, default: '' },
  price:       { type: String, default: '0' },
  activatedAt: { type: Date, default: Date.now }
}, toJSON);

CompanySchema.index({ name: 'text', services: 'text' });
ConversationSchema.index({ participants: 1 });

const User         = mongoose.model('User', UserSchema);
const Company      = mongoose.model('Company', CompanySchema);
const Sector       = mongoose.model('Sector', SectorSchema);
const News         = mongoose.model('News', NewsSchema);
const Conversation = mongoose.model('Conversation', ConversationSchema);
const Message      = mongoose.model('Message', MessageSchema);
const Subscription = mongoose.model('Subscription', SubscriptionSchema);

// ─── SEED — données initiales si DB vide ─────────────────────
async function seedDB() {
  // Entreprises
  if (await Company.countDocuments() === 0) {
    await Company.insertMany([
      { name:'SIGTH-TECH CONGO',  sector:'TIC',                   city:'Brazzaville', services:"Développement web et mobile, solutions informatiques sur mesure, hébergement cloud.", vision:"Être le partenaire N°1 du peuple congolais dans le domaine des TIC.", address:'84, Rue Mayama, Brazzaville', cover:'💻', initials:'ST', verified:true },
      { name:'BEST INFORMATIQUE', sector:'TIC',                   city:'Pointe-Noire', services:"Vente de matériel informatique, maintenance, formation, réseaux.", vision:"Digitaliser les entreprises congolaises à moindre coût.", address:'Centre-ville, Pointe-Noire', cover:'🖥️', initials:'BI' },
      { name:'EGCM',              sector:'Éducation & Formation', city:'Brazzaville', services:"Formation professionnelle qualifiante, coaching emploi, stages en entreprise.", vision:"Former la jeunesse congolaise pour l'emploi de demain.", address:'84, Rue Mayama, Immeuble BGF1', cover:'📚', initials:'EG', verified:true },
      { name:'AOFIP',             sector:'Éducation & Formation', city:'Brazzaville', services:"Formation professionnelle et qualifiante, insertion professionnelle, coaching.", vision:"Vers l'emploi, mais pas seul.", address:'Rue Matsoua, Brazzaville', cover:'🎓', initials:'AO' },
      { name:'AI COMMUNICATION',  sector:'TIC',                   city:'Brazzaville', services:"Agence de communication digitale, création de contenu, réseaux sociaux, branding.", vision:"Booster la visibilité des marques congolaises.", address:'Plateau de 15 ans, Brazzaville', cover:'📡', initials:'AI' },
      { name:'MAGIC DESIGN',      sector:'Culture & Arts',        city:'Pointe-Noire', services:"Design graphique, identité visuelle, création de logo, impression.", vision:"L'art au service des entreprises.", address:'Lumumba, Pointe-Noire', cover:'🎨', initials:'MD' },
      { name:'MUSAS CONGO',       sector:'Commerce',              city:'Brazzaville', services:"Distribution alimentaire, import-export, grossiste, livraison.", vision:"Nourrir le Congo, de Brazzaville à Owando.", address:'Marché Total, Brazzaville', cover:'🛒', initials:'MC' },
      { name:'BTP PRO CONGO',     sector:'BTP',                   city:'Dolisie',     services:"Construction, rénovation, génie civil, architecture, études techniques.", vision:"Bâtir le Congo moderne, pierre par pierre.", address:'Centre, Dolisie', cover:'🏗️', initials:'BP' },
    ]);
    console.log('✅ Entreprises initiales créées');
  }

  // Secteurs
  if (await Sector.countDocuments() === 0) {
    await Sector.insertMany([
      { slug:'tic',       label:'TIC',                    icon:'💻', count:124 },
      { slug:'commerce',  label:'Commerce',                icon:'🛒', count:312 },
      { slug:'services',  label:'Prestations de services', icon:'⚙️', count:198 },
      { slug:'btp',       label:'BTP',                    icon:'🏗️', count:87  },
      { slug:'tourisme',  label:'Tourisme & Restauration', icon:'🍽️', count:64  },
      { slug:'culture',   label:'Culture & Arts',          icon:'🎨', count:43  },
      { slug:'sante',     label:'Santé',                  icon:'🏥', count:91  },
      { slug:'education', label:'Éducation & Formation',  icon:'📚', count:76  },
    ]);
    console.log('✅ Secteurs initiaux créés');
  }

  // Publications
  if (await News.countDocuments() === 0) {
    const t = Date.now();
    await News.insertMany([
      { company:'EGCM',           avatar:'EG', title:'Formation Femme & TIC — Inscriptions ouvertes!',       body:"La prochaine session de formation Excel, comptabilité et bureautique commence le 14 Mars.", emoji:'📊', likes:24, date:new Date(t-3600000) },
      { company:'AOFIP',          avatar:'AO', title:'Offre de stage bénévole en entreprise',                body:"Je prépare mon stage en entreprise. Vers l'emploi mais pas seul.", emoji:'💼', likes:41, date:new Date(t-7200000) },
      { company:'AI COMMUNICATION',avatar:'AI',title:'Nouveau service : Community Management',               body:"Nous lançons notre offre de gestion des réseaux sociaux pour les PME.", emoji:'📱', likes:18, date:new Date(t-86400000) },
      { company:'SIGTH-TECH',     avatar:'ST', title:"Développement d'application mobile sur mesure",        body:"Vous avez un projet d'application ? Nous transformons vos idées en solutions numériques.", emoji:'📲', likes:56, date:new Date(t-172800000) },
    ]);
    console.log('✅ Publications initiales créées');
  }
}
mongoose.connection.once('open', async () => {
  await seedDB();
  await Company.updateMany({ initials:{ $exists:false }, init:{ $exists:true } }, [{ $set:{ initials:'$init' } }]).catch(()=>{});
  await Conversation.updateMany({ initials:{ $exists:false }, init:{ $exists:true } }, [{ $set:{ initials:'$init' } }]).catch(()=>{});
});

// ─── HELPERS ─────────────────────────────────────────────────
function safeUser(u) {
  const obj = u.toJSON();
  delete obj.password;
  delete obj.favorites;
  return obj;
}

// ─── MIDDLEWARE AUTH ──────────────────────────────────────────
async function authMiddleware(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer '))
    return res.json({ success:false, error:'Non authentifié' });
  try {
    const { id } = jwt.verify(h.slice(7), JWT_SECRET);
    req.user = await User.findById(id);
    if (!req.user) return res.json({ success:false, error:'Utilisateur introuvable' });
    next();
  } catch { res.json({ success:false, error:'Token invalide' }); }
}

// ─── SOCKET.IO ────────────────────────────────────────────────
io.use(async (socket, next) => {
  try {
    const { id } = jwt.verify(socket.handshake.auth?.token || '', JWT_SECRET);
    const user = await User.findById(id);
    if (!user) return next(new Error('Utilisateur introuvable'));
    socket.userId = user._id.toString();
    socket.userName = user.name;
    next();
  } catch { next(new Error('Non authentifié')); }
});

io.on('connection', (socket) => {
  socket.on('join_conv', async (convId) => {
    const conv = await Conversation.findById(convId).catch(() => null);
    if (conv?.participants.some(p => p.toString() === socket.userId))
      socket.join('conv_' + convId);
  });
  socket.on('leave_conv', (convId) => socket.leave('conv_' + convId));
});

// ═══════════════════════════════════════════════════════════════
//  ROUTES
// ═══════════════════════════════════════════════════════════════

app.get('/api/health', (_req, res) => res.json({ success:true, message:'Makario API v2.0 — MongoDB', uptime: process.uptime() }));

// ── AUTH ──────────────────────────────────────────────────────
app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const { name, email, password, company } = req.body;
    if (!name || !email || !password)
      return res.json({ success:false, error:'Champs requis manquants' });
    if (await User.findOne({ email: email.toLowerCase() }))
      return res.json({ success:false, error:'Email déjà utilisé' });

    const user = await User.create({ name, email: email.toLowerCase(), password: await bcrypt.hash(password, 10) });

    if (company?.name) {
      await Company.create({
        name: company.name, sector: company.sector||'', city: company.city||'',
        services: company.services||'', cover:'🏢',
        initials: company.name.slice(0,2).toUpperCase(), ownerId: user._id
      });
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn:'30d' });
    res.json({ success:true, data:{ token, user:safeUser(user) } });
  } catch(e) { res.json({ success:false, error:e.message }); }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() });
    if (!user || !await bcrypt.compare(password, user.password))
      return res.json({ success:false, error:'Email ou mot de passe incorrect' });
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn:'30d' });
    res.json({ success:true, data:{ token, user:safeUser(user) } });
  } catch(e) { res.json({ success:false, error:e.message }); }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  res.json({ success:true, data:safeUser(req.user) });
});

app.put('/api/auth/profile', authMiddleware, async (req, res) => {
  try {
    const { name, profession, city, avatar } = req.body;
    const upd = {};
    if (name) upd.name = name;
    if (profession !== undefined) upd.profession = profession;
    if (city !== undefined) upd.city = city;
    if (avatar !== undefined) upd.avatar = avatar;
    const user = await User.findByIdAndUpdate(req.user._id, upd, { new:true });
    res.json({ success:true, data:safeUser(user) });
  } catch(e) { res.json({ success:false, error:e.message }); }
});

// ── COMPANIES ─────────────────────────────────────────────────
app.get('/api/companies', async (req, res) => {
  try {
    const { page=1, limit=50, sector, city, q } = req.query;
    const filter = {};
    if (sector) filter.sector = sector;
    if (city)   filter.city   = city;
    if (q)      filter.$or = [{ name:{ $regex:q, $options:'i' } },{ services:{ $regex:q, $options:'i' } }];
    const skip = (Math.max(1, parseInt(page)) - 1) * Math.min(100, parseInt(limit));
    const lim  = Math.min(100, parseInt(limit));
    const [data, total] = await Promise.all([
      Company.find(filter).sort({ createdAt:1 }).skip(skip).limit(lim),
      Company.countDocuments(filter)
    ]);
    res.json({ success:true, data, pagination:{ page:parseInt(page), limit:lim, total, pages:Math.ceil(total/lim) } });
  } catch(e) { res.json({ success:false, error:e.message }); }
});

app.get('/api/companies/:id', async (req, res) => {
  try {
    const c = await Company.findById(req.params.id);
    if (!c) return res.json({ success:false, error:'Entreprise introuvable' });
    res.json({ success:true, data:c });
  } catch(e) { res.json({ success:false, error:e.message }); }
});

app.post('/api/companies', authMiddleware, async (req, res) => {
  try {
    const { name, sector, city, services, vision, address } = req.body;
    if (!name || !sector) return res.json({ success:false, error:'Nom et secteur requis' });
    const c = await Company.create({
      name, sector, city:city||'', services:services||'', vision:vision||'',
      address:address||'', cover:'🏢', initials:name.slice(0,2).toUpperCase(), ownerId:req.user._id
    });
    res.json({ success:true, data:c });
  } catch(e) { res.json({ success:false, error:e.message }); }
});

app.patch('/api/companies/:id', authMiddleware, async (req, res) => {
  try {
    const c = await Company.findById(req.params.id);
    if (!c) return res.json({ success:false, error:'Entreprise introuvable' });
    if (!c.ownerId?.equals(req.user._id))
      return res.status(403).json({ success:false, error:'Non autorisé' });
    const allowed = ['name','sector','city','services','vision','address','phone','email','website'];
    const upd = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) upd[k] = req.body[k]; });
    if (upd.name) upd.initials = upd.name.slice(0,2).toUpperCase();
    const updated = await Company.findByIdAndUpdate(req.params.id, upd, { new:true });
    res.json({ success:true, data:updated });
  } catch(e) { res.json({ success:false, error:e.message }); }
});

app.delete('/api/companies/:id', authMiddleware, async (req, res) => {
  try {
    const c = await Company.findById(req.params.id);
    if (!c) return res.json({ success:false, error:'Entreprise introuvable' });
    if (!c.ownerId?.equals(req.user._id))
      return res.status(403).json({ success:false, error:'Non autorisé' });
    await Company.findByIdAndDelete(req.params.id);
    res.json({ success:true });
  } catch(e) { res.json({ success:false, error:e.message }); }
});

// ── SECTORS ───────────────────────────────────────────────────
app.get('/api/sectors', async (_req, res) => {
  try {
    res.json({ success:true, data: await Sector.find() });
  } catch(e) { res.json({ success:false, error:e.message }); }
});

// ── NEWS ──────────────────────────────────────────────────────
app.get('/api/news', async (_req, res) => {
  try {
    res.json({ success:true, data: await News.find().sort({ date:-1 }) });
  } catch(e) { res.json({ success:false, error:e.message }); }
});

app.post('/api/news', authMiddleware, async (req, res) => {
  try {
    const { title, body, emoji, image } = req.body;
    if (!title || !body) return res.json({ success:false, error:'Titre et contenu requis' });
    const n = await News.create({
      company: req.user.name,
      avatar:  req.user.name.slice(0,2).toUpperCase(),
      title, body, emoji: emoji||'📢',
      image: image||null, authorId: req.user._id
    });
    res.json({ success:true, data:n });
  } catch(e) { res.json({ success:false, error:e.message }); }
});

app.post('/api/news/:id/like', authMiddleware, async (req, res) => {
  try {
    const n = await News.findById(req.params.id);
    if (!n) return res.json({ success:false, error:'Publication introuvable' });
    if (!n.likedBy.some(id => id.equals(req.user._id))) {
      n.likedBy.push(req.user._id);
      n.likes++;
      await n.save();
    }
    res.json({ success:true, data:n });
  } catch(e) { res.json({ success:false, error:e.message }); }
});

app.post('/api/news/:id/unlike', authMiddleware, async (req, res) => {
  try {
    const n = await News.findById(req.params.id);
    if (!n) return res.json({ success:false, error:'Publication introuvable' });
    n.likedBy = n.likedBy.filter(id => !id.equals(req.user._id));
    n.likes   = n.likedBy.length;
    await n.save();
    res.json({ success:true, data:n });
  } catch(e) { res.json({ success:false, error:e.message }); }
});

app.delete('/api/news/:id', authMiddleware, async (req, res) => {
  try {
    const n = await News.findById(req.params.id);
    if (!n) return res.json({ success:false, error:'Publication introuvable' });
    if (!n.authorId?.equals(req.user._id))
      return res.status(403).json({ success:false, error:'Non autorisé' });
    await News.findByIdAndDelete(req.params.id);
    res.json({ success:true });
  } catch(e) { res.json({ success:false, error:e.message }); }
});

// ── FAVORITES ─────────────────────────────────────────────────
app.get('/api/favorites', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('favorites');
    res.json({ success:true, data: user.favorites });
  } catch(e) { res.json({ success:false, error:e.message }); }
});

app.post('/api/favorites/:companyId', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user.favorites.some(id => id.toString() === req.params.companyId))
      return res.json({ success:false, error:'Déjà en favoris' });
    user.favorites.push(req.params.companyId);
    await user.save();
    res.json({ success:true });
  } catch(e) { res.json({ success:false, error:e.message }); }
});

app.delete('/api/favorites/:companyId', authMiddleware, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { $pull:{ favorites: req.params.companyId } });
    res.json({ success:true });
  } catch(e) { res.json({ success:false, error:e.message }); }
});

// ── CONVERSATIONS ─────────────────────────────────────────────
app.get('/api/conversations', authMiddleware, async (req, res) => {
  try {
    const uid = req.user._id;
    const convs = await Conversation.find({ participants: uid }).sort({ createdAt:-1 });

    const result = await Promise.all(convs.map(async (c) => {
      const lastMsg = await Message.findOne({ conversationId: c._id }).sort({ date:-1 });
      const otherId = c.participants.find(p => !p.equals(uid));
      const other   = otherId ? await User.findById(otherId).lean().catch(()=>null) : null;
      return {
        ...c.toJSON(),
        name:     c.name || other?.name || 'Conversation',
        initials: c.initials || other?.name?.slice(0,2).toUpperCase() || '?',
        preview: lastMsg?.text?.slice(0,40) || '',
        time:    lastMsg?.date || c.createdAt,
        unread:  0
      };
    }));
    res.json({ success:true, data:result });
  } catch(e) { res.json({ success:false, error:e.message }); }
});

app.post('/api/conversations', authMiddleware, async (req, res) => {
  try {
    const { recipientId, companyId } = req.body;
    const uid = req.user._id;

    // Look for company info to name the conversation
    const company = companyId ? await Company.findById(companyId).lean().catch(()=>null) : null;
    const recipient = recipientId ? await User.findById(recipientId).lean().catch(()=>null) : null;
    const convName = company?.name || recipient?.name || 'Conversation';
    const convInit = company?.initials || recipient?.name?.slice(0,2).toUpperCase() || '?';

    // Check if conversation already exists with this name/company
    const existing = await Conversation.findOne({ participants: uid, name: convName });
    if (existing) return res.json({ success:true, data:existing });

    // Build participants array
    const others = [];
    if (recipient) others.push(recipient._id);
    else if (company?.ownerId) others.push(company.ownerId);

    const conv = await Conversation.create({
      participants: [uid, ...others],
      name: convName,
      initials: convInit
    });
    res.json({ success:true, data:conv });
  } catch(e) { res.json({ success:false, error:e.message }); }
});

app.get('/api/conversations/:id/messages', authMiddleware, async (req, res) => {
  try {
    const msgs = await Message.find({ conversationId: req.params.id }).sort({ date:1 });
    const uid  = req.user._id.toString();
    res.json({ success:true, data: msgs.map(m => ({ ...m.toJSON(), sent: m.senderId.toString() === uid })) });
  } catch(e) { res.json({ success:false, error:e.message }); }
});

app.post('/api/conversations/:id/messages', authMiddleware, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.json({ success:false, error:'Message vide' });
    const msg = await Message.create({
      conversationId: req.params.id,
      senderId: req.user._id,
      text: text.trim()
    });
    io.to('conv_' + req.params.id).emit('new_message', { ...msg.toJSON(), sent:false, conversationId: req.params.id });
    res.json({ success:true, data:{ ...msg.toJSON(), sent:true } });
  } catch(e) { res.json({ success:false, error:e.message }); }
});

// ── STATS ─────────────────────────────────────────────────────
app.get('/api/stats', async (_req, res) => {
  try {
    const [totalCompanies, totalUsers, totalNews, totalSectors] = await Promise.all([
      Company.countDocuments(),
      User.countDocuments(),
      News.countDocuments(),
      Sector.countDocuments()
    ]);
    res.json({ success:true, data:{ totalCompanies, totalUsers, totalNews, totalSectors } });
  } catch(e) { res.json({ success:false, error:e.message }); }
});

// ── SUBSCRIPTIONS ─────────────────────────────────────────────
app.get('/api/subscriptions', authMiddleware, async (req, res) => {
  try {
    res.json({ success:true, data: await Subscription.findOne({ userId: req.user._id }) });
  } catch(e) { res.json({ success:false, error:e.message }); }
});

app.post('/api/subscriptions', authMiddleware, async (req, res) => {
  try {
    const { plan, method, price } = req.body;
    const sub = await Subscription.findOneAndUpdate(
      { userId: req.user._id },
      { plan, method, price, activatedAt: new Date() },
      { upsert:true, new:true }
    );
    res.json({ success:true, data:sub });
  } catch(e) { res.json({ success:false, error:e.message }); }
});

// ── UPLOAD ────────────────────────────────────────────────────
app.post('/api/upload', authMiddleware, upload.single('file'), async (req, res) => {
  if (!req.file) return res.json({ success:false, error:'Aucun fichier reçu' });
  try {
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { folder: 'makario', transformation: [{ width: 800, crop: 'limit' }] },
        (err, data) => err ? reject(err) : resolve(data)
      ).end(req.file.buffer);
    });
    res.json({ success:true, data:{ url: result.secure_url, filename: result.public_id, size: req.file.size } });
  } catch(err) {
    res.json({ success:false, error: err.message });
  }
});

// ── 404 ───────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ success:false, error:'Route introuvable' }));

// ─── DÉMARRAGE ────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   MAKARIO API v2.0 — Node + MongoDB            ║');
  console.log('╠════════════════════════════════════════════════╣');
  console.log(`║   Port : ${PORT}                                    ║`);
  console.log(`║   DB   : ${MONGODB_URI.includes('mongodb+srv') ? 'MongoDB Atlas ✅' : 'MongoDB Local  ⚠️'}  ║`);
  console.log('╚════════════════════════════════════════════════╝');
});
