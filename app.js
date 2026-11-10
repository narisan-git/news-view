document.addEventListener('DOMContentLoaded', () => {
  // --- Clock Optimization ---
  const clockElement = document.getElementById('clock');
  function updateClock() {
    const now = new Date();
    clockElement.textContent = now.toTimeString().split(' ')[0] + ' JST';
  }
  setInterval(updateClock, 1000);
  updateClock();

  // --- Coordinates ---

const cityCoords = {
    '札幌': { x: 470, y: 95 },
    '仙台': { x: 425, y: 210 },
    '東京': { x: 390, y: 275 },
    '名古屋': { x: 335, y: 290 },
    '大阪': { x: 295, y: 305 },
    '福岡': { x: 185, y: 345 },
    '那覇': { x: 95, y: 460 }
  };
  

  // --- Weather Module (Yahoo! Weather Scraper via Proxy) ---
  const weatherCities = [
    { name: '東京', id: '4410' },
    { name: '大阪', id: '6200' },
    { name: '名古屋', id: '5110' },
    { name: '札幌', id: '1400' },
    { name: '福岡', id: '8210' }
  ];

  // フォールバックデータ
  const fallbackWeather = [
    { city: '東京', am: '晴れ', pm: '快晴', pop: '10%', iconAm: '☀️', iconPm: '☀️' },
    { city: '大阪', am: '曇り', pm: '晴れ', pop: '20%', iconAm: '☁️', iconPm: '☀️' },
    { city: '名古屋', am: '晴れ', pm: '晴れ', pop: '0%', iconAm: '☀️', iconPm: '☀️' },
    { city: '札幌', am: '曇り', pm: '雨', pop: '60%', iconAm: '☁️', iconPm: '☔' },
    { city: '福岡', am: '小雨', pm: '曇り', pop: '40%', iconAm: '🌧️', iconPm: '☁️' }
  ];

  function getWeatherIcon(text) {
    if (!text) return '☀️';
    if (text.includes('雨')) return '☔';
    if (text.includes('雪')) return '❄️';
    if (text.includes('雷')) return '⚡';
    if (text.includes('曇')) return '☁️';
    return '☀️';
  }

  async function fetchYahooWeather() {
    const grid = document.getElementById('weather-grid');
    // Yahoo!天気のpinpoint天気（東京）URL
    const targetUrl = 'https://weather.yahoo.co.jp/weather/jp/13/4410.html';
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;

    try {
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error('Weather fetch failed');
      const htmlText = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, 'text/html');

      // Yahoo!天気のピンポイント天気テーブル要素を取得
      const todayForecast = doc.querySelector('.forecastCity');
      
      if (todayForecast) {
        // DOM解析からAM/PM・降水確率を取得
        const weatherTelop = doc.querySelector('.forecastCity .info .weather p')?.textContent.trim() || '晴れ';
        const popElements = doc.querySelectorAll('.forecastCity .rain td');
        
        // 降水確率の最大値を抽出
        let maxPop = '0%';
        if (popElements.length > 0) {
          const pops = Array.from(popElements).map(el => parseInt(el.textContent) || 0);
          maxPop = `${Math.max(...pops)}%`;
        }

        const liveData = [
          { city: '東京', am: weatherTelop.split('時々')[0] || '晴れ', pm: weatherTelop.split('のち')[1] || weatherTelop, pop: maxPop, iconAm: getWeatherIcon(weatherTelop), iconPm: getWeatherIcon(weatherTelop) },
          ...fallbackWeather.slice(1)
        ];
        renderWeather(liveData);
      } else {
        renderWeather(fallbackWeather);
      }
    } catch (e) {
      console.warn('Weather fetch fallback triggered', e);
      renderWeather(fallbackWeather);
    }
  }

  function renderWeather(data) {
    const grid = document.getElementById('weather-grid');
    if (!grid) return;
    grid.innerHTML = data.map(w => `
      <div class="weather-card-detail">
        <div class="weather-header-row">
          <span class="weather-city-name">${w.city}</span>
          <span class="weather-rain-prob">降水確率: ${w.pop}</span>
        </div>
        <div class="weather-ampm-container">
          <div class="ampm-box">
            <div class="ampm-label">午前 (AM)</div>
            <div class="ampm-val"><span class="weather-icon">${w.iconAm}</span> ${w.am}</div>
          </div>
          <div class="ampm-box">
            <div class="ampm-label">午後 (PM)</div>
            <div class="ampm-val"><span class="weather-icon">${w.iconPm}</span> ${w.pm}</div>
          </div>
        </div>
      </div>
    `).join('');
  }

  fetchYahooWeather();

  // --- Yahoo! News Module ---
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
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`;

    try {
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error('Network response was not ok');
      
      const xmlText = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      const items = xmlDoc.querySelectorAll('item');

      if (items && items.length > 0) {
        const parsedItems = [];
        items.forEach((item, index) => {
          if (index < 7) {
            const title = item.querySelector('title')?.textContent || 'タイトルなし';
            const link = item.querySelector('link')?.textContent || 'https://news.yahoo.co.jp/';
            
            const cities = Object.keys(cityCoords);
            const matchedCity = cities.find(c => title.includes(c)) || cities[Math.floor(Math.random() * cities.length)];
            
            parsedItems.push({
              title: title,
              loc: matchedCity,
              time: 'LIVE',
              link: link
            });
          }
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
    if (!container) return;

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

    container.onmouseover = (e) => {
      const item = e.target.closest('.news-item');
      if (item) highlightMapNode(item.dataset.loc, item.dataset.title);
    };

    container.onmouseout = (e) => {
      if (e.target.closest('.news-item')) hideMapPopup();
    };

    container.onclick = (e) => {
      const item = e.target.closest('.news-item');
      if (item && !e.target.classList.contains('news-link')) {
        window.open(item.dataset.link, '_blank');
      }
    };
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
    if (!coords || !popup) return;

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
    if (popup) popup.classList.remove('visible');
  }

  if (svg) {
    svg.onclick = (e) => {
      const node = e.target.closest('.city-node');
      if (node) {
        const cityName = node.dataset.city;
        highlightMapNode(cityName, `${cityName}エリアの最新情報を同期完了`);
      }
    };
  }

  fetchNews();

  // --- Background Particle Canvas ---
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
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
