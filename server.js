const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 3000;
const root = __dirname;
const publicDir = path.join(root, 'public');
const dataDir = path.join(root, 'data');
const usersFile = path.join(dataDir, 'users.json');
const ordersFile = path.join(dataDir, 'orders.json');

const marketItems = [
  { id: 'basic-prompt', name: 'Basic İstem Paketi', points: 100, description: '1 adet kısa istem şablonu' },
  { id: 'pro-prompt', name: 'Pro İstem Paketi', points: 250, description: '5 adet optimize istem şablonu' },
  { id: 'team-prompt', name: 'Takım Paketi', points: 500, description: '20 adet gelişmiş istem şablonu' }
];

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(usersFile)) fs.writeFileSync(usersFile, JSON.stringify({}, null, 2));
if (!fs.existsSync(ordersFile)) fs.writeFileSync(ordersFile, JSON.stringify([], null, 2));

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function respondJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function serveStatic(req, res) {
  const requestPath = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.join(publicDir, decodeURIComponent(requestPath));

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath);
    const contentTypes = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8'
    };

    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/api/market-items') {
    return respondJson(res, 200, marketItems);
  }

  if (req.method === 'POST' && req.url === '/api/launch') {
    try {
      const { user, startParam } = await parseBody(req);
      if (!user || !user.id) return respondJson(res, 400, { error: 'Geçerli kullanıcı bilgisi gönderilmedi.' });

      const users = readJson(usersFile);
      const key = String(user.id);
      const now = new Date().toISOString();

      const existing = users[key] || {
        telegramId: user.id,
        points: 0,
        referrals: [],
        referredBy: null,
        createdAt: now
      };

      users[key] = {
        ...existing,
        username: user.username || '',
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        languageCode: user.language_code || '',
        isPremium: Boolean(user.is_premium),
        allowsWriteToPm: Boolean(user.allows_write_to_pm),
        updatedAt: now
      };

      if (startParam && !users[key].referredBy) {
        const referrerId = String(startParam);
        if (users[referrerId] && referrerId !== key && !users[referrerId].referrals.includes(user.id)) {
          users[key].referredBy = Number(referrerId);
          users[referrerId].referrals.push(user.id);
          users[referrerId].points += 50;
        }
      }

      writeJson(usersFile, users);

      return respondJson(res, 200, {
        profile: users[key],
        referralLink: `https://t.me/your_bot_username/app?startapp=${user.id}`,
        marketItems
      });
    } catch {
      return respondJson(res, 400, { error: 'Bozuk JSON gövdesi.' });
    }
  }

  if (req.method === 'POST' && req.url === '/api/order') {
    try {
      const { telegramId, itemId } = await parseBody(req);
      if (!telegramId || !itemId) return respondJson(res, 400, { error: 'Eksik sipariş verisi.' });

      const users = readJson(usersFile);
      const key = String(telegramId);
      const user = users[key];
      if (!user) return respondJson(res, 404, { error: 'Kullanıcı bulunamadı.' });

      const item = marketItems.find((entry) => entry.id === itemId);
      if (!item) return respondJson(res, 404, { error: 'Ürün bulunamadı.' });
      if (user.points < item.points) return respondJson(res, 400, { error: 'Yetersiz puan.' });

      user.points -= item.points;
      users[key] = user;
      writeJson(usersFile, users);

      const orders = readJson(ordersFile);
      const order = {
        id: `ORD-${Date.now()}`,
        telegramId,
        itemId,
        itemName: item.name,
        consumedPoints: item.points,
        createdAt: new Date().toISOString()
      };
      orders.push(order);
      writeJson(ordersFile, orders);

      return respondJson(res, 200, { success: true, order, profile: user });
    } catch {
      return respondJson(res, 400, { error: 'Bozuk JSON gövdesi.' });
    }
  }

  if (req.method === 'GET') {
    return serveStatic(req, res);
  }

  res.writeHead(405);
  res.end('Method Not Allowed');
});

server.listen(port, () => {
  console.log(`Mini app server running at http://localhost:${port}`);
});
