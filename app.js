const initialState = () => ({
  day: 1,
  money: 1200,
  satisfaction: 78,
  congestion: 25,
  nsGreen: true,
  level: 1,
  autoMode: false,
  demand: { commute: 55, commerce: 48, eventLoad: 22 }
});

const state = initialState();

const ui = {
  day: document.getElementById('day'), money: document.getElementById('money'),
  satisfaction: document.getElementById('satisfaction'), congestion: document.getElementById('congestion'),
  risk: document.getElementById('risk'), mode: document.getElementById('mode'),
  nsBtn: document.getElementById('nsBtn'), ewBtn: document.getElementById('ewBtn'),
  tickBtn: document.getElementById('tickBtn'), upgradeBtn: document.getElementById('upgradeBtn'),
  eventBtn: document.getElementById('eventBtn'), autoBtn: document.getElementById('autoBtn'),
  resetBtn: document.getElementById('resetBtn'), logList: document.getElementById('logList'),
  commute: document.getElementById('commute'), commerce: document.getElementById('commerce'), eventLoad: document.getElementById('eventLoad')
};

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const rand = (n) => Math.floor(Math.random() * n);

function riskLabel(c) { return c < 30 ? '低' : c < 65 ? '中' : '高'; }

function log(message) {
  const li = document.createElement('li');
  li.textContent = `Day ${state.day}: ${message}`;
  ui.logList.prepend(li);
  while (ui.logList.children.length > 12) ui.logList.lastChild.remove();
}

function render() {
  ui.day.textContent = state.day;
  ui.money.textContent = state.money.toLocaleString();
  ui.satisfaction.textContent = Math.round(state.satisfaction);
  ui.congestion.textContent = Math.round(state.congestion);
  ui.risk.textContent = riskLabel(state.congestion);
  ui.mode.textContent = state.autoMode ? '自動' : '手動';
  ui.nsBtn.classList.toggle('active', state.nsGreen);
  ui.ewBtn.classList.toggle('active', !state.nsGreen);
  ui.nsBtn.textContent = `南北: ${state.nsGreen ? '青' : '赤'}`;
  ui.ewBtn.textContent = `東西: ${state.nsGreen ? '赤' : '青'}`;
  ui.autoBtn.textContent = `AI自動制御を${state.autoMode ? 'OFF' : 'ON'}`;
}

function switchLight(ns) {
  state.nsGreen = ns;
  const easing = 2 + state.level;
  state.congestion = clamp(state.congestion + (ns ? -easing : -easing + rand(4)), 0, 100);
  log(ns ? '南北優先に切り替え。' : '東西優先に切り替え。');
  render();
}

function applyDemand() {
  state.demand.commute = Number(ui.commute.value);
  state.demand.commerce = Number(ui.commerce.value);
  state.demand.eventLoad = Number(ui.eventLoad.value);
}

function autoControl() {
  const pressureNS = state.demand.commute + rand(10);
  const pressureEW = state.demand.commerce + state.demand.eventLoad / 2 + rand(10);
  state.nsGreen = pressureNS >= pressureEW;
}

function advanceDay() {
  applyDemand();
  state.day += 1;
  if (state.autoMode) autoControl();

  const demandPressure = (state.demand.commute * 0.35 + state.demand.commerce * 0.35 + state.demand.eventLoad * 0.4) / 10;
  const signalBonus = state.nsGreen ? 2 : 1;
  const infraBonus = state.level * 1.5;

  state.congestion = clamp(state.congestion + demandPressure - signalBonus - infraBonus + rand(4), 0, 100);
  const profit = Math.round(220 - state.congestion * 1.7 + state.level * 12);
  state.money += profit;
  state.satisfaction = clamp(state.satisfaction + (55 - state.congestion) / 11 + (profit > 0 ? 1 : -1), 0, 100);

  const incidentChance = (state.congestion + state.demand.eventLoad * 0.4) / 180;
  if (Math.random() < incidentChance) {
    const loss = 140 + rand(70);
    state.money -= loss;
    state.satisfaction -= 6;
    log(`事故対応発生。コスト -${loss}。`);
  } else {
    log(`安定運用。収益 ${profit >= 0 ? '+' : ''}${profit}。`);
  }

  if (state.satisfaction <= 0 || state.money < -500) {
    log('運営破綻。リスタート推奨。');
    state.autoMode = false;
  }

  render();
}

function upgrade() {
  if (state.money < 300) return log('予算不足で投資できません。');
  state.money -= 300;
  state.level += 1;
  state.congestion = clamp(state.congestion - 10, 0, 100);
  state.satisfaction = clamp(state.satisfaction + 4, 0, 100);
  log(`信号最適化レベル ${state.level} へ更新。`);
  render();
}

function emergency() {
  if (state.money < 160) return log('予算不足で緊急対応できません。');
  state.money -= 160;
  state.congestion = clamp(state.congestion - 17, 0, 100);
  state.satisfaction = clamp(state.satisfaction + 3, 0, 100);
  log('緊急誘導実施。渋滞を即時軽減。');
  render();
}

function reset() {
  Object.assign(state, initialState());
  ui.commute.value = state.demand.commute;
  ui.commerce.value = state.demand.commerce;
  ui.eventLoad.value = state.demand.eventLoad;
  ui.logList.innerHTML = '';
  log('新規セッションを開始。');
  render();
}

ui.nsBtn.addEventListener('click', () => switchLight(true));
ui.ewBtn.addEventListener('click', () => switchLight(false));
ui.tickBtn.addEventListener('click', advanceDay);
ui.upgradeBtn.addEventListener('click', upgrade);
ui.eventBtn.addEventListener('click', emergency);
ui.autoBtn.addEventListener('click', () => { state.autoMode = !state.autoMode; log(`AI自動制御を${state.autoMode ? '有効化' : '無効化'}。`); render(); });
ui.resetBtn.addEventListener('click', reset);

log('都市交通オペレーション開始。');
render();
