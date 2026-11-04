/* RunescapeOS app logic. Game rules (XP table, difficulty keys, combat level, ranks) are near the top. */
(function () {
  'use strict';
  var KEY = 'runescapeos:v1', TABKEY = 'runescapeos:tab';

  /* ---------- pure game logic ---------- */
  var XP = (function () {
    var t = new Array(100).fill(0), pts = 0;
    for (var n = 1; n < 99; n++) { pts += Math.floor(n + 300 * Math.pow(2, n / 7)); t[n + 1] = Math.floor(pts / 4); }
    return t;
  })();
  function levelForXp(xp) { for (var l = 99; l >= 1; l--) { if (xp >= XP[l]) return l; } return 1; }
  function progressFor(xp) { var l = levelForXp(xp); return l >= 99 ? 1 : (xp - XP[l]) / (XP[l + 1] - XP[l]); }
  function toNext(xp) { var l = levelForXp(xp); return l >= 99 ? 0 : XP[l + 1] - xp; }
  function combatLevel(lv) {
    var g = function (n) { return lv[n] || 1; };
    var base = 0.25 * (g('Defence') + g('Hitpoints') + Math.floor(g('Prayer') / 2));
    var melee = 0.325 * (g('Attack') + g('Strength'));
    var range = 0.325 * Math.floor(g('Ranged') * 1.5);
    var mage = 0.325 * Math.floor(g('Magic') * 1.5);
    return Math.floor(base + Math.max(melee, range, mage));
  }
  function rankFor(total) {
    if (total >= 2200) return 'Legend'; if (total >= 1900) return 'Master'; if (total >= 1500) return 'Expert';
    if (total >= 1000) return 'Adept'; if (total >= 500) return 'Apprentice'; if (total >= 100) return 'Novice';
    return 'Newcomer';
  }

  var SKILLS = [['Attack','combat'],['Hitpoints','combat'],['Mining','gathering'],['Strength','combat'],['Agility','support'],['Smithing','artisan'],['Defence','combat'],['Herblore','artisan'],['Fishing','gathering'],['Ranged','combat'],['Thieving','support'],['Cooking','artisan'],['Prayer','support'],['Crafting','artisan'],['Firemaking','artisan'],['Magic','combat'],['Fletching','artisan'],['Woodcutting','gathering'],['Runecraft','artisan'],['Slayer','combat'],['Farming','gathering'],['Construction','artisan'],['Hunter','gathering']]
    .map(function (a) { return { name: a[0], cat: a[1] }; });
  var SKILL_BY = {}; SKILLS.forEach(function (k) { SKILL_BY[k.name] = k; });
  var CAT_LABEL = { combat: 'Combat', gathering: 'Gathering', artisan: 'Artisan', support: 'Support' };
  var MAX_TOTAL = 2277;

  var TASK_DIFF = { easy: { label: 'Easy', xp: 15 }, medium: { label: 'Medium', xp: 35 }, hard: { label: 'Hard', xp: 60 }, elite: { label: 'Elite', xp: 100 } };
  var QUEST_DIFF = { novice: { label: 'Novice', xp: 150, qp: 1 }, intermediate: { label: 'Intermediate', xp: 350, qp: 2 }, experienced: { label: 'Experienced', xp: 600, qp: 3 }, master: { label: 'Master', xp: 1000, qp: 5 } };
  var BOSS_DIFF = { easy: { label: 'Easy', xp: 150 }, medium: { label: 'Medium', xp: 250 }, hard: { label: 'Hard', xp: 500 }, nightmare: { label: 'Nightmare', xp: 1000 } };
  function tier(map, key) { return Object.keys(map).indexOf(key); }

  var SEED_TASKS = [
    ['Attack','Do a HIIT workout','medium'],['Attack','Practice a sport or martial art','medium'],
    ['Strength','Lift weights or do a strength workout','hard'],['Strength','Do 20 push-ups','medium'],
    ['Defence','Do a stretching or mobility routine','medium'],['Defence','Meditate for 10 minutes','medium'],
    ['Ranged','Go for a run','medium'],['Ranged','Practice a target hobby (darts, golf, archery)','medium'],
    ['Magic','Read for 30 minutes','medium'],['Magic','Learn something new online','medium'],
    ['Hitpoints','Drink 8 glasses of water','easy'],['Hitpoints','Get 8 hours of sleep','medium'],
    ['Slayer','Tackle a task you have been avoiding','hard'],['Slayer','Clear out your inbox','medium'],
    ['Mining','Do a 60-minute deep work session','hard'],['Mining','Organize your files or desktop','easy'],
    ['Fishing','Spend 20 minutes outside in nature','easy'],['Fishing','Practice a patient hobby (chess, puzzles)','medium'],
    ['Woodcutting','Do yardwork or declutter a space','medium'],['Woodcutting','Chop veggies for a home-cooked meal','easy'],
    ['Farming','Water or tend a plant','easy'],['Farming','Meal prep with fresh ingredients','medium'],
    ['Hunter','Research something you have been meaning to look into','medium'],['Hunter','Explore somewhere new nearby','medium'],
    ['Smithing','Fix or build something (DIY, repair)','hard'],['Smithing','Learn to use a new tool','medium'],
    ['Cooking','Cook a homemade meal','medium'],['Cooking','Meal prep for the week','hard'],
    ['Firemaking','Have a cozy night in','easy'],['Firemaking','Start a new habit or project','medium'],
    ['Crafting','Work on a creative project','hard'],['Crafting','Organize or decorate a space','medium'],
    ['Fletching','Prep tools or supplies for a project','easy'],['Fletching','Practice a hands-on skill','medium'],
    ['Herblore','Take your vitamins','easy'],['Herblore','Try a new healthy recipe','medium'],
    ['Runecraft','Journal your thoughts','medium'],['Runecraft','Do a creative writing exercise','medium'],
    ['Construction','Do a home improvement task','hard'],['Construction','Organize a drawer or closet','medium'],
    ['Prayer','Meditate or pray','medium'],['Prayer','Practice gratitude journaling','easy'],
    ['Agility','Go for a 20-minute walk or jog','medium'],['Agility','Do a mobility or flexibility routine','medium'],
    ['Thieving','Negotiate a better price on something','medium'],['Thieving','Find a deal or coupon before buying','easy']
  ];

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function defaultState() {
    return {
      v: 1, updatedAt: 0,
      profile: { name: 'Sean', bio: '', cls: 'Adventurer', last: null, streak: 0 },
      bonus: {},
      tasks: SEED_TASKS.map(function (a, i) { return { id: 't' + i, skill: a[0], title: a[1], diff: a[2], done: false, tally: 0 }; }),
      quests: [
        { id: 'q0', title: 'Run a 5K', desc: 'Train up to running a full 5K without stopping.', skill: 'Agility', diff: 'intermediate', status: 'todo' },
        { id: 'q1', title: 'Build a $1,000 emergency fund', desc: 'Set aside savings for a rainy day.', skill: 'Thieving', diff: 'experienced', status: 'todo' }
      ],
      bosses: [
        { id: 'b0', title: 'The Procrastination Dragon', desc: 'That one big task you keep putting off. Break it into chunks; each work session is a hit.', skill: 'Slayer', diff: 'hard', hp: 10, left: 10, xp: 500 },
        { id: 'b1', title: 'Mount Overwhelm', desc: 'A goal so big it feels impossible. List every sub-step as HP and knock them out one at a time.', skill: 'Mining', diff: 'nightmare', hp: 20, left: 20, xp: 1000 },
        { id: 'b2', title: 'The Comfort Zone Cerberus', desc: 'Three heads: fear, doubt and inertia. Each time you do the uncomfortable thing anyway, land a hit.', skill: 'Defence', diff: 'medium', hp: 5, left: 5, xp: 250 }
      ]
    };
  }

  function int(n, lo, hi, dflt) { n = Math.floor(Number(n)); if (!isFinite(n)) return dflt; return Math.min(hi, Math.max(lo, n)); }
  function str(s, max, dflt) { return typeof s === 'string' ? s.slice(0, max) : dflt; }
  function normalize(raw) {
    var d = defaultState();
    if (!raw || typeof raw !== 'object') return d;
    var s = { v: 1, updatedAt: Number(raw.updatedAt) || 0 };
    var p = raw.profile || {};
    s.profile = {
      name: str(p.name, 40, d.profile.name) || d.profile.name, bio: str(p.bio, 200, ''), cls: str(p.cls, 20, 'Adventurer') || 'Adventurer',
      last: typeof p.last === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.last) ? p.last : null, streak: int(p.streak, 0, 100000, 0)
    };
    s.bonus = {};
    if (raw.bonus && typeof raw.bonus === 'object') SKILLS.forEach(function (k) { var v = int(raw.bonus[k.name], 0, 1e9, 0); if (v) s.bonus[k.name] = v; });
    s.tasks = Array.isArray(raw.tasks) ? raw.tasks.filter(function (t) { return t && SKILL_BY[t.skill] && TASK_DIFF[t.diff] && typeof t.title === 'string'; }).map(function (t) {
      return { id: str(t.id, 40, '') || uid(), skill: t.skill, title: t.title.slice(0, 80), diff: t.diff, done: !!t.done, tally: int(t.tally, 0, 1e6, 0) };
    }) : d.tasks;
    s.quests = Array.isArray(raw.quests) ? raw.quests.filter(function (q) { return q && QUEST_DIFF[q.diff] && typeof q.title === 'string'; }).map(function (q) {
      return { id: str(q.id, 40, '') || uid(), title: q.title.slice(0, 80), desc: str(q.desc, 200, ''), skill: SKILL_BY[q.skill] ? q.skill : '', diff: q.diff, status: ['todo', 'active', 'done'].indexOf(q.status) >= 0 ? q.status : 'todo' };
    }) : d.quests;
    s.bosses = Array.isArray(raw.bosses) ? raw.bosses.filter(function (b) { return b && BOSS_DIFF[b.diff] && typeof b.title === 'string'; }).map(function (b) {
      var hp = int(b.hp, 1, 500, 10);
      return { id: str(b.id, 40, '') || uid(), title: b.title.slice(0, 80), desc: str(b.desc, 200, ''), skill: SKILL_BY[b.skill] ? b.skill : '', diff: b.diff, hp: hp, left: int(b.left, 0, hp, hp), xp: int(b.xp, 0, 1e6, BOSS_DIFF[b.diff].xp) };
    }) : d.bosses;
    return s;
  }

  function taskEarned(t) { var xp = TASK_DIFF[t.diff].xp; return (t.done ? xp : 0) + xp * t.tally; }
  function derive(s) {
    var per = {}, levels = {}, totalLevel = 0, totalXp = 0, capes = 0, qp = 0;
    SKILLS.forEach(function (k) { per[k.name] = { bonus: s.bonus[k.name] || 0, tasks: 0, quests: 0, bosses: 0 }; });
    s.tasks.forEach(function (t) { if (per[t.skill]) per[t.skill].tasks += taskEarned(t); });
    s.quests.forEach(function (q) {
      if (q.status !== 'done') return;
      qp += QUEST_DIFF[q.diff].qp;
      if (per[q.skill]) per[q.skill].quests += QUEST_DIFF[q.diff].xp;
    });
    s.bosses.forEach(function (b) { if (b.left <= 0 && per[b.skill]) per[b.skill].bosses += b.xp; });
    SKILLS.forEach(function (k) {
      var p = per[k.name];
      p.total = p.bonus + p.tasks + p.quests + p.bosses;
      p.level = levelForXp(p.total); p.progress = progressFor(p.total); p.toNext = toNext(p.total);
      levels[k.name] = p.level; totalLevel += p.level; totalXp += p.total; if (p.level >= 99) capes++;
    });
    return { per: per, totalLevel: totalLevel, totalXp: totalXp, capes: capes, qp: qp, combat: combatLevel(levels), rank: rankFor(totalLevel) };
  }

  /* ---------- storage ---------- */
  function loadLocal() {
    try { var t = localStorage.getItem(KEY); if (t) return normalize(JSON.parse(t)); } catch (e) {}
    return defaultState();
  }
  function saveLocal() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  var state = loadLocal();
  var D = derive(state);

  /* ---------- helpers ---------- */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var view = $('#view');
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return Number(n).toLocaleString('en-US'); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function today() { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dayGap(a, b) { var p = function (s) { var x = s.split('-'); return Date.UTC(+x[0], +x[1] - 1, +x[2]); }; return Math.round((p(b) - p(a)) / 864e5); }
  function skillOpts(sel, withNone) {
    return (withNone ? '<option value="">No skill (quest points only)</option>' : '') +
      SKILLS.slice().sort(function (a, b) { return a.name < b.name ? -1 : 1; }).map(function (k) { return '<option value="' + k.name + '"' + (k.name === sel ? ' selected' : '') + '>' + k.name + '</option>'; }).join('');
  }
  function diffOpts(map, sel, withXp) {
    return Object.keys(map).map(function (k) { return '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + map[k].label + ' (' + fmt(map[k].xp) + ' XP' + (map[k].qp ? ', ' + map[k].qp + ' QP' : '') + ')</option>'; }).join('');
  }
  function chip(map, key) { return '<span class="chip t' + tier(map, key) + '">' + map[key].label + '</span>'; }

  var toastT;
  function toast(msg) { var t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('show'); }, 2600); }

  /* ---------- sync ---------- */
  var remote = null, dlCap = null, syncState = 'local', saving = false, dirty = false, rt = null, reconciled = false, loadTimer = null;
  var SYNC_TEXT = {
    local: 'Saved on this device. Save a backup file now and then.',
    connecting: 'Connecting to your Claude account...',
    synced: 'Synced to your Claude account.',
    saving: 'Saving...',
    slow: 'Cannot reach your account yet. Changes stay on this device.',
    error: 'Could not save to your account. Changes stay on this device.'
  };
  function setSync(s) {
    syncState = s;
    var el = $('#sync-line');
    if (el) { el.textContent = SYNC_TEXT[s]; el.className = 'sync' + (s === 'slow' || s === 'error' ? ' warn' : ''); }
  }
  function scheduleRemote() { if (!remote) return; clearTimeout(rt); rt = setTimeout(flushRemote, 700); }
  function flushRemote() {
    if (!remote) return;
    if (saving) { dirty = true; return; }
    saving = true; dirty = false; setSync('saving');
    var stamp = state.updatedAt;
    remote.set({ updatedAt: stamp, state: JSON.parse(JSON.stringify(state)) }).then(function () {
      setSync('synced');
    }, function () { setSync('error'); }).then(function () {
      saving = false;
      if (dirty || state.updatedAt !== stamp) scheduleRemote();
    });
  }
  function onRemote(snap) {
    clearTimeout(loadTimer);
    if (snap.metadata && snap.metadata.hasPendingWrites) return;
    var d = snap.exists ? snap.data() : null;
    if (d && d.state && Number(d.updatedAt) > state.updatedAt) {
      state = normalize(d.state); state.updatedAt = Number(d.updatedAt);
      saveLocal(); D = derive(state); paint(); setSync('synced');
    } else if (!snap.metadata || !snap.metadata.fromCache) {
      if (!reconciled && state.updatedAt > 0 && (!d || Number(d.updatedAt) < state.updatedAt)) { reconciled = true; scheduleRemote(); }
      else if (syncState === 'connecting' || syncState === 'slow') setSync('synced');
    }
  }
  function onRemoteErr() { clearTimeout(loadTimer); remote = null; setSync('local'); }

  async function initCaps() {
    if (!window.claude || typeof window.claude.use !== 'function') return;
    try { dlCap = await window.claude.use('downloads'); if (dlCap) { var b = $('#btn-save-file'); if (b) b.hidden = false; } } catch (e) {}
    var db = null, user = null;
    try { db = await window.claude.use('db'); user = await window.claude.use('user'); } catch (e) {}
    if (!db || !user) return;
    var id = null;
    try { id = await user.id(); } catch (e) {}
    if (!id) return;
    try {
      remote = db.collection('data/users/' + id).doc('save');
      setSync('connecting');
      loadTimer = setTimeout(function () { setSync('slow'); }, 10000);
      remote.onSnapshot(onRemote, onRemoteErr);
    } catch (e) { remote = null; setSync('local'); }
  }

  /* ---------- state changes ---------- */
  function commit(msg) {
    state.updatedAt = Date.now();
    saveLocal();
    var prev = D; D = derive(state);
    var up = '';
    for (var i = 0; i < SKILLS.length; i++) {
      var n = SKILLS[i].name;
      if (D.per[n].level > prev.per[n].level) { up = D.per[n].level >= 99 ? n + ' 99, cape earned' : n + ' is now level ' + D.per[n].level; break; }
    }
    var note = msg ? (up ? msg + ' · ' + up : msg) : up;
    paint();
    if (note) toast(note);
    scheduleRemote();
  }

  /* ---------- views ---------- */
  var tab = 'home', manage = false, pendingDel = null, delT = null, openGroups = {}, sheetSkill = null, lastFocus = null, armedRestore = false, restoreT = null;
  var TABS = [
    { id: 'home', label: 'Profile', svg: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-4 3-6 7-6s7 2 7 6"/>' },
    { id: 'skills', label: 'Skills', svg: '<rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><rect x="14" y="14" width="6" height="6"/>' },
    { id: 'wild', label: 'Wilderness', svg: '<path d="M4 7l2 2 3-3M4 16l2 2 3-3M13 8h7M13 17h7"/>' },
    { id: 'quests', label: 'Quests', svg: '<path d="M7 4h10v15a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 9h6M9 13h6"/>' },
    { id: 'bosses', label: 'Bosses', svg: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/>' }
  ];
  function buildNav() {
    $('#nav').innerHTML = TABS.map(function (t) {
      return '<button data-act="tab" data-tab="' + t.id + '"><svg viewBox="0 0 24 24" aria-hidden="true">' + t.svg + '</svg><span>' + t.label + '</span></button>';
    }).join('');
  }
  function setTab(id) {
    tab = id; manage = false; pendingDel = null;
    try { localStorage.setItem(TABKEY, id); } catch (e) {}
    Array.prototype.forEach.call(document.querySelectorAll('#nav button'), function (b) {
      if (b.dataset.tab === id) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    ({ home: mountHome, skills: paintSkills, wild: mountWild, quests: mountQuests, bosses: mountBosses })[id]();
    window.scrollTo(0, 0);
  }
  function paint() {
    $('#hdr-total').textContent = D.totalLevel;
    ({ home: paintHome, skills: paintSkills, wild: paintWild, quests: paintQuests, bosses: paintBosses })[tab]();
    paintSheet();
  }

  /* Home */
  function mountHome() {
    var p = state.profile;
    view.innerHTML =
      '<section class="panel" id="card" aria-label="Character card"></section>' +
      '<details class="add" id="edit-box"><summary>Edit profile</summary><form class="form" id="f-profile">' +
      '<label>Name<input id="p-name" maxlength="40" required value="' + esc(p.name) + '"></label>' +
      '<label>Class<select id="p-cls">' + ['Warrior', 'Mage', 'Ranger', 'Scholar', 'Adventurer'].map(function (c) { return '<option' + (c === p.cls ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select></label>' +
      '<label>Bio<textarea id="p-bio" maxlength="200">' + esc(p.bio) + '</textarea></label>' +
      '<button class="btn primary" type="submit">Save profile</button></form></details>' +
      '<section class="panel" id="backup"><h3 class="sect">Save and restore</h3><p id="sync-line" class="sync"></p>' +
      '<div class="row"><button class="btn" id="btn-save-file" data-act="backup-save">Save backup file</button><button class="btn" data-act="backup-copy">Copy backup</button></div>' +
      '<textarea id="backup-out" readonly hidden aria-label="Backup text"></textarea>' +
      '<label class="lbl" for="restore-text">Restore from a backup</label><textarea id="restore-text" placeholder="Paste backup text here"></textarea>' +
      '<div class="row" style="margin-top:8px"><label class="btn" style="display:inline-flex;align-items:center">Load backup file<input type="file" id="restore-file" accept=".json,application/json,text/plain" hidden></label><button class="btn" id="restore-btn" data-act="backup-restore">Restore</button></div><p id="restore-msg" role="status"></p></section>';
    paintHome(); setSync(syncState);
  }
  function paintHome() {
    var p = state.profile, t = today(), gap = p.last ? dayGap(p.last, t) : null, streakTxt, checked = gap === 0;
    if (!p.last) streakTxt = 'Check in to start your streak.';
    else if (gap === 0) streakTxt = '<b>' + p.streak + '</b> day streak. Checked in today.';
    else if (gap === 1) streakTxt = '<b>' + p.streak + '</b> day streak. Check in today to keep it.';
    else streakTxt = 'Streak broken. Check in to start again.';
    var stats = [
      ['Rank', D.rank, 'Title from Total Level'], ['Combat level', D.combat, 'OSRS combat formula'],
      ['Total level', D.totalLevel + ' / ' + fmt(MAX_TOTAL), 'Sum of all 23 skills'], ['Total XP', fmt(D.totalXp), 'Across every skill'],
      ['Quest points', D.qp, 'From completed quests'], ['Capes', D.capes + ' / 23', 'Skills at level 99']
    ];
    $('#card').innerHTML =
      '<div class="who"><div class="avatar" aria-hidden="true">' + esc((p.name[0] || '?').toUpperCase()) + '</div><div><h2 class="name">' + esc(p.name) + '</h2><div class="cls">' + esc(p.cls) + ' · ' + D.rank + '</div></div></div>' +
      (p.bio ? '<p class="bio">' + esc(p.bio) + '</p>' : '') +
      '<dl class="stats">' + stats.map(function (s) { return '<div><dt>' + s[0] + '</dt><dd class="num">' + s[1] + '<small>' + s[2] + '</small></dd></div>'; }).join('') + '</dl>' +
      '<div class="streak"><span>' + streakTxt + '</span><button class="btn primary" data-act="checkin"' + (checked ? ' disabled' : '') + '>' + (checked ? 'Checked in' : 'Check in') + '</button></div>';
  }

  /* Skills */
  function paintSkills() {
    var cells = SKILLS.map(function (k) {
      var p = D.per[k.name];
      return '<button class="cell" data-act="skill-open" data-name="' + k.name + '" aria-label="' + k.name + ', level ' + p.level + ', ' + fmt(p.total) + ' XP">' +
        '<div class="top2"><span class="plate c-' + k.cat + '" aria-hidden="true">' + k.name[0] + '</span><span class="lvl num">' + p.level + '</span></div>' +
        '<span class="nm">' + k.name + '</span><div class="bar-x"><i style="width:' + Math.round(p.progress * 100) + '%"></i></div></button>';
    }).join('');
    view.innerHTML = '<div class="bar"><h2>Skills</h2></div><p class="lede">Tap a skill for its XP, what trained it, and bonus XP. The bar under each level is progress to the next one.</p>' +
      '<div class="grid">' + cells + '<div class="cell total"><span class="nm">Total level</span><span class="lvl num">' + D.totalLevel + '</span><span class="nm">of ' + fmt(MAX_TOTAL) + '</span></div></div>';
  }
  function openSheet(name) {
    sheetSkill = name; lastFocus = document.activeElement; $('#sheet').hidden = false; document.body.style.overflow = 'hidden'; paintSheet(); $('#sheet-x').focus();
  }
  function closeSheet() {
    sheetSkill = null; $('#sheet').hidden = true; document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function paintSheet() {
    if (!sheetSkill) return;
    var k = SKILL_BY[sheetSkill], p = D.per[sheetSkill];
    $('#sheet-top').innerHTML =
      '<div class="shead"><span class="plate c-' + k.cat + '" aria-hidden="true">' + k.name[0] + '</span><div><h2 id="sheet-title">' + k.name + '</h2><div class="dim">' + CAT_LABEL[k.cat] + ' skill</div></div><span class="lvl big num">' + p.level + '</span></div>' +
      '<div class="bar-x"><i style="width:' + Math.round(p.progress * 100) + '%"></i></div>' +
      '<p class="dim num" style="margin-top:6px">' + fmt(p.total) + ' XP · ' + (p.level >= 99 ? 'Maxed' : fmt(p.toNext) + ' XP to level ' + (p.level + 1)) + '</p>' +
      '<dl class="src">' + [['Wilderness', p.tasks], ['Quests', p.quests], ['Boss fights', p.bosses], ['Bonus', p.bonus]].map(function (r) { return '<div><dt>' + r[0] + '</dt><dd class="num">' + fmt(r[1]) + '</dd></div>'; }).join('') + '</dl>';
    var list = state.tasks.filter(function (t) { return t.skill === sheetSkill; });
    $('#sheet-tasks').innerHTML = list.length ? '<ul class="tasks" style="padding:0">' + list.map(function (t) { return taskRow(t, false); }).join('') + '</ul>' : '<p class="dim">Nothing trains this skill yet. Add an activity in Wilderness.</p>';
  }

  /* Wilderness */
  function taskRow(t, canManage) {
    var d = TASK_DIFF[t.diff], earned = taskEarned(t), key = 'task:' + t.id;
    return '<li class="task"><button class="chk' + (t.done ? ' on' : '') + '" data-act="task-done" data-id="' + esc(t.id) + '" aria-pressed="' + t.done + '" aria-label="One-off complete: ' + esc(t.title) + '"></button>' +
      '<div><div class="ttl' + (t.done ? ' done' : '') + '">' + esc(t.title) + '</div><div class="tmeta">' + chip(TASK_DIFF, t.diff) + '<span>+' + d.xp + ' XP each</span>' + (earned ? '<span class="earned num">' + fmt(earned) + ' earned</span>' : '') + '</div></div>' +
      '<div class="step"><button data-act="tally-dec" data-id="' + esc(t.id) + '" aria-label="One fewer"' + (t.tally ? '' : ' disabled') + '>−</button><output class="num" aria-label="Times done">' + t.tally + '</output><button data-act="tally-inc" data-id="' + esc(t.id) + '" aria-label="Done once more">+</button></div>' +
      (canManage && manage ? '<button class="btn danger del" data-act="del" data-kind="task" data-id="' + esc(t.id) + '">' + (pendingDel === key ? 'Tap again to remove' : 'Remove') + '</button>' : '') + '</li>';
  }
  function manageBtn() { return '<button class="btn" id="manage-btn" data-act="manage-toggle" aria-pressed="' + manage + '">Manage</button>'; }
  function mountWild() {
    view.innerHTML = '<div class="bar"><h2>Wilderness</h2>' + manageBtn() + '</div>' +
      '<p class="lede">Repeatable training. Tap + each time you do an activity. Use the box on the left for a one-off. XP goes to the linked skill.</p>' +
      '<details class="add"><summary>Add an activity</summary><form class="form" id="f-task">' +
      '<label>Activity<input id="t-title" maxlength="80" required placeholder="Stretch for 10 minutes"></label>' +
      '<div class="two"><label>Skill<select id="t-skill">' + skillOpts('Agility') + '</select></label>' +
      '<label>Difficulty<select id="t-diff">' + diffOpts(TASK_DIFF, 'medium') + '</select></label></div>' +
      '<button class="btn primary" type="submit">Add activity</button></form></details><div id="list"></div>';
    paintWild();
  }
  function paintWild() {
    var mb = $('#manage-btn'); if (mb) mb.setAttribute('aria-pressed', manage);
    var by = {}; state.tasks.forEach(function (t) { (by[t.skill] = by[t.skill] || []).push(t); });
    var html = SKILLS.filter(function (k) { return by[k.name]; }).sort(function (a, b) { return a.name < b.name ? -1 : 1; }).map(function (k) {
      var list = by[k.name], earned = list.reduce(function (n, t) { return n + taskEarned(t); }, 0);
      return '<details class="grp panel" style="padding:0" data-g="' + k.name + '"' + (openGroups[k.name] ? ' open' : '') + '><summary><span class="gl"><b>' + k.name + '</b><small>' + list.length + ' activit' + (list.length === 1 ? 'y' : 'ies') + (earned ? ' · ' + fmt(earned) + ' XP earned' : '') + '</small></span></summary><ul class="tasks">' + list.map(function (t) { return taskRow(t, true); }).join('') + '</ul></details>';
    }).join('');
    $('#list').innerHTML = html || '<div class="panel empty">No activities yet. Add one above.</div>';
  }

  /* Quests */
  function mountQuests() {
    view.innerHTML = '<div class="bar"><h2>Quests</h2>' + manageBtn() + '</div>' +
      '<p class="lede">One-time goals with a finish line. Completing one pays XP and quest points, and always pays more than a Wilderness task.</p>' +
      '<details class="add"><summary>Add a quest</summary><form class="form" id="f-quest">' +
      '<label>Quest<input id="q-title" maxlength="80" required placeholder="Read 12 books this year"></label>' +
      '<label>Description<input id="q-desc" maxlength="200" placeholder="Optional"></label>' +
      '<div class="two"><label>Skill<select id="q-skill">' + skillOpts('', true) + '</select></label>' +
      '<label>Difficulty<select id="q-diff">' + diffOpts(QUEST_DIFF, 'intermediate') + '</select></label></div>' +
      '<button class="btn primary" type="submit">Add quest</button></form></details><div id="list"></div>';
    paintQuests();
  }
  function paintQuests() {
    var mb = $('#manage-btn'); if (mb) mb.setAttribute('aria-pressed', manage);
    var order = { active: 0, todo: 1, done: 2 };
    var list = state.quests.slice().sort(function (a, b) { return order[a.status] - order[b.status] || tier(QUEST_DIFF, a.diff) - tier(QUEST_DIFF, b.diff); });
    $('#list').innerHTML = list.length ? list.map(function (q) {
      var d = QUEST_DIFF[q.diff], key = 'quest:' + q.id;
      return '<article class="panel card' + (q.status === 'done' ? ' won' : '') + '"><div class="hd"><h3>' + esc(q.title) + '</h3>' + chip(QUEST_DIFF, q.diff) + '</div>' +
        (q.desc ? '<p class="dim">' + esc(q.desc) + '</p>' : '') +
        '<div class="meta num">+' + fmt(d.xp) + ' XP · ' + d.qp + ' QP · ' + (q.skill ? 'trains ' + q.skill : 'no skill linked') + '</div>' +
        '<div class="seg" role="group" aria-label="Status">' + [['todo', 'Not started'], ['active', 'In progress'], ['done', 'Complete']].map(function (s) {
          return '<button class="btn" data-act="quest-status" data-id="' + esc(q.id) + '" data-status="' + s[0] + '" aria-pressed="' + (q.status === s[0]) + '">' + s[1] + '</button>';
        }).join('') + '</div>' +
        (manage ? '<button class="btn danger" data-act="del" data-kind="quest" data-id="' + esc(q.id) + '">' + (pendingDel === key ? 'Tap again to remove' : 'Remove') + '</button>' : '') + '</article>';
    }).join('') : '<div class="panel empty">No quests yet. Add one above.</div>';
  }

  /* Bosses */
  function mountBosses() {
    view.innerHTML = '<div class="bar"><h2>Boss fights</h2>' + manageBtn() + '</div>' +
      '<p class="lede">Big challenges with HP. Each work session lands a hit. Reduce a boss to 0 HP to claim its XP.</p>' +
      '<details class="add"><summary>Add a boss</summary><form class="form" id="f-boss">' +
      '<label>Boss<input id="b-title" maxlength="80" required placeholder="The Tax Return Troll"></label>' +
      '<label>Description<input id="b-desc" maxlength="200" placeholder="Optional"></label>' +
      '<div class="two"><label>Skill<select id="b-skill">' + skillOpts('Slayer', true) + '</select></label>' +
      '<label>Difficulty<select id="b-diff">' + diffOpts(BOSS_DIFF, 'medium') + '</select></label></div>' +
      '<label>HP (how many hits to defeat it)<input id="b-hp" type="number" inputmode="numeric" min="1" max="500" value="10" required></label>' +
      '<button class="btn primary" type="submit">Add boss</button></form></details><div id="list"></div>';
    paintBosses();
  }
  function paintBosses() {
    var mb = $('#manage-btn'); if (mb) mb.setAttribute('aria-pressed', manage);
    $('#list').innerHTML = state.bosses.length ? state.bosses.map(function (b) {
      var won = b.left <= 0, key = 'boss:' + b.id;
      return '<article class="panel card' + (won ? ' won' : '') + '"><div class="hd"><h3>' + esc(b.title) + '</h3>' + chip(BOSS_DIFF, b.diff) + '</div>' +
        (b.desc ? '<p class="dim">' + esc(b.desc) + '</p>' : '') +
        '<div class="bar-x ' + (won ? 'done' : 'hp') + '" role="img" aria-label="' + b.left + ' of ' + b.hp + ' HP left"><i style="width:' + (won ? 100 : Math.round(b.left / b.hp * 100)) + '%"></i></div>' +
        '<div class="meta num">' + (won ? 'Defeated' : b.left + ' / ' + b.hp + ' HP') + ' · +' + fmt(b.xp) + ' XP' + (b.skill ? ' to ' + b.skill : ' (no skill linked)') + '</div>' +
        '<div class="row">' + (won ? '<button class="btn" data-act="boss-reset" data-id="' + esc(b.id) + '">Revive</button>' :
          '<button class="btn primary" data-act="boss-hit" data-id="' + esc(b.id) + '">Land a hit</button><button class="btn" data-act="boss-undo" data-id="' + esc(b.id) + '"' + (b.left >= b.hp ? ' disabled' : '') + '>Undo hit</button>') +
        (manage ? '<button class="btn danger" data-act="del" data-kind="boss" data-id="' + esc(b.id) + '">' + (pendingDel === key ? 'Tap again to remove' : 'Remove') + '</button>' : '') + '</div></article>';
    }).join('') : '<div class="panel empty">No bosses yet. Add one above.</div>';
  }

  /* ---------- backup ---------- */
  function backupText() { return JSON.stringify({ app: 'runescapeos', exportedAt: new Date().toISOString(), state: state }, null, 1); }
  function restoreMsg(text, bad) { var m = $('#restore-msg'); if (m) { m.textContent = text; m.style.color = bad ? 'var(--bad)' : 'var(--good)'; } }
  function resetArm() { armedRestore = false; clearTimeout(restoreT); var b = $('#restore-btn'); if (b) b.textContent = 'Restore'; }

  function saveBlob() {
    try {
      var u = URL.createObjectURL(new Blob([backupText()], { type: 'application/json' }));
      var a = document.createElement('a'); a.href = u; a.download = 'runescapeos-backup-' + today() + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
      toast('Backup saved');
    } catch (e) { toast('Could not save the file'); }
  }
  document.addEventListener('change', function (e) {
    if (e.target.id !== 'restore-file' || !e.target.files || !e.target.files[0]) return;
    var r = new FileReader();
    r.onload = function () { $('#restore-text').value = String(r.result || ''); restoreMsg('Backup loaded. Tap Restore to apply it.', false); e.target.value = ''; };
    r.onerror = function () { restoreMsg('Could not read that file.', true); };
    r.readAsText(e.target.files[0]);
  });

  /* ---------- events ---------- */
  function find(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  function onAct(a, el) {
    var id = el.dataset.id, t, q, b;
    switch (a) {
      case 'tab': setTab(el.dataset.tab); break;
      case 'skill-open': openSheet(el.dataset.name); break;
      case 'sheet-close': closeSheet(); break;
      case 'manage-toggle': manage = !manage; pendingDel = null; paint(); break;
      case 'checkin': {
        var p = state.profile, tdy = today();
        if (p.last === tdy) { toast('Already checked in today'); break; }
        p.streak = (p.last && dayGap(p.last, tdy) === 1) ? p.streak + 1 : 1; p.last = tdy;
        commit('Checked in · ' + p.streak + ' day streak'); break;
      }
      case 'task-done': t = find(state.tasks, id); if (!t) break; t.done = !t.done; commit((t.done ? '+' : '−') + TASK_DIFF[t.diff].xp + ' XP · ' + t.skill); break;
      case 'tally-inc': t = find(state.tasks, id); if (!t) break; t.tally++; commit('+' + TASK_DIFF[t.diff].xp + ' XP · ' + t.skill); break;
      case 'tally-dec': t = find(state.tasks, id); if (!t || !t.tally) break; t.tally--; commit('−' + TASK_DIFF[t.diff].xp + ' XP · ' + t.skill); break;
      case 'quest-status': q = find(state.quests, id); if (!q || q.status === el.dataset.status) break; q.status = el.dataset.status;
        commit(q.status === 'done' ? 'Quest complete · +' + QUEST_DIFF[q.diff].xp + ' XP · +' + QUEST_DIFF[q.diff].qp + ' QP' : 'Quest updated'); break;
      case 'boss-hit': b = find(state.bosses, id); if (!b || b.left <= 0) break; b.left--; commit(b.left <= 0 ? 'Boss defeated · +' + fmt(b.xp) + ' XP' : 'Hit landed · ' + b.left + ' HP left'); break;
      case 'boss-undo': b = find(state.bosses, id); if (!b || b.left >= b.hp) break; b.left++; commit(); break;
      case 'boss-reset': b = find(state.bosses, id); if (!b) break; b.left = b.hp; commit('Boss revived'); break;
      case 'del': {
        var kind = el.dataset.kind, key = kind + ':' + id;
        if (pendingDel !== key) { pendingDel = key; clearTimeout(delT); delT = setTimeout(function () { pendingDel = null; paint(); }, 3500); paint(); break; }
        pendingDel = null; clearTimeout(delT);
        var coll = kind === 'task' ? 'tasks' : kind === 'quest' ? 'quests' : 'bosses';
        state[coll] = state[coll].filter(function (x) { return x.id !== id; }); commit('Removed'); break;
      }
      case 'bonus-add': case 'bonus-sub': {
        var amt = int($('#bonus-amt').value, 1, 1e6, 0);
        if (!amt || !sheetSkill) { toast('Enter an amount of 1 or more'); break; }
        var cur = state.bonus[sheetSkill] || 0, next = a === 'bonus-add' ? cur + amt : Math.max(0, cur - amt);
        if (next) state.bonus[sheetSkill] = next; else delete state.bonus[sheetSkill];
        commit((a === 'bonus-add' ? '+' : '−') + fmt(amt) + ' XP · ' + sheetSkill); break;
      }
      case 'backup-save':
        if (!dlCap) { saveBlob(); break; }
        dlCap.save({ filename: 'runescapeos-backup.json', data: backupText() }).then(function () { toast('Backup saved'); }, function (e) { if (!e || e.code !== 'declined') toast('Could not save the file'); });
        break;
      case 'backup-copy': {
        var text = backupText(), out = $('#backup-out');
        var fallback = function () { out.value = text; out.hidden = false; out.focus(); out.select(); toast('Select all and copy'); };
        try { navigator.clipboard.writeText(text).then(function () { toast('Backup copied'); }, fallback); } catch (e) { fallback(); }
        break;
      }
      case 'backup-restore': {
        var raw = $('#restore-text').value.trim();
        if (!raw) { restoreMsg('Paste a backup first.', true); break; }
        var obj; try { obj = JSON.parse(raw); } catch (e) { restoreMsg('That text is not valid backup data.', true); break; }
        var src = obj && obj.state ? obj.state : obj;
        if (!src || typeof src !== 'object' || (!Array.isArray(src.tasks) && !src.profile)) { restoreMsg('That does not look like a RunescapeOS backup.', true); break; }
        if (!armedRestore) { armedRestore = true; $('#restore-btn').textContent = 'Tap again to replace all data'; restoreMsg('This replaces everything in the app.', true); clearTimeout(restoreT); restoreT = setTimeout(function () { resetArm(); restoreMsg('', false); }, 5000); break; }
        resetArm(); state = normalize(src); D = derive(state); commit('Backup restored'); restoreMsg('Restored.', false); $('#restore-text').value = '';
        mountHome(); break;
      }
    }
  }
  document.addEventListener('click', function (e) { var el = e.target.closest('[data-act]'); if (el) onAct(el.dataset.act, el); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sheetSkill) closeSheet(); });
  document.addEventListener('toggle', function (e) { var g = e.target && e.target.dataset && e.target.dataset.g; if (g) { if (e.target.open) openGroups[g] = true; else delete openGroups[g]; } }, true);
  document.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target.id, v = function (i) { return $('#' + i).value; };
    if (f === 'f-profile') { var p = state.profile; p.name = v('p-name').trim() || p.name; p.cls = v('p-cls'); p.bio = v('p-bio').trim(); commit('Profile saved'); }
    else if (f === 'f-task') { var ti = v('t-title').trim(); if (!ti) return; state.tasks.push({ id: uid(), skill: v('t-skill'), title: ti, diff: v('t-diff'), done: false, tally: 0 }); openGroups[v('t-skill')] = true; $('#t-title').value = ''; commit('Activity added'); }
    else if (f === 'f-quest') { var qt = v('q-title').trim(); if (!qt) return; state.quests.push({ id: uid(), title: qt, desc: v('q-desc').trim(), skill: v('q-skill'), diff: v('q-diff'), status: 'todo' }); $('#q-title').value = ''; $('#q-desc').value = ''; commit('Quest added'); }
    else if (f === 'f-boss') { var bt = v('b-title').trim(); if (!bt) return; var hp = int(v('b-hp'), 1, 500, 10), bd = v('b-diff'); state.bosses.push({ id: uid(), title: bt, desc: v('b-desc').trim(), skill: v('b-skill'), diff: bd, hp: hp, left: hp, xp: BOSS_DIFF[bd].xp }); $('#b-title').value = ''; $('#b-desc').value = ''; commit('Boss added'); }
  });

  /* ---------- start ---------- */
  buildNav();
  var saved = 'home'; try { saved = localStorage.getItem(TABKEY) || 'home'; } catch (e) {}
  setTab(['home', 'skills', 'wild', 'quests', 'bosses'].indexOf(saved) >= 0 ? saved : 'home');
  $('#hdr-total').textContent = D.totalLevel;
  initCaps();
})();
