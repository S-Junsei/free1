const state = {
  day: 1,
  money: 1000,
  satisfaction: 70,
  congestion: 20,
  nsGreen: true,
  level: 1,
};

const ui = {
  day: document.getElementById('day'),
  money: document.getElementById('money'),
  satisfaction: document.getElementById('satisfaction'),
  congestion: document.getElementById('congestion'),
  nsBtn: document.getElementById('nsBtn'),
  ewBtn: document.getElementById('ewBtn'),
  tickBtn: document.getElementById('tickBtn'),
  upgradeBtn: document.getElementById('upgradeBtn'),
  eventBtn: document.getElementById('eventBtn'),
  logList: document.getElementById('logList')
};

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function log(message) {
  const li = document.createElement('li');
  li.textContent = `Day ${state.day}: ${message}`;
  ui.logList.prepend(li);
  while (ui.logList.children.length > 8) ui.logList.removeChild(ui.logList.lastChild);
}

function render() {
  ui.day.textContent = state.day;
  ui.money.textContent = state.money;
  ui.satisfaction.textContent = state.satisfaction;
  ui.congestion.textContent = state.congestion;

  ui.nsBtn.classList.toggle('active', state.nsGreen);
  ui.ewBtn.classList.toggle('active', !state.nsGreen);
  ui.nsBtn.textContent = `南北: ${state.nsGreen ? '青' : '赤'}`;
  ui.ewBtn.textContent = `東西: ${state.nsGreen ? '赤' : '青'}`;
}

function switchLight(ns) {
  state.nsGreen = ns;
  const delta = Math.floor(Math.random() * 7) + 2;
  state.congestion = clamp(state.congestion + (ns ? -delta : delta - 3), 0, 100);
  log(ns ? '南北を優先。通勤車両がスムーズに。' : '東西を優先。商業地区の流れ改善。');
  render();
}

function advanceDay() {
  state.day += 1;
  const trafficPressure = Math.floor(Math.random() * 12) + 5 - state.level * 2;
  const incidentRisk = Math.random() < state.congestion / 140;

  state.congestion = clamp(state.congestion + trafficPressure, 0, 100);
  state.money += Math.max(20, 180 - state.congestion);
  state.satisfaction = clamp(state.satisfaction + (50 - state.congestion) / 10, 0, 100);

  if (incidentRisk) {
    state.money -= 130;
    state.satisfaction -= 8;
    log('軽い事故が発生。初動対応コストが増加。');
  } else {
    log('大きなトラブルなし。都市機能は安定。');
  }

  if (state.satisfaction <= 0 || state.money < -300) {
    alert('ゲームオーバー：市民からの支持を失いました。リロードして再挑戦！');
  }

  render();
}

function upgrade() {
  if (state.money < 300) return log('資金不足で投資できません。');
  state.money -= 300;
  state.level += 1;
  state.congestion = clamp(state.congestion - 12, 0, 100);
  state.satisfaction = clamp(state.satisfaction + 5, 0, 100);
  log(`AI信号制御を導入。最適化レベル ${state.level} に向上。`);
  render();
}

function emergency() {
  if (state.money < 150) return log('予算不足で緊急対応できません。');
  state.money -= 150;
  state.congestion = clamp(state.congestion - 18, 0, 100);
  state.satisfaction = clamp(state.satisfaction + 3, 0, 100);
  log('警備員を増員し現場誘導を実施。');
  render();
}

ui.nsBtn.addEventListener('click', () => switchLight(true));
ui.ewBtn.addEventListener('click', () => switchLight(false));
ui.tickBtn.addEventListener('click', advanceDay);
ui.upgradeBtn.addEventListener('click', upgrade);
ui.eventBtn.addEventListener('click', emergency);

log('都市交通オペレーション開始。');
render();
