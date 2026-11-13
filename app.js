document.addEventListener('DOMContentLoaded', () => {
  // --- Clock Optimization ---
  const clockElement = document.getElementById('clock');
  function updateClock() {
    const now = new Date();
    clockElement.textContent = now.toTimeString().split(' ')[0] + ' JST';
  }
  setInterval(updateClock, 1000);
  updateClock();

  // --- Map (GeoJSON + D3) ---
  // 都市は緯度経度で定義。ピン位置は地図と同じ投影から自動計算される
  const cityCoords = {
    '札幌':   { lon: 141.35, lat: 43.06, t: '18°C', label: 'r' },
    '仙台':   { lon: 140.87, lat: 38.27, t: '21°C', label: 'r' },
    '東京':   { lon: 139.69, lat: 35.69, t: '24°C', label: 'r', main: true },
    '名古屋': { lon: 136.91, lat: 35.18, t: '25°C', label: 'u' },
    '大阪':   { lon: 135.50, lat: 34.69, t: '26°C', label: 'l' },
    '福岡':   { lon: 130.40, lat: 33.59, t: '23°C', label: 'u' },
    '那覇':   { lon: 127.68, lat: 26.21, t: '29°C', label: 'u', inset: true }
  };
  const cityPos = {};                       // 投影後のSVG座標 { 都市名: {x, y} }
  const MAP_DATA_URL = 'japan.geojson';     // リポジトリ直下に配置
  const LABEL = { r: [12, 4, 'start'], l: [-12, 4, 'end'], u: [0, -12, 'middle'] };

  async function drawMap() {
    const svgSel = d3.select('#japan-map-svg');
    try {
      const res = await fetch(MAP_DATA_URL);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const geo = await res.json();

      // 巻き方向が逆のポリゴン(地球全体が塗られる現象)を補正
      const fixWind = poly =>
        d3.geoArea({ type: 'Polygon', coordinates: poly }) > 2 * Math.PI
          ? poly.map(r => r.slice().reverse()) : poly;

      // 本土 / 沖縄(インセット)に分け、小笠原など遠隔島は除外
      const main = [], oki = [];
      (geo.features || []).forEach(f => {
        const g = f.geometry;
        if (!g) return;
        const polys = g.type === 'Polygon' ? [g.coordinates]
                    : g.type === 'MultiPolygon' ? g.coordinates : [];
        const m = [], o = [];
        polys.map(fixWind).forEach(p => {
          const [lon, lat] = d3.geoCentroid({ type: 'Polygon', coordinates: p });
          if (lat < 28 && lon < 135) o.push(p);
          else if (!(lat < 30 && lon > 135)) m.push(p);
        });
        const mk = c => ({ type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: c } });
        if (m.length) main.push(mk(m));
        if (o.length) oki.push(mk(o));
      });

      const pMain = d3.geoMercator().fitExtent([[20, 20], [580, 530]], { type: 'FeatureCollection', features: main });
      const pOki = oki.length
        ? d3.geoMercator().fitExtent([[448, 420], [568, 504]], { type: 'FeatureCollection', features: oki }) : null;

      svgSel.select('#map-land').selectAll('path').data(main).join('path')
        .attr('class', 'land-mass').attr('d', d3.geoPath(pMain));
      if (pOki) {
        svgSel.select('#map-inset').selectAll('path').data(oki).join('path')
          .attr('class', 'land-mass').attr('d', d3.geoPath(pOki));
      }

      const gc = svgSel.select('#map-cities');
      Object.entries(cityCoords).forEach(([name, c]) => {
        const proj = c.inset ? pOki : pMain;
        if (!proj) return;
        const [x, y] = proj([c.lon, c.lat]);
        cityPos[name] = { x, y };
        const [dx, dy, anchor] = LABEL[c.label];
        const g = gc.append('g').attr('class', 'city-node').attr('data-city', name)
          .attr('transform', `translate(${x},${y})`);
        g.append('circle').attr('class', 'pulse-ring').attr('r', 10);
        g.append('circle').attr('class', 'pin').attr('r', c.main ? 5 : 4)
          .style('fill', c.main ? 'var(--arc-orange)' : null);
        g.append('text').attr('x', dx).attr('y', dy).attr('text-anchor', anchor)
          .style('fill', c.main ? 'var(--arc-orange)' : null)
          .style('font-weight', c.main ? 'bold' : null)
          .text(`${name} [${c.t}]`);
      });
    } catch (e) {
      console.warn('Map load failed', e);
      svgSel.select('#map-land').append('text')
        .attr('x', 300).attr('y', 275).attr('text-anchor', 'middle')
        .attr('fill', '#ff6600').text('MAP DATA NOT FOUND: ' + MAP_DATA_URL);
    }
  }
  drawMap();
  

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
    const p = cityPos[cityName];
    if (!p || !popup) return;

    popupTitle.textContent = `TARGET: ${cityName}`;
    popupDesc.textContent = text;

    // viewBox座標 → 画面座標(縦横比の余白も考慮)
    const pt = svg.createSVGPoint();
    pt.x = p.x; pt.y = p.y;
    const s = pt.matrixTransform(svg.getScreenCTM());
    const containerRect = mapContainer.getBoundingClientRect();

    popup.style.left = `${s.x - containerRect.left}px`;
    popup.style.top = `${s.y - containerRect.top}px`;
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
