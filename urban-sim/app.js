(() => {
  'use strict';

  const GRID = 28;
  const INITIAL_POPULATION = 360;
  const MAX_POPULATION = 1800;
  const TYPE_LABEL = {
    empty: '空き地', road: '道路', residential: '住宅', commercial: '商業',
    office: '職場', park: '公園', station: '駅'
  };
  const LAND_COLORS = {
    empty: '#121d2b', road: '#5c6778', residential: '#356fc7', commercial: '#c88b2e',
    office: '#8853c6', park: '#2f8b59', station: '#df5067'
  };

  const canvas = document.getElementById('cityCanvas');
  const ctx = canvas.getContext('2d');
  const els = {
    play: document.getElementById('playBtn'), reset: document.getElementById('resetBtn'),
    step: document.getElementById('stepBtn'), speed: document.getElementById('speedRange'),
    speedLabel: document.getElementById('speedLabel'), view: document.getElementById('viewMode'),
    palette: document.getElementById('toolPalette'), runState: document.getElementById('runState'),
    tooltip: document.getElementById('cellTooltip'), selectedCoord: document.getElementById('selectedCoord'),
    cellDetails: document.getElementById('cellDetails'), composition: document.getElementById('composition'),
    legend: document.getElementById('legend'), year: document.getElementById('yearStat'),
    population: document.getElementById('populationStat'), rent: document.getElementById('rentStat'),
    commute: document.getElementById('commuteStat'), satisfaction: document.getElementById('satisfactionStat'),
    vacancy: document.getElementById('vacancyStat')
  };

  let cells = [];
  let people = [];
  let year = 0;
  let selectedTool = 'residential';
  let selectedIndex = null;
  let playing = false;
  let timer = null;
  let cssWidth = 640;
  let cssHeight = 640;
  let dpr = window.devicePixelRatio || 1;

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const rand = (min, max) => min + Math.random() * (max - min);
  const indexOf = (x, y) => y * GRID + x;
  const xyOf = i => ({ x: i % GRID, y: Math.floor(i / GRID) });
  const manhattan = (a, b) => {
    if (a < 0 || b < 0) return GRID * 2;
    const p = xyOf(a), q = xyOf(b);
    return Math.abs(p.x - q.x) + Math.abs(p.y - q.y);
  };

  function makeCell(type = 'empty') {
    return {
      type,
      rent: type === 'residential' ? rand(55, 85) : 0,
      capacity: type === 'residential' ? 12 : 0,
      jobs: type === 'office' ? 28 : type === 'commercial' ? 12 : 0,
      residents: 0,
      avgSatisfaction: 50,
      demand: 0
    };
  }

  function setType(i, type) {
    const old = cells[i];
    const next = makeCell(type);
    if (type === 'residential' && old && old.type === 'residential') {
      next.rent = old.rent;
      next.residents = old.residents;
    }
    cells[i] = next;
  }

  function buildInitialCity() {
    cells = Array.from({ length: GRID * GRID }, () => makeCell('empty'));

    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const i = indexOf(x, y);
        if (x % 7 === 0 || y % 7 === 0) setType(i, 'road');
      }
    }

    for (let y = 1; y < GRID; y++) {
      for (let x = 1; x < GRID; x++) {
        const i = indexOf(x, y);
        if (cells[i].type === 'road') continue;
        const center = Math.abs(x - GRID / 2) + Math.abs(y - GRID / 2);
        const r = Math.random();
        if (center < 7 && r < 0.42) setType(i, 'office');
        else if (center < 10 && r < 0.28) setType(i, 'commercial');
        else if (r < 0.66) setType(i, 'residential');
        else if (r < 0.71) setType(i, 'park');
      }
    }

    [[7, 7], [21, 7], [14, 14], [7, 21], [21, 21]].forEach(([x, y]) => {
      setType(indexOf(x, y), 'station');
    });

    people = [];
    for (let i = 0; i < INITIAL_POPULATION; i++) {
      if (!addResident()) break;
    }
    assignAllWorkplaces();
    recalculateCellStats();
    year = 0;
    selectedIndex = null;
  }

  function residentialIndices() {
    const result = [];
    cells.forEach((c, i) => {
      if (c.type === 'residential' && c.residents < c.capacity) result.push(i);
    });
    return result;
  }

  function jobIndices() {
    const result = [];
    cells.forEach((c, i) => { if (c.jobs > 0) result.push(i); });
    return result;
  }

  function addResident() {
    if (people.length >= MAX_POPULATION) return false;
    const homes = residentialIndices();
    if (!homes.length) return false;
    const home = homes[Math.floor(Math.random() * homes.length)];
    cells[home].residents++;
    people.push({
      income: Math.round(rand(60, 175)),
      home,
      work: -1,
      satisfaction: 50,
      moved: false
    });
    return true;
  }

  function assignAllWorkplaces() {
    const jobs = jobIndices();
    if (!jobs.length) {
      people.forEach(p => { p.work = -1; });
      return;
    }
    const used = new Map();
    for (const p of people) {
      let best = -1;
      let bestDistance = Infinity;
      for (let tries = 0; tries < Math.min(18, jobs.length); tries++) {
        const candidate = jobs[Math.floor(Math.random() * jobs.length)];
        const count = used.get(candidate) || 0;
        if (count >= cells[candidate].jobs) continue;
        const d = manhattan(p.home, candidate) + Math.random() * 4;
        if (d < bestDistance) { bestDistance = d; best = candidate; }
      }
      if (best < 0) {
        const available = jobs.filter(candidate => (used.get(candidate) || 0) < cells[candidate].jobs);
        if (!available.length) {
          p.work = -1;
          continue;
        }
        best = available.reduce((nearest, candidate) =>
          manhattan(p.home, candidate) < manhattan(p.home, nearest) ? candidate : nearest
        , available[0]);
      }
      p.work = best;
      used.set(best, (used.get(best) || 0) + 1);
    }
  }

  function nearbyCount(index, type, radius) {
    const { x, y } = xyOf(index);
    let count = 0;
    for (let yy = Math.max(0, y - radius); yy <= Math.min(GRID - 1, y + radius); yy++) {
      for (let xx = Math.max(0, x - radius); xx <= Math.min(GRID - 1, x + radius); xx++) {
        if (Math.abs(xx - x) + Math.abs(yy - y) > radius) continue;
        if (cells[indexOf(xx, yy)].type === type) count++;
      }
    }
    return count;
  }

  function stationBenefit(home, work) {
    if (home < 0 || work < 0) return 0;
    const homeNear = nearbyCount(home, 'station', 3) > 0;
    const workNear = nearbyCount(work, 'station', 3) > 0;
    return homeNear && workNear ? 0.48 : homeNear || workNear ? 0.76 : 1;
  }

  function commuteDistance(home, work) {
    if (home < 0 || work < 0) return GRID * 2;
    return manhattan(home, work) * stationBenefit(home, work);
  }

  function scoreHome(person, homeIndex) {
    const c = cells[homeIndex];
    if (!c || c.type !== 'residential') return -Infinity;
    const rentBurden = c.rent / Math.max(45, person.income);
    const commute = commuteDistance(homeIndex, person.work);
    const parks = nearbyCount(homeIndex, 'park', 2);
    const stations = nearbyCount(homeIndex, 'station', 3);
    const commercial = nearbyCount(homeIndex, 'commercial', 2);
    const density = c.residents / Math.max(1, c.capacity);

    return 92
      - rentBurden * 34
      - commute * 1.9
      - Math.max(0, density - 0.8) * 12
      + Math.min(10, parks * 3.2)
      + Math.min(8, stations * 2.4)
      + Math.min(5, commercial * 1.1);
  }

  function findBetterHome(person) {
    const candidates = residentialIndices();
    if (!candidates.length) return person.home;
    let best = person.home;
    let bestScore = scoreHome(person, person.home);
    const samples = Math.min(45, candidates.length);
    for (let k = 0; k < samples; k++) {
      const i = candidates[Math.floor(Math.random() * candidates.length)];
      const s = scoreHome(person, i) - manhattan(person.home, i) * 0.12;
      if (s > bestScore) { bestScore = s; best = i; }
    }
    return best;
  }

  function repairInvalidHomes() {
    for (let i = people.length - 1; i >= 0; i--) {
      const p = people[i];
      if (p.home >= 0 && cells[p.home]?.type === 'residential') continue;
      const homes = residentialIndices();
      if (!homes.length) {
        people.splice(i, 1);
        continue;
      }
      p.home = homes[Math.floor(Math.random() * homes.length)];
      cells[p.home].residents++;
    }
  }

  function simulateYear() {
    year++;
    cells.forEach(c => { c.residents = 0; c.demand = 0; });
    people.forEach(p => { if (p.home >= 0 && cells[p.home]?.type === 'residential') cells[p.home].residents++; });
    repairInvalidHomes();
    assignAllWorkplaces();

    for (const p of people) {
      const current = scoreHome(p, p.home);
      p.satisfaction = clamp(current, 0, 100);
      p.moved = false;
      if (current < 62 || Math.random() < 0.055) {
        const target = findBetterHome(p);
        if (target !== p.home && scoreHome(p, target) > current + 4) {
          cells[p.home].residents--;
          cells[target].residents++;
          cells[target].demand++;
          p.home = target;
          p.moved = true;
          p.satisfaction = clamp(scoreHome(p, target), 0, 100);
        }
      }
    }

    for (const c of cells) {
      if (c.type !== 'residential') continue;
      const occupancy = c.residents / Math.max(1, c.capacity);
      const pressure = (occupancy - 0.68) * 0.055 + Math.min(0.025, c.demand * 0.003);
      c.rent = clamp(c.rent * (1 + pressure), 28, 240);
    }

    const avgSat = average(people.map(p => p.satisfaction));
    const vacant = residentialIndices().length > 0;
    const growth = avgSat > 70 ? 8 : avgSat > 58 ? 4 : avgSat < 42 ? -5 : 0;
    if (growth > 0 && vacant) {
      for (let i = 0; i < growth; i++) addResident();
    } else if (growth < 0) {
      for (let i = 0; i < Math.min(-growth, people.length); i++) {
        const idx = Math.floor(Math.random() * people.length);
        const [leaver] = people.splice(idx, 1);
        if (leaver && leaver.home >= 0 && cells[leaver.home]) cells[leaver.home].residents--;
      }
    }

    recalculateCellStats();
    renderAll();
  }

  function recalculateCellStats() {
    const satSum = new Array(cells.length).fill(0);
    const satCount = new Array(cells.length).fill(0);
    cells.forEach(c => { c.residents = 0; });
    for (const p of people) {
      if (p.home < 0 || !cells[p.home]) continue;
      cells[p.home].residents++;
      p.satisfaction = clamp(scoreHome(p, p.home), 0, 100);
      satSum[p.home] += p.satisfaction;
      satCount[p.home]++;
    }
    cells.forEach((c, i) => {
      c.avgSatisfaction = satCount[i] ? satSum[i] / satCount[i] : 50;
    });
  }

  function average(values) {
    if (!values.length) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  function stats() {
    const residential = cells.filter(c => c.type === 'residential');
    const capacity = residential.reduce((s, c) => s + c.capacity, 0);
    const occupied = residential.reduce((s, c) => s + c.residents, 0);
    const avgRent = average(residential.map(c => c.rent));
    const avgCommute = average(people.map(p => commuteDistance(p.home, p.work)));
    const avgSat = average(people.map(p => p.satisfaction));
    const vacancy = capacity ? (1 - occupied / capacity) * 100 : 100;
    return { capacity, occupied, avgRent, avgCommute, avgSat, vacancy };
  }

  function updateStats() {
    const s = stats();
    els.year.textContent = String(year);
    els.population.textContent = people.length.toLocaleString('ja-JP');
    els.rent.textContent = s.avgRent.toFixed(1);
    els.commute.textContent = s.avgCommute.toFixed(1);
    els.satisfaction.textContent = s.avgSat.toFixed(1);
    els.vacancy.textContent = s.vacancy.toFixed(1);
  }

  function heatColor(value, min, max, hueStart, hueEnd) {
    const t = clamp((value - min) / Math.max(0.0001, max - min), 0, 1);
    const hue = hueStart + (hueEnd - hueStart) * t;
    return `hsl(${hue} 65% 49%)`;
  }

  function cellColor(c) {
    const mode = els.view.value;
    if (mode === 'landuse') return LAND_COLORS[c.type];
    if (c.type !== 'residential') return c.type === 'road' ? '#3b4657' : '#172334';
    if (mode === 'rent') return heatColor(c.rent, 30, 180, 205, 4);
    if (mode === 'satisfaction') return heatColor(c.avgSatisfaction, 25, 90, 2, 135);
    if (mode === 'density') return heatColor(c.residents / Math.max(1, c.capacity), 0, 1, 210, 320);
    return LAND_COLORS[c.type];
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cw = cssWidth / GRID;
    const ch = cssHeight / GRID;
    ctx.save();
    ctx.scale(dpr, dpr);

    for (let y = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++) {
        const i = indexOf(x, y);
        const c = cells[i];
        const px = x * cw, py = y * ch;
        ctx.fillStyle = cellColor(c);
        ctx.fillRect(px + 0.5, py + 0.5, Math.max(0, cw - 1), Math.max(0, ch - 1));

        if (els.view.value === 'landuse' && c.type === 'station') {
          ctx.fillStyle = '#fff';
          ctx.font = `700 ${Math.max(8, cw * 0.42)}px system-ui`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('S', px + cw / 2, py + ch / 2 + 0.5);
        }
        if (els.view.value === 'landuse' && c.type === 'residential' && c.residents > 0 && cw > 12) {
          ctx.fillStyle = 'rgba(255,255,255,.76)';
          ctx.beginPath();
          ctx.arc(px + cw * .74, py + ch * .25, Math.max(1.2, cw * .07), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    if (selectedIndex !== null) {
      const { x, y } = xyOf(selectedIndex);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(x * cw + 1.5, y * ch + 1.5, Math.max(0, cw - 3), Math.max(0, ch - 3));
    }
    ctx.restore();
  }

  function updateLegend() {
    const mode = els.view.value;
    if (mode === 'landuse') {
      const types = ['residential', 'commercial', 'office', 'park', 'station', 'road', 'empty'];
      els.legend.innerHTML = types.map(t => `<span class="legend-item"><i class="legend-dot" style="background:${LAND_COLORS[t]}"></i>${TYPE_LABEL[t]}</span>`).join('');
      return;
    }
    const labels = mode === 'rent' ? ['低家賃', '高家賃'] : mode === 'satisfaction' ? ['低満足', '高満足'] : ['低密度', '高密度'];
    els.legend.innerHTML = `<span>${labels[0]}</span><span style="display:inline-block;width:90px;height:8px;border-radius:999px;background:linear-gradient(90deg,#377fc1,#d64e56)"></span><span>${labels[1]}</span>`;
  }

  function updateComposition() {
    const types = ['residential', 'commercial', 'office', 'park', 'station', 'road'];
    const usable = cells.length;
    els.composition.innerHTML = types.map(type => {
      const count = cells.filter(c => c.type === type).length;
      const pct = count / usable * 100;
      return `<div class="composition-row"><span>${TYPE_LABEL[type]}</span><div class="bar"><i style="width:${pct}%"></i></div><b>${pct.toFixed(0)}%</b></div>`;
    }).join('');
  }

  function updateSelected() {
    if (selectedIndex === null) {
      els.selectedCoord.textContent = '—';
      els.cellDetails.className = 'detail-list muted';
      els.cellDetails.textContent = 'マップ上のマスを選択してください。';
      return;
    }
    const c = cells[selectedIndex];
    const { x, y } = xyOf(selectedIndex);
    els.selectedCoord.textContent = `(${x + 1}, ${y + 1})`;
    els.cellDetails.className = 'detail-list';
    const rows = [
      ['用途', TYPE_LABEL[c.type]],
      ['居住者', `${c.residents} 人`],
      ['住宅容量', c.type === 'residential' ? `${c.capacity} 人` : '—'],
      ['家賃指数', c.type === 'residential' ? c.rent.toFixed(1) : '—'],
      ['平均満足度', c.type === 'residential' ? c.avgSatisfaction.toFixed(1) : '—'],
      ['周辺公園', `${nearbyCount(selectedIndex, 'park', 2)} 箇所`],
      ['周辺駅', `${nearbyCount(selectedIndex, 'station', 3)} 箇所`]
    ];
    els.cellDetails.innerHTML = rows.map(([a, b]) => `<div class="detail-row"><span>${a}</span><strong>${b}</strong></div>`).join('');
  }

  function renderAll() {
    updateStats();
    updateLegend();
    updateComposition();
    updateSelected();
    draw();
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    cssWidth = Math.max(280, rect.width);
    cssHeight = Math.max(280, rect.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const nextW = Math.round(cssWidth * dpr);
    const nextH = Math.round(cssHeight * dpr);
    if (canvas.width !== nextW || canvas.height !== nextH) {
      canvas.width = nextW;
      canvas.height = nextH;
    }
    draw();
  }

  function pointerCell(event) {
    const rect = canvas.getBoundingClientRect();
    const x = clamp(Math.floor((event.clientX - rect.left) / rect.width * GRID), 0, GRID - 1);
    const y = clamp(Math.floor((event.clientY - rect.top) / rect.height * GRID), 0, GRID - 1);
    return { x, y, i: indexOf(x, y), localX: event.clientX - rect.left, localY: event.clientY - rect.top };
  }

  function editCell(i) {
    const oldType = cells[i].type;
    if (oldType === selectedTool) return;
    if (oldType === 'residential') {
      people.forEach(p => { if (p.home === i) p.home = -1; });
    }
    if ((oldType === 'office' || oldType === 'commercial') && selectedTool !== oldType) {
      people.forEach(p => { if (p.work === i) p.work = -1; });
    }
    setType(i, selectedTool);
    repairInvalidHomes();
    assignAllWorkplaces();
    recalculateCellStats();
    selectedIndex = i;
    renderAll();
  }

  function setPlaying(next) {
    playing = next;
    els.play.textContent = playing ? '❚❚ 一時停止' : '▶ 再生';
    els.runState.textContent = playing ? '実行中' : '停止中';
    els.runState.classList.toggle('running', playing);
    restartTimer();
  }

  function restartTimer() {
    if (timer) clearInterval(timer);
    timer = null;
    if (!playing) return;
    const speed = Number(els.speed.value);
    const interval = Math.max(120, 900 / speed);
    timer = setInterval(simulateYear, interval);
  }

  function reset() {
    setPlaying(false);
    buildInitialCity();
    resizeCanvas();
    renderAll();
  }

  els.palette.addEventListener('click', event => {
    const button = event.target.closest('[data-tool]');
    if (!button) return;
    selectedTool = button.dataset.tool;
    els.palette.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('active', b === button));
  });
  els.play.addEventListener('click', () => setPlaying(!playing));
  els.step.addEventListener('click', simulateYear);
  els.reset.addEventListener('click', reset);
  els.view.addEventListener('change', renderAll);
  els.speed.addEventListener('input', () => {
    els.speedLabel.textContent = `${els.speed.value}×`;
    restartTimer();
  });

  canvas.addEventListener('click', event => {
    const { i } = pointerCell(event);
    editCell(i);
  });
  canvas.addEventListener('mousemove', event => {
    const p = pointerCell(event);
    const c = cells[p.i];
    els.tooltip.hidden = false;
    els.tooltip.style.left = `${p.localX}px`;
    els.tooltip.style.top = `${p.localY}px`;
    els.tooltip.innerHTML = `<strong>${TYPE_LABEL[c.type]}</strong><br>居住 ${c.residents}人${c.type === 'residential' ? `<br>家賃 ${c.rent.toFixed(1)} / 満足 ${c.avgSatisfaction.toFixed(0)}` : ''}`;
  });
  canvas.addEventListener('mouseleave', () => { els.tooltip.hidden = true; });

  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(canvas);
  } else {
    window.addEventListener('resize', resizeCanvas);
  }

  buildInitialCity();
  requestAnimationFrame(() => {
    resizeCanvas();
    renderAll();
  });
})();
