const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

const tabs = document.querySelectorAll('.tab');
const panels = {
  profile: document.getElementById('profilePanel'),
  referral: document.getElementById('referralPanel'),
  market: document.getElementById('marketPanel')
};

const userDump = document.getElementById('userDump');
const pointValue = document.getElementById('pointValue');
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

function renderMarket() {
  marketGrid.innerHTML = '';

  for (const item of marketItems) {
    const card = document.createElement('article');
    card.className = 'market-item';
    const enough = (profile?.points || 0) >= item.points;

    card.innerHTML = `
      <h3>${item.name}</h3>
      <p>${item.description}</p>
      <div class="row">
        <strong>${item.points} puan</strong>
        <button ${enough ? '' : 'disabled'} data-item="${item.id}">${enough ? 'Sipariş Ver' : 'Puan Yetersiz'}</button>
      </div>
    `;

    const orderButton = card.querySelector('button');
    orderButton.addEventListener('click', () => createOrder(item.id));
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

  const response = await fetch('/api/launch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user, startParam })
  });

  const data = await response.json();

  if (!response.ok) {
    userDump.textContent = `Hata: ${data.error}`;
    return;
  }

  profile = data.profile;
  marketItems = data.marketItems;

  pointValue.textContent = profile.points;
  referralLinkInput.value = data.referralLink;
  userDump.textContent = JSON.stringify(profile, null, 2);
  renderMarket();
}

copyReferralBtn.addEventListener('click', async () => {
  await navigator.clipboard.writeText(referralLinkInput.value);
  copyStatus.textContent = 'Referans bağlantısı kopyalandı.';
});

bootstrap();
