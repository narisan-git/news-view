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
    '札幌':   { lon: 141.3544, lat: 43.0621, t: '18°C', label: 'r' },
    '仙台':   { lon: 140.8694, lat: 38.2682, t: '21°C', label: 'r' },
    '東京':   { lon: 139.6917, lat: 35.6895, t: '24°C', label: 'r', main: true },
    '名古屋': { lon: 136.9066, lat: 35.1815, t: '25°C', label: 'u' },
    '大阪':   { lon: 135.5023, lat: 34.6937, t: '26°C', label: 'l' },
    '福岡':   { lon: 130.4017, lat: 33.5904, t: '23°C', label: 'u' },
    '那覇':   { lon: 127.6809, lat: 26.2124, t: '29°C', label: 'u', inset: true }
  };
  const cityPos = {};                       // 投影後のSVG座標 { 都市名: {x, y} }
  // dataofjapan/land から直接読み込む(自分のリポジトリに置く場合は 'japan.topojson' などの相対パスに変更)
  const MAP_DATA_URL = 'https://raw.githubusercontent.com/dataofjapan/land/master/japan.topojson';
  const LABEL = { r: [12, 4, 'start'], l: [-12, 4, 'end'], u: [0, -12, 'middle'] };

  // 新幹線の路線(主要駅の [経度, 緯度] を結ぶ)。駅を足すと形状が細かくなる
  const RAIL_LINES = [
    { name: '東北新幹線', color: '#00ffaa', pts: [   // 東京 上野 大宮 小山 宇都宮 那須塩原 新白河 郡山 福島 白石蔵王 仙台 古川 一ノ関 水沢江刺 北上 新花巻 盛岡 いわて沼宮内 二戸 八戸 七戸十和田 新青森
      [139.7671, 35.6812], [139.7774, 35.7141], [139.6230, 35.9063], [139.8057, 36.3126], [139.8986, 36.5593],
      [140.0160, 36.9627], [140.1400, 37.1200], [140.3877, 37.3977], [140.4590, 37.7543], [140.6200, 38.0050],
      [140.8825, 38.2601], [140.9500, 38.5700], [141.1375, 38.9381], [141.1700, 39.1490], [141.1190, 39.2880],
      [141.1130, 39.4340], [141.1363, 39.7016], [141.2500, 39.9530], [141.3000, 40.2700], [141.4175, 40.5125],
      [141.1900, 40.7000], [140.6933, 40.8279]] },
    { name: '東海道新幹線', color: '#4d9dff', pts: [   // 東京 品川 新横浜 小田原 熱海 三島 新富士 静岡 掛川 浜松 豊橋 三河安城 名古屋 岐阜羽島 米原 京都 新大阪
      [139.7671, 35.6812], [139.7387, 35.6285], [139.6174, 35.5071], [139.1555, 35.2563], [139.0778, 35.1039],
      [138.9109, 35.1267], [138.6638, 35.1424], [138.3889, 34.9719], [138.0140, 34.7694], [137.7347, 34.7036],
      [137.3817, 34.7627], [137.0600, 34.9697], [136.8816, 35.1709], [136.7000, 35.3156], [136.2897, 35.3141],
      [135.7585, 34.9858], [135.5006, 34.7336]] },
    { name: '山陽新幹線', color: '#ff4dd2', pts: [   // 新大阪 新神戸 西明石 姫路 相生 岡山 福山 新尾道 三原 東広島 広島 新岩国 徳山 新山口 厚狭 新下関 小倉 博多
      [135.5006, 34.7336], [135.1953, 34.7088], [134.9648, 34.6666], [134.6905, 34.8269], [134.4660, 34.8062],
      [133.9179, 34.6666], [133.3620, 34.4893], [133.2000, 34.4400], [133.0800, 34.4000], [132.7400, 34.4300],
      [132.4755, 34.3975], [132.1900, 34.1700], [131.8061, 34.0508], [131.4000, 34.0700], [131.1800, 34.0300],
      [130.9300, 34.0100], [130.8837, 33.8861], [130.4207, 33.5897]] },
    { name: '九州新幹線', color: '#ffd400', pts: [   // 博多 新鳥栖 久留米 筑後船小屋 新大牟田 新玉名 熊本 新八代 新水俣 出水 川内 鹿児島中央
      [130.4207, 33.5897], [130.5105, 33.3722], [130.5036, 33.3166], [130.4970, 33.1930], [130.4617, 33.0443],
      [130.5700, 32.9500], [130.6888, 32.7897], [130.6175, 32.4968], [130.4100, 32.2000], [130.3500, 32.0900],
      [130.2000, 31.8300], [130.5420, 31.5840]] }
  ];
  const lineDelayed = {};                   // { 路線名: 遅延中か } 交通情報の取得結果が入る
  const applyRailStatus = () => document.querySelectorAll('.rail-line').forEach(
    el => el.classList.toggle('delayed', !!lineDelayed[el.dataset.line]));

  async function drawMap() {
    const svgSel = d3.select('#japan-map-svg');
    try {
      const res = await fetch(MAP_DATA_URL);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const raw = await res.json();
      // TopoJSON(japan.topojson)ならGeoJSONへ変換。GeoJSONならそのまま使う
      const geo = raw.type === 'Topology'
        ? topojson.feature(raw, raw.objects[Object.keys(raw.objects)[0]]) : raw;

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

      // 新幹線の路線・駅・凡例
      const gr = svgSel.select('#map-rail');
      RAIL_LINES.forEach((l, i) => {
        gr.append('path').datum({ type: 'LineString', coordinates: l.pts })
          .attr('class', 'rail-line').attr('data-line', l.name).attr('stroke', l.color)
          .attr('d', d3.geoPath(pMain));
        l.pts.forEach(p => {
          const [sx, sy] = pMain(p);
          gr.append('circle').attr('class', 'rail-stn').attr('cx', sx).attr('cy', sy).attr('r', 1.4).attr('fill', l.color);
        });
        const ly = 32 + i * 14;
        gr.append('line').attr('class', 'rail-legend-line').attr('stroke', l.color)
          .attr('x1', 14).attr('x2', 32).attr('y1', ly).attr('y2', ly);
        gr.append('text').attr('class', 'rail-legend').attr('x', 38).attr('y', ly + 3).text(l.name);
      });

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
      applyRailStatus();
    } catch (e) {
      console.warn('Map load failed', e);
      svgSel.select('#map-land').append('text')
        .attr('x', 300).attr('y', 275).attr('text-anchor', 'middle')
        .attr('fill', '#ff6600').text('MAP DATA LOAD FAILED (see console)');
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

  // --- Rail Transit Module (新幹線 運行情報) ---
  // 鉄道遅延情報のJSON: 遅延・運転見合わせ中の路線だけが配列で返る(該当なし=遅延情報なし)
  const TRAIN_API = 'https://tetsudo.rti-giken.jp/free/delay.json';
  const TRAIN_REFRESH_MS = 5 * 60 * 1000;
  const shinkansenLines = [
    { name: '東北新幹線' },
    { name: '東海道新幹線' },
    { name: '山陽新幹線' },
    { name: '九州新幹線', exclude: '西九州' }   // 西九州新幹線を誤判定しない
  ];

  async function fetchDelayJson() {
    // 直接取得 → 失敗時はプロキシ経由
    const urls = [TRAIN_API, `https://api.allorigins.win/raw?url=${encodeURIComponent(TRAIN_API)}`];
    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) continue;
        const data = await res.json();
        if (Array.isArray(data)) return data;
      } catch (e) { /* 次の経路を試す */ }
    }
    return null;
  }

  const fmtTime = d => d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' });

  async function updateTraffic() {
    const list = document.getElementById('traffic-list');
    const stamp = document.getElementById('traffic-updated');
    if (!list) return;
    const delays = await fetchDelayJson();

    list.innerHTML = shinkansenLines.map(line => {
      let cls = 'status-ok', text = '遅延情報なし';
      if (!delays) {
        cls = 'status-unknown'; text = '取得不可';
      } else {
        const hit = delays.find(d => typeof d.name === 'string' && d.name.includes(line.name)
          && !(line.exclude && d.name.includes(line.exclude)));
        if (hit) {
          cls = 'status-delay';
          text = '遅延・見合わせ' + (hit.lastupdate_gmt ? ` (${fmtTime(new Date(hit.lastupdate_gmt * 1000))})` : '');
        }
      }
      lineDelayed[line.name] = (cls === 'status-delay');
      return `<div class="traffic-item"><span class="line-name">${line.name}</span><span class="${cls}">${text}</span></div>`;
    }).join('');
    applyRailStatus();

    if (stamp) stamp.textContent = delays ? `UPDATED ${fmtTime(new Date())}` : 'OFFLINE';
  }

  updateTraffic();
  setInterval(updateTraffic, TRAIN_REFRESH_MS);

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
  const coordsEl = document.getElementById('map-coords');
  const COORDS_IDLE = 'NO TARGET';
  const fmtCoords = c => `${c.lat.toFixed(4)}° N, ${c.lon.toFixed(4)}° E`;

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

    // アクティブな都市の緯度経度を表示
    if (coordsEl) coordsEl.textContent = fmtCoords(cityCoords[cityName]);
  }

  function hideMapPopup() {
    if (popup) popup.classList.remove('visible');
    if (coordsEl) coordsEl.textContent = COORDS_IDLE;
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
