const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

const tabs = document.querySelectorAll('.tab');
const panels = {
  referral: document.getElementById('referralPanel'),
  market: document.getElementById('marketPanel')
};

const pointValue = document.getElementById('pointValue');
const userName = document.getElementById('userName');
const userAvatar = document.getElementById('userAvatar');
const referralLinkInput = document.getElementById('referralLink');
const copyReferralBtn = document.getElementById('copyReferral');
const copyStatus = document.getElementById('copyStatus');
const marketGrid = document.getElementById('marketGrid');
const orderStatus = document.getElementById('orderStatus');

let profile = null;
let marketItems = [];

for (const tab of tabs) {
  tab.addEventListener('click', () => {
    tabs.forEach((btn) => btn.classList.remove('active'));
    Object.values(panels).forEach((panel) => panel.classList.remove('active'));
    tab.classList.add('active');
    panels[tab.dataset.tab].classList.add('active');
  });
}

function setUserHeader(user) {
  const uname = user.username ? `@${user.username}` : `${user.first_name || ''} ${user.last_name || ''}`.trim();
  userName.textContent = uname || 'Telegram Kullanıcısı';

  if (user.photo_url) {
    userAvatar.src = user.photo_url;
    return;
  }

  const fallbackSvg = encodeURIComponent(`
    <svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'>
      <defs>
        <linearGradient id='g' x1='0' x2='1' y1='0' y2='1'>
          <stop offset='0%' stop-color='#6ea8fe'/>
          <stop offset='100%' stop-color='#6ee7b7'/>
        </linearGradient>
      </defs>
      <rect width='100' height='100' fill='url(#g)'/>
      <text x='50' y='58' font-size='34' text-anchor='middle' fill='#0b1a35' font-family='Arial'>${(uname || 'TG').slice(1, 2).toUpperCase()}</text>
    </svg>
  `);
  userAvatar.src = `data:image/svg+xml;charset=UTF-8,${fallbackSvg}`;
}

function renderMarket() {
  marketGrid.innerHTML = '';
  for (const item of marketItems) {
    const enough = (profile?.points || 0) >= item.points;
    const card = document.createElement('article');
    card.className = 'market-item';
    card.innerHTML = `
      <h3>${item.name}</h3>
      <p>${item.description}</p>
      <div class="row">
        <strong>${item.points} puan</strong>
        <button ${enough ? '' : 'disabled'}>${enough ? 'Sipariş Ver' : 'Puan Yetersiz'}</button>
      </div>
    `;

    card.querySelector('button').addEventListener('click', () => createOrder(item.id));
    marketGrid.appendChild(card);
  }
}

async function createOrder(itemId) {
  orderStatus.textContent = 'Sipariş gönderiliyor...';
  const response = await fetch('/api/order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telegramId: profile.telegramId, itemId })
  });

  const result = await response.json();
  if (!response.ok) {
    orderStatus.textContent = `Hata: ${result.error}`;
    return;
  }

  profile = result.profile;
  pointValue.textContent = profile.points;
  renderMarket();
  orderStatus.textContent = `${result.order.itemName} siparişin alındı. Sipariş No: ${result.order.id}`;
}

async function bootstrap() {
  const fallbackUser = {
    id: 100100,
    username: 'demo_user',
    first_name: 'Demo',
    last_name: 'User',
    language_code: 'tr'
  };

  const user = tg?.initDataUnsafe?.user || fallbackUser;
  const startParam = tg?.initDataUnsafe?.start_param || null;
  setUserHeader(user);

  const response = await fetch('/api/launch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user, startParam })
  });

  const data = await response.json();
  if (!response.ok) {
    orderStatus.textContent = `Hata: ${data.error}`;
    return;
  }

  profile = data.profile;
  marketItems = data.marketItems;

  pointValue.textContent = profile.points;
  referralLinkInput.value = data.referralLink;
  renderMarket();
}

copyReferralBtn.addEventListener('click', async () => {
  await navigator.clipboard.writeText(referralLinkInput.value);
  copyStatus.textContent = 'Referans bağlantısı kopyalandı.';
});

bootstrap();