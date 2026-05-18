# Makario Backend

## Lancer en local
```bash
npm install
npm start
# → http://localhost:3000/api/health
```

## Déployer sur Railway
1. Va sur https://railway.app → New Project → Deploy from local
2. Glisse ce dossier dans Railway
3. Railway détecte Node.js automatiquement
4. Copie l'URL générée (ex: makario-server.up.railway.app)
5. Dans app.js remplace :
   const API_URL = 'http://localhost:3000/api';
   par :
   const API_URL = 'https://TON-URL.up.railway.app/api';
6. Rebuild l'APK

## Endpoints
- GET  /api/health
- POST /api/auth/register
- POST /api/auth/login
- GET  /api/auth/me
- GET  /api/companies
- POST /api/companies
- GET  /api/sectors
- GET  /api/news
- POST /api/news
- POST /api/news/:id/like
- POST /api/news/:id/unlike
- GET  /api/favorites
- POST /api/favorites/:id
- DELETE /api/favorites/:id
- GET  /api/conversations
- POST /api/conversations
- GET  /api/conversations/:id/messages
- POST /api/conversations/:id/messages
- GET  /api/stats
