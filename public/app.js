'use strict';

let access = localStorage.getItem('pp11_access') || '';
let currentQ = null;
let examQs = [];
let examAns = [];
let currentBp = null;

const $ = (id) => document.getElementById(id);

async function api(url, opt = {}) {
  const r = await fetch(url, {
    ...opt,
    headers: {
      'Content-Type': 'application/json',
      ...(access ? { Authorization: 'Bearer ' + access } : {}),
      ...(opt.headers || {})
    }
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'request_failed');
  return j;
}

function setStatus(message, ok = false) {
  const el = $('authStatus');
  if (!el) return;
  el.className = 'status ' + (ok ? 'good' : 'bad');
  el.textContent = message;
}

function go(id) {
  document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
  const page = $(id);
  if (page) page.classList.add('active');
  document.querySelectorAll('.nav button').forEach(x => x.classList.toggle('active', x.dataset.page === id));
}

async function register() {
  try {
    const name = $('name').value.trim();
    const email = $('email').value.trim();
    const password = $('password').value;
    if (!name || !email || !password) return setStatus('กรุณากรอกชื่อ อีเมล และรหัสผ่าน');
    const j = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
    access = j.access_token;
    localStorage.setItem('pp11_access', access);
    $('userBar').textContent = j.user.name + ' • ' + j.user.role;
    setStatus('สมัครและเข้าสู่ระบบสำเร็จ', true);
  } catch (e) {
    setStatus('สมัครไม่สำเร็จ: ' + e.message);
  }
}

async function login() {
  try {
    const email = $('email').value.trim();
    const password = $('password').value;
    if (!email || !password) return setStatus('กรุณากรอกอีเมลและรหัสผ่าน');
    const j = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    access = j.access_token;
    localStorage.setItem('pp11_access', access);
    $('userBar').textContent = j.user.name + ' • ' + j.user.role;
    setStatus('เข้าสู่ระบบสำเร็จ', true);
  } catch (e) {
    setStatus('เข้าสู่ระบบไม่สำเร็จ: ' + e.message);
  }
}

async function boot() {
  try {
    const s = await api('/api/subjects');
    $('subject').innerHTML = s.map(x => `<option value="${x.id}">${x.name}</option>`).join('');
    await loadTopics();
  } catch (e) {
    console.error('boot failed', e);
  }
}

async function loadTopics() {
  const subject = $('subject').value;
  const r = await api('/api/topics?subject=' + encodeURIComponent(subject));
  $('topic').innerHTML = '<option value="">ทุกหัวข้อ</option>' + r.map(x => `<option>${x.name}</option>`).join('');
}

async function loadQ() {
  try {
    const subject = $('subject').value;
    const topic = $('topic').value;
    const u = '/api/questions?subject=' + encodeURIComponent(subject) + '&topic=' + encodeURIComponent(topic) + '&limit=1';
    currentQ = (await api(u))[0];
    if (!currentQ) {
      $('quizBox').innerHTML = '<div class="bad">ไม่พบข้อสอบในหัวข้อนี้</div>';
      return;
    }
    $('quizBox').innerHTML =
      `<h3>${currentQ.question_text}</h3><p class="muted">${currentQ.topic} • ${currentQ.difficulty}</p>` +
      currentQ.options.map((o, i) =>
        `<label class="option"><input type="radio" name="qa" value="${i}">${String.fromCharCode(65 + i)}. ${o}</label>`
      ).join('') +
      `<button id="btnAnswer" class="btn primary">ตรวจคำตอบ</button><div id="res"></div>`;
  } catch (e) {
    $('quizBox').innerHTML = '<div class="bad">กรุณาเข้าสู่ระบบก่อนทำข้อสอบ</div>';
  }
}

async function answer() {
  const a = document.querySelector('input[name=qa]:checked');
  if (!a || !currentQ) return;
  const j = await api('/api/attempts', {
    method: 'POST',
    body: JSON.stringify({ question_id: currentQ.id, answer_index: Number(a.value) })
  });
  const res = $('res');
  res.className = j.correct ? 'good' : 'bad';
  res.innerHTML = (j.correct ? 'ถูกต้อง' : 'ยังไม่ถูก') + '<br>' + j.explanation;
}

async function loadBlueprints() {
  try {
    const r = await api('/api/blueprints');
    $('bpBox').innerHTML = r.map(x =>
      `<div class="item"><strong>${x.name}</strong> • ${x.total_questions} ข้อ • ${x.duration_minutes} นาที<br>` +
      `${x.rules.map(y => y.subject_name + ' ' + y.question_count).join(' | ')}<br>` +
      `<button class="btn dark start-bp" data-code="${x.code}">เริ่ม</button></div>`
    ).join('');
  } catch (e) {
    $('bpBox').innerHTML = '<div class="bad">กรุณาเข้าสู่ระบบ</div>';
  }
}

async function startBp(code) {
  const j = await api('/api/blueprints/' + encodeURIComponent(code) + '/start', { method: 'POST', body: '{}' });
  currentBp = j.blueprint;
  examQs = j.questions;
  examAns = [];
  renderExam(0);
}

function renderExam(i) {
  if (i >= examQs.length) return submitLocal();
  const q = examQs[i];
  $('examBox').innerHTML =
    `<h3>ข้อ ${i + 1}/${examQs.length}: ${q.question_text}</h3>` +
    q.options.map((o, x) =>
      `<label class="option"><input type="radio" name="ea" value="${x}">${String.fromCharCode(65 + x)}. ${o}</label>`
    ).join('') +
    `<button class="btn primary next-exam" data-index="${i}">ถัดไป</button>`;
}

async function nextExam(i) {
  const a = document.querySelector('input[name=ea]:checked');
  const ans = a ? Number(a.value) : -1;
  examAns.push({ q: examQs[i], a: ans });
  await api('/api/attempts', {
    method: 'POST',
    body: JSON.stringify({ question_id: examQs[i].id, answer_index: ans, mode: currentBp.code })
  });
  renderExam(i + 1);
}

function submitLocal() {
  $('examBox').innerHTML = '<div class="good">ทำชุดสอบครบแล้ว ระบบบันทึกผลรายข้อเรียบร้อย</div>';
}

async function loadAnalytics() {
  try {
    const d = await api('/api/analytics');
    $('anBox').innerHTML =
      `<h3>ทำทั้งหมด ${d.total.total} ข้อ • ถูก ${d.total.correct}</h3>` +
      d.by_subject.map(x =>
        `<div class="item"><strong>${x.subject_name}</strong> ${x.accuracy}% (${x.correct}/${x.total})</div>`
      ).join('');
  } catch (e) {
    $('anBox').innerHTML = '<div class="bad">กรุณาเข้าสู่ระบบ</div>';
  }
}

async function askAI() {
  try {
    const j = await api('/api/ai/tutor', {
      method: 'POST',
      body: JSON.stringify({ message: $('aiText').value })
    });
    $('aiBox').innerHTML =
      `<div class="card"><pre>${j.answer}</pre><hr><small>${j.citations.map(x => x.title + ' — ' + x.source_note).join(' • ') || 'ไม่มีแหล่งข้อมูลที่ตรง'}</small></div>`;
  } catch (e) {
    $('aiBox').innerHTML = '<div class="bad">กรุณาเข้าสู่ระบบ</div>';
  }
}

async function loadWrong() {
  try {
    const r = await api('/api/wrong-notebook');
    $('wrongBox').innerHTML = r.map(x =>
      `<div class="item"><strong>${x.subject_id} • ${x.topic}</strong><br>${x.question_text}<br>ผิด ${x.wrong_count} ครั้ง ` +
      `<button class="btn soft bookmark-btn" data-id="${x.id}">🔖 เก็บไว้</button></div>`
    ).join('') || '<p>ยังไม่มีข้อผิด</p>';
  } catch (e) {
    $('wrongBox').innerHTML = '<div class="bad">กรุณาเข้าสู่ระบบ</div>';
  }
}

async function bookmark(id) {
  await api('/api/bookmarks/' + id, { method: 'POST', body: '{}' });
  alert('บันทึกแล้ว');
}

async function loadBookmarks() {
  try {
    const r = await api('/api/bookmarks');
    $('wrongBox').innerHTML = r.map(x =>
      `<div class="item"><strong>${x.subject_id} • ${x.topic}</strong><br>${x.question_text}</div>`
    ).join('') || '<p>ยังไม่มี Bookmark</p>';
  } catch (e) {
    $('wrongBox').innerHTML = '<div class="bad">โหลด Bookmark ไม่สำเร็จ</div>';
  }
}

async function makePlan() {
  try {
    const j = await api('/api/study-plan/30-day', { method: 'POST', body: '{}' });
    renderPlan(j);
  } catch (e) {
    $('planBox').innerHTML = '<div class="bad">กรุณาเข้าสู่ระบบ</div>';
  }
}

async function loadPlan() {
  try {
    const j = await api('/api/study-plan/latest');
    if (j) renderPlan(j);
    else $('planBox').innerHTML = '<p>ยังไม่มีแผน</p>';
  } catch (e) {
    $('planBox').innerHTML = '<div class="bad">โหลดแผนไม่สำเร็จ</div>';
  }
}

function renderPlan(j) {
  const days = j.days || [];
  $('planBox').innerHTML = days.map(d =>
    `<div class="item"><strong>วันที่ ${d.day_no}</strong> • ${d.subject_id} / ${d.topic}<br>เป้าหมาย ${d.target_questions} ข้อ</div>`
  ).join('');
}

async function loadReview() {
  try {
    const r = await api('/api/admin/review-queue');
    $('reviewBox').innerHTML = r.map(x =>
      `<div class="item"><strong>${x.stable_key}</strong><br>${x.question_text}<br>` +
      `<button class="btn primary review-decision" data-id="${x.queue_id}" data-decision="published">อนุมัติ</button> ` +
      `<button class="btn soft review-decision" data-id="${x.queue_id}" data-decision="rejected">ไม่อนุมัติ</button></div>`
    ).join('') || '<p>ไม่มีคิว</p>';
  } catch (e) {
    $('reviewBox').innerHTML = '<div class="bad">เมนูนี้สำหรับ Editor/Reviewer/Admin</div>';
  }
}

async function decision(id, d) {
  await api('/api/admin/review/' + id + '/decision', {
    method: 'POST',
    body: JSON.stringify({ decision: d })
  });
  loadReview();
}

function bindEvents() {
  document.querySelectorAll('.nav button').forEach(b => {
    b.addEventListener('click', () => go(b.dataset.page));
  });

  $('btnLogin').addEventListener('click', login);
  $('btnRegister').addEventListener('click', register);
  $('btnLoadQ').addEventListener('click', loadQ);
  $('btnBlueprints').addEventListener('click', loadBlueprints);
  $('btnAnalytics').addEventListener('click', loadAnalytics);
  $('btnAI').addEventListener('click', askAI);
  $('btnWrong').addEventListener('click', loadWrong);
  $('btnBookmarks').addEventListener('click', loadBookmarks);
  $('btnMakePlan').addEventListener('click', makePlan);
  $('btnLoadPlan').addEventListener('click', loadPlan);
  $('btnReview').addEventListener('click', loadReview);
  $('subject').addEventListener('change', loadTopics);

  document.addEventListener('click', async (event) => {
    const t = event.target;
    if (!(t instanceof Element)) return;

    if (t.id === 'btnAnswer') {
      await answer();
      return;
    }
    if (t.classList.contains('start-bp')) {
      await startBp(t.dataset.code);
      return;
    }
    if (t.classList.contains('next-exam')) {
      await nextExam(Number(t.dataset.index));
      return;
    }
    if (t.classList.contains('bookmark-btn')) {
      await bookmark(t.dataset.id);
      return;
    }
    if (t.classList.contains('review-decision')) {
      await decision(t.dataset.id, t.dataset.decision);
    }
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  await boot();
});
