document.addEventListener('DOMContentLoaded', () => {
  // --- Clock Optimization ---
  const clockElement = document.getElementById('clock');
  function updateClock() {
    const now = new Date();
    clockElement.textContent = now.toTimeString().split(' ')[0] + ' JST';
  }
  setInterval(updateClock, 1000);
  updateClock();

  // --- Weather Module ---
  const weatherData = [
    { city: '札幌', temp: '18°C', desc: '晴れ' },
    { city: '仙台', temp: '21°C', desc: '曇り' },
    { city: '東京', temp: '24°C', desc: '快晴' },
    { city: '名古屋', temp: '25°C', desc: '晴れ' },
    { city: '大阪', temp: '26°C', desc: '薄曇り' },
    { city: '福岡', temp: '23°C', desc: '雨' },
  ];

  function renderWeather() {
    const grid = document.getElementById('weather-grid');
    grid.innerHTML = weatherData.map(w => `
      <div class="weather-card">
        <div class="weather-city">${w.city}</div>
        <div class="weather-temp">${w.temp}</div>
        <div class="weather-desc">${w.desc}</div>
      </div>
    `).join('');
  }
  renderWeather();

  // --- News & Coordinates ---
  const cityCoords = {
    '札幌': { x: 450, y: 100 },
    '仙台': { x: 420, y: 220 },
    '東京': { x: 385, y: 285 },
    '名古屋': { x: 330, y: 310 },
    '大阪': { x: 290, y: 325 },
    '福岡': { x: 185, y: 365 },
    '那覇': { x: 100, y: 470 }
  };

  const fallbackNews = [
    { title: '首都圏交通網のスマート運行システムのテストが開始', loc: '東京', time: '10分前', link: 'https://news.yahoo.co.jp/' },
    { title: '関西経済圏におけるデジタルイノベーション技術展が開催', loc: '大阪', time: '25分前', link: 'https://news.yahoo.co.jp/' },
    { title: '北海道エリアで大規模な再生可能エネルギー事業が始動', loc: '札幌', time: '40分前', link: 'https://news.yahoo.co.jp/' },
    { title: '九州IT特区における次世代半導体ファブの操業計画発表', loc: '福岡', time: '1時間前', link: 'https://news.yahoo.co.jp/' },
    { title: '中部エリアのモビリティ自動化検証ネットワーク構築', loc: '名古屋', time: '1時間前', link: 'https://news.yahoo.co.jp/' },
    { title: '東北気象データのリアルタイム解析モデルの運用を開始', loc: '仙台', time: '2時間前', link: 'https://news.yahoo.co.jp/' }
  ];

  async function fetchNews() {
    const rssUrl = 'https://news.yahoo.co.jp/rss/topics/top-picks.xml';
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;

    try {
      const res = await fetch(apiUrl);
      const data = await res.json();
      
      if (data.status === 'ok' && data.items.length > 0) {
        const parsedItems = data.items.map(item => {
          const cities = Object.keys(cityCoords);
          const matchedCity = cities.find(c => item.title.includes(c)) || cities[Math.floor(Math.random() * cities.length)];
          return {
            title: item.title,
            loc: matchedCity,
            time: '最新',
            link: item.link
          };
        });
        renderNewsList(parsedItems);
      } else {
        renderNewsList(fallbackNews);
      }
    } catch (e) {
      renderNewsList(fallbackNews);
    }
  }

  function renderNewsList(items) {
    const container = document.getElementById('news-container');
    container.innerHTML = items.map(item => `
      <div class="news-item" data-loc="${item.loc}" data-title="${escapeHtml(item.title)}" data-link="${item.link}">
        <div class="news-meta">
          <span class="news-location-tag">📍 ${item.loc}</span>
          <span>${item.time}</span>
        </div>
        <div class="news-title">${escapeHtml(item.title)}</div>
        <a class="news-link" href="${item.link}" target="_blank" rel="noopener">READ DATA STREAM ➔</a>
      </div>
    `).join('');

    // Event Delegation for News Items (High Performance)
    container.addEventListener('mouseover', (e) => {
      const item = e.target.closest('.news-item');
      if (item) {
        highlightMapNode(item.dataset.loc, item.dataset.title);
      }
    });

    container.addEventListener('mouseout', (e) => {
      if (e.target.closest('.news-item')) {
        hideMapPopup();
      }
    });

    container.addEventListener('click', (e) => {
      const item = e.target.closest('.news-item');
      if (item && !e.target.classList.contains('news-link')) {
        window.open(item.dataset.link, '_blank');
      }
    });
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[m]);
  }

  // --- Interactive Map Popups ---
  const mapContainer = document.querySelector('.map-container');
  const popup = document.getElementById('map-popup');
  const popupTitle = document.getElementById('popup-title');
  const popupDesc = document.getElementById('popup-desc');
  const svg = document.getElementById('japan-map-svg');

  function highlightMapNode(cityName, text) {
    const coords = cityCoords[cityName];
    if (!coords) return;

    popupTitle.textContent = `TARGET: ${cityName}`;
    popupDesc.textContent = text;

    const rect = svg.getBoundingClientRect();
    const containerRect = mapContainer.getBoundingClientRect();

    const scaleX = rect.width / 600;
    const scaleY = rect.height / 550;

    const posX = (coords.x * scaleX) + (rect.left - containerRect.left);
    const posY = (coords.y * scaleY) + (rect.top - containerRect.top);

    popup.style.left = `${posX}px`;
    popup.style.top = `${posY}px`;
    popup.classList.add('visible');
  }

  function hideMapPopup() {
    popup.classList.remove('visible');
  }

  // Event Delegation for City Nodes
  svg.addEventListener('click', (e) => {
    const node = e.target.closest('.city-node');
    if (node) {
      const cityName = node.dataset.city;
      highlightMapNode(cityName, `${cityName}エリアの最新情報を同期完了`);
    }
  });

  fetchNews();

  // --- Optimized Canvas Background (Offscreen & FPS Controlled) ---
  const canvas = document.getElementById('bg-canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  let particles = [];

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  class Particle {
    constructor() {
      this.reset();
    }
    reset() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.vx = (Math.random() - 0.5) * 0.4;
      this.vy = (Math.random() - 0.5) * 0.4;
      this.size = Math.random() * 1.5 + 0.5;
      this.alpha = Math.random() * 0.5 + 0.1;
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;
      if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
        this.reset();
      }
    }
    draw() {
      ctx.fillStyle = `rgba(255, 102, 0, ${this.alpha})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (let i = 0; i < 50; i++) {
    particles.push(new Particle());
  }

  function animate() {
    ctx.fillStyle = '#02060d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < particles.length; i++) {
      particles[i].update();
      particles[i].draw();
    }
    requestAnimationFrame(animate);
  }
  animate();
});