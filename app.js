(function () {
'use strict';

/* ---------- الإعدادات والبيانات ---------- */
var KEY = {exp:'moto-expenses-v1', km:'moto-km-v1', hid:'moto-hidden-v1', theme:'moto-theme-v1', bg:'moto-bg-v1'};
var CATS = [['بنزين','⛽'],['صيانة','🔧'],['كاوتش','🛞'],['زيت','🛢️'],['قطع غيار','⚙️'],['غسيل','🧼'],['ترخيص / تأمين','📄'],['أخرى','📦']];
var NAMES = CATS.map(function (c) { return c[0]; });
var PERIOD = {w:'هذا الأسبوع', m:'هذا الشهر', a:'كل المصاريف'};

function $(id) { return document.getElementById(id); }
function read(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
function readRaw(k, d) { try { return localStorage.getItem(k) || d; } catch (e) { return d; } }
function writeRaw(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); return true; } catch (e) { return false; } }

var exp = read(KEY.exp, []), km = read(KEY.km, []), hid = read(KEY.hid, []);
if (!Array.isArray(exp)) exp = [];
if (!Array.isArray(km)) km = [];
if (!Array.isArray(hid)) hid = [];
exp.forEach(function (x) { if (NAMES.indexOf(x.cat) < 0) x.cat = 'أخرى'; });

var theme = readRaw(KEY.theme, 'auto'), bg = readRaw(KEY.bg, '');
var per = 'w', cur = null, editing = false, tripsCache = null;

/* ---------- أدوات مساعدة ---------- */
var ESC = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); }
function fmt(n) { return Math.round(n * 100) / 100; }
function ymd(d) { var m = d.getMonth() + 1, day = d.getDate(); return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day; }
function today() { return ymd(new Date()); }

/* حدود الفترة كنصوص YYYY-MM-DD (مقارنة أسرع من كائنات Date). الأسبوع يبدأ السبت */
function range() {
  if (per === 'a') return null;
  var n = new Date(); n.setHours(0, 0, 0, 0);
  if (per === 'm') return [ymd(new Date(n.getFullYear(), n.getMonth(), 1)), ymd(new Date(n.getFullYear(), n.getMonth() + 1, 1))];
  var s = new Date(n); s.setDate(n.getDate() - ((n.getDay() + 1) % 7));
  var e = new Date(s); e.setDate(s.getDate() + 7);
  return [ymd(s), ymd(e)];
}
function inR(r, d) { return !r || (d >= r[0] && d < r[1]); }

/* المسافة = الفرق بين كل قراءة عداد والتي قبلها (مخزّنة مؤقتاً لحد ما تتغير البيانات) */
function trips() {
  if (tripsCache) return tripsCache;
  var s = km.map(function (x) { return {id:x.id, odo:x.odo, date:x.date, trip:0}; })
            .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id; });
  for (var i = 1; i < s.length; i++) s[i].trip = Math.max(0, s[i].odo - s[i - 1].odo);
  return (tripsCache = s);
}
function kmIn(r) { return trips().reduce(function (t, x) { return inR(r, x.date) ? t + x.trip : t; }, 0); }

/* ---------- العرض ---------- */
function card(id, icon, name, amount, sub, wide) {
  var h = hid.indexOf(id) >= 0, cls = 'card' + (wide ? ' wide' : '');
  if (editing) {
    return '<label class="' + cls + '"' + (h ? ' style="opacity:.5"' : '') + '><span class="e">' + icon + '</span><span class="nm">' + esc(name) +
      '</span><small><input type="checkbox" data-c="tog" data-v="' + esc(id) + '"' + (h ? '' : ' checked') + '> ظاهر في الرئيسية</small></label>';
  }
  if (h) return '';
  return '<button class="' + cls + '" data-a="open" data-v="' + esc(id) + '"><span class="e">' + icon + '</span><span class="nm">' + esc(name) +
    '</span><span class="am">' + amount + '</span><small>' + sub + '</small></button>';
}

function renderHome() {
  var r = range(), tot = 0, sums = {}, cnt = {};
  exp.forEach(function (x) {
    if (!inR(r, x.date)) return;
    tot += x.amt; sums[x.cat] = (sums[x.cat] || 0) + x.amt; cnt[x.cat] = (cnt[x.cat] || 0) + 1;
  });
  var k = kmIn(r);
  $('plabel').textContent = 'إجمالي ' + PERIOD[per];
  $('sum').textContent = fmt(tot) + ' جنيه';
  $('cpk').textContent = k > 0 ? 'تكلفة الكيلو: ' + fmt(tot / k) + ' جنيه • المسافة: ' + fmt(k) + ' كم' : '';
  var html = card('km', '🛣️', 'المسافة', fmt(k) + ' كم', 'سجّل قراءة العداد وهنحسب المسافة', true);
  CATS.forEach(function (c) { html += card(c[0], c[1], c[0], fmt(sums[c[0]] || 0) + ' جنيه', (cnt[c[0]] || 0) + ' عملية'); });
  if (editing) html += '<small class="note">الإخفاء بيشيل الكارت من الرئيسية بس، والبيانات محفوظة.</small>';
  $('grid').innerHTML = html;
  ['w', 'm', 'a'].forEach(function (p) { $('t' + p).classList.toggle('on', p === per); });
}

function item(act, id, date, sub, amt) {
  return '<div class="item"><div>' + esc(date) + '<small>' + sub + '</small></div><div>' +
    (amt ? '<span class="amt">' + amt + '</span>' : '') +
    '<button data-a="' + act + '" data-id="' + id + '" aria-label="حذف">✕</button></div></div>';
}

function renderDetail() {
  var r = range(), isKm = cur === 'km', html = '', total = 0;
  $('dtitle').textContent = isKm ? '🛣️ المسافة' : CATS[NAMES.indexOf(cur)][1] + ' ' + cur;
  $('amt').placeholder = isKm ? 'قراءة العداد الحالية (كم)' : 'المبلغ';
  $('note').hidden = isKm;
  if (isKm) {
    var t = trips();
    total = kmIn(r);
    for (var i = t.length - 1; i >= 0; i--) {
      html += item('delkm', t[i].id, t[i].date, 'قراءة العداد: ' + fmt(t[i].odo) + ' كم' + (t[i].trip ? ' • مشيت ' + fmt(t[i].trip) + ' كم' : ' • قراءة البداية'), '');
    }
    if (!html) html = '<div class="empty">اكتب أول قراءة للعداد</div>';
  } else {
    var rows = exp.filter(function (x) { return x.cat === cur; })
                  .sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id; });
    rows.forEach(function (x) {
      if (inR(r, x.date)) total += x.amt;
      html += item('del', x.id, x.date, esc(x.note || ''), fmt(x.amt) + ' جنيه');
    });
    if (!html) html = '<div class="empty">لا توجد مصاريف لـ' + esc(cur) + ' لسه</div>';
  }
  $('dlabel').textContent = (isKm ? 'المسافة ' : 'إجمالي ') + PERIOD[per];
  $('dsum').textContent = fmt(total) + (isKm ? ' كم' : ' جنيه');
  $('list').innerHTML = html;
}

function render() { if (cur) renderDetail(); else renderHome(); }

function show(c) {
  cur = c;
  $('home').hidden = !!c;
  $('detail').hidden = !c;
  if (c) $('dt').value = today();
  render();
  window.scrollTo(0, 0);
}

function toggleEdit() {
  editing = !editing;
  $('opts').hidden = !editing;
  $('editbtn').textContent = editing ? 'تم ✓' : '⚙️ تعديل';
  renderHome();
}

/* ---------- الشكل: وضع نهاري/ليلي وخلفية ---------- */
function applyLook() {
  var r = document.documentElement;
  if (theme === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', theme);
  $('bg').style.backgroundImage = bg ? 'url("' + bg + '")' : 'none';
  document.body.classList.toggle('hasbg', !!bg);
  ['auto', 'light', 'dark'].forEach(function (k) { $('th-' + k).classList.toggle('on', k === theme); });
}
function setTheme(t) { theme = t; writeRaw(KEY.theme, t); applyLook(); }
function setBg(d) {
  bg = d;
  if (!writeRaw(KEY.bg, d) && d) alert('تعذّر حفظ الصورة، جرّب صورة تانية');
  applyLook();
}
function pickBg(inp) {
  var f = inp.files[0];
  if (!f) return;
  var rd = new FileReader();
  rd.onload = function () {
    var im = new Image();
    im.onload = function () {
      var s = Math.min(1, 1000 / Math.max(im.width, im.height)), c = document.createElement('canvas');
      c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      setBg(c.toDataURL('image/jpeg', 0.75));
    };
    im.src = rd.result;
  };
  rd.readAsDataURL(f);
  inp.value = '';
}

/* ---------- الأحداث (مستمع واحد لكل نوع بدل onclick في كل عنصر) ---------- */
document.addEventListener('click', function (e) {
  var t = e.target.closest('[data-a]');
  if (!t) return;
  var a = t.dataset.a, v = t.dataset.v, id = +t.dataset.id;
  if (a === 'per') { per = v; render(); }
  else if (a === 'open') show(v);
  else if (a === 'back') show(null);
  else if (a === 'edit') toggleEdit();
  else if (a === 'reload') location.reload();
  else if (a === 'theme') setTheme(v);
  else if (a === 'clearbg') setBg('');
  else if (a === 'del') { exp = exp.filter(function (x) { return x.id !== id; }); write(KEY.exp, exp); render(); }
  else if (a === 'delkm') { km = km.filter(function (x) { return x.id !== id; }); tripsCache = null; write(KEY.km, km); render(); }
});

document.addEventListener('change', function (e) {
  var t = e.target, c = t.dataset.c;
  if (c === 'tog') {
    var i = hid.indexOf(t.dataset.v);
    if (i < 0) hid.push(t.dataset.v); else hid.splice(i, 1);
    write(KEY.hid, hid);
    renderHome();
  } else if (c === 'bg') pickBg(t);
});

$('form').addEventListener('submit', function (e) {
  e.preventDefault();
  var a = parseFloat($('amt').value);
  if (!(a > 0)) return;
  var d = $('dt').value || today();
  if (cur === 'km') {
    km.push({id: Date.now(), odo: a, date: d}); tripsCache = null; write(KEY.km, km);
  } else {
    exp.push({id: Date.now(), cat: cur, amt: a, date: d, note: $('note').value.trim()}); write(KEY.exp, exp);
    $('note').value = '';
  }
  $('amt').value = '';
  render();
});

/* ---------- تشغيل ---------- */
applyLook();
render();

if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  var hadSW = !!navigator.serviceWorker.controller;
  /* لما تتنزل نسخة جديدة وتتفعّل، نظهر شريط التحديث */
  navigator.serviceWorker.addEventListener('controllerchange', function () { if (hadSW) $('upd').hidden = false; });
  window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
}
})();
