import { openDB, getAllRecords, clearStore, putRecord } from './storage.js';
import { initHero, getHero, updateHero } from './hero.js';
import { getPrograms, getProgram, saveProgram, deleteProgram, createProgram, createExercise, getActiveProgram, setActiveProgram } from './programs.js';
import { todayStr, getTodayLog, buildTodayLog, rebuildTodayLog, markExerciseDone, completeDay, uncompleteDay, getDayLogs, canCompleteToday } from './daily-log.js';
import { convertPoints, getRewardHistory } from './rewards.js';

// ─── Toast ────────────────────────────────────────────────────────────────────
function showToast(message, duration = 3000) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add('hidden'), duration);
}

// ─── Tab Navigation ───────────────────────────────────────────────────────────
const tabRenderers = {
  hero: renderHero,
  today: renderToday,
  program: renderProgram,
  history: renderHistory,
  backup: renderBackup,
};

function initNav() {
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

async function switchTab(tabName) {
  document.querySelectorAll('.tab-section').forEach((s) => s.classList.add('hidden'));
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));

  const section = document.getElementById(`tab-${tabName}`);
  if (section) section.classList.remove('hidden');

  const btn = document.querySelector(`.nav-btn[data-tab="${tabName}"]`);
  if (btn) btn.classList.add('active');

  if (tabRenderers[tabName]) await tabRenderers[tabName]();
}

// ─── Hero Tab ─────────────────────────────────────────────────────────────────
async function renderHero() {
  const section = document.getElementById('tab-hero');
  const hero = await getHero();
  const AVATARS = ['🦸', '🧙', '🥷', '🦊', '🐉'];
  const ptsInLevel = (hero.currentPoints % 10);
  const ptsBarPct = (ptsInLevel / 10) * 100;

  section.innerHTML = `
    <div class="card">
      <span class="hero-avatar">${hero.avatar}</span>
      <div class="hero-name-wrap">
        <span class="hero-name" id="hero-name-display">${escHtml(hero.name)}</span>
        <button class="btn-icon" id="edit-name-btn" title="Edit name">✏️</button>
      </div>
      <div id="hero-name-edit" class="hidden" style="margin:8px 0;">
        <input type="text" id="hero-name-input" value="${escHtml(hero.name)}" maxlength="30" style="margin-bottom:4px;">
        <button class="btn btn-primary" id="save-name-btn">Save</button>
      </div>
      <div style="text-align:center;margin:8px 0;">
        <span class="level-badge">Level ${hero.level}</span>
      </div>
      <div class="points-bar-wrap" title="${ptsInLevel}/10 pts to next level">
        <div class="points-bar-fill" style="width:${ptsBarPct}%"></div>
      </div>
      <div style="text-align:center;font-size:13px;color:var(--text-light);margin-bottom:12px;">${ptsInLevel}/10 pts to next level</div>
      <div class="stat-row"><span>🔥 Streak</span><strong>${hero.streak} days</strong></div>
      <div class="stat-row"><span>💎 Crystals</span><strong>${hero.crystals}</strong></div>
      <div class="stat-row"><span>⭐ Lifetime Points</span><strong>${hero.lifetimePoints}</strong></div>
    </div>

    <div class="card">
      <div style="font-weight:bold;margin-bottom:8px;">Choose Avatar</div>
      <div class="avatar-picker">
        ${AVATARS.map((a) => `<button class="avatar-option${hero.avatar === a ? ' selected' : ''}" data-avatar="${a}">${a}</button>`).join('')}
      </div>
    </div>

    <button class="btn btn-primary btn-block" id="convert-btn">
      Convert ${hero.currentPoints} pts → 💎
    </button>
  `;

  // Edit name
  document.getElementById('edit-name-btn').addEventListener('click', () => {
    document.getElementById('hero-name-display').classList.add('hidden');
    document.getElementById('edit-name-btn').classList.add('hidden');
    document.getElementById('hero-name-edit').classList.remove('hidden');
    document.getElementById('hero-name-input').focus();
  });

  document.getElementById('save-name-btn').addEventListener('click', async () => {
    const newName = document.getElementById('hero-name-input').value.trim() || 'Hero';
    await updateHero({ name: newName });
    await renderHero();
  });

  // Avatar picker
  section.querySelectorAll('.avatar-option').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await updateHero({ avatar: btn.dataset.avatar });
      await renderHero();
    });
  });

  // Convert points
  document.getElementById('convert-btn').addEventListener('click', async () => {
    try {
      await convertPoints();
      showToast('💎 Crystal earned! Points converted!');
      await renderHero();
    } catch (e) {
      showToast('⚠️ ' + e.message);
    }
  });
}

// ─── Today Tab ────────────────────────────────────────────────────────────────
async function renderToday() {
  const section = document.getElementById('tab-today');

  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  section.innerHTML = `<h2 style="text-align:center;margin:0 0 16px;">${dateLabel}</h2>`;

  const activeProgram = await getActiveProgram();

  if (!activeProgram) {
    section.insertAdjacentHTML('beforeend', `
      <div class="card" style="text-align:center;">
        <p style="font-size:18px;">📋 Create a program first!</p>
        <button class="btn btn-primary btn-block" id="go-program-btn">Go to Program</button>
      </div>`);
    document.getElementById('go-program-btn').addEventListener('click', () => switchTab('program'));
    return;
  }

  section.insertAdjacentHTML('beforeend', `
    <div style="text-align:center;margin-bottom:12px;font-size:13px;color:var(--text-light);">
      📋 Program: <strong>${escHtml(activeProgram.name)}</strong>
    </div>`);

  let log = await getTodayLog();
  if (!log) {
    log = await buildTodayLog(activeProgram.id);
  }

  if (!log || log.exercises.length === 0) {
    section.insertAdjacentHTML('beforeend', `<div class="card"><p>No active exercises in your program. Add some in the Program tab!</p></div>`);
    return;
  }

  const exercisesHtml = log.exercises.map((ex) => `
    <div class="exercise-card card ${ex.done ? 'done' : ''}" data-id="${ex.id}">
      <div style="flex:1;">
        <div class="exercise-name" style="font-size:18px;font-weight:bold;">${escHtml(ex.name)}</div>
        <div style="color:var(--text-light);font-size:14px;">${ex.target} ${ex.type === 'seconds' ? 'sec' : 'reps'}</div>
      </div>
      <input type="checkbox" class="exercise-checkbox" data-exercise-id="${ex.id}" ${ex.done ? 'checked' : ''} ${log.completed ? 'disabled' : ''}>
    </div>
  `).join('');

  section.insertAdjacentHTML('beforeend', exercisesHtml);

  if (log.completed) {
    section.insertAdjacentHTML('beforeend', `
      <div class="congrats-banner">
        🎉 Great job today!<br>
        <strong>+${log.pointsEarned} points</strong> earned<br>
        🔥 Streak: ${log.streakOnDay} days
      </div>
      <button class="btn btn-block" id="undo-btn" style="background:#eee;color:var(--text);margin-top:8px;">
        ↩️ Undo — I pressed by mistake
      </button>`);

    document.getElementById('undo-btn').addEventListener('click', async () => {
      if (!confirm('Are you sure? This will cancel today\'s completion and remove the points.')) return;
      try {
        await uncompleteDay();
        showToast('↩️ Workout completion cancelled');
        await renderToday();
        await renderHero();
      } catch (e) {
        showToast('⚠️ ' + e.message);
      }
    });
  } else {
    section.insertAdjacentHTML('beforeend', `
      <button class="btn btn-success btn-block complete-btn" id="complete-btn">
        ✅ Complete Workout!
      </button>`);

    document.getElementById('complete-btn').addEventListener('click', async () => {
      const can = await canCompleteToday();
      if (!can) { showToast('Already completed or no exercises!'); return; }
      const result = await completeDay();
      let msg = `🎉 +${result.pointsEarned} points! Streak: ${result.newStreak} days! 🔥`;
      if (result.bonusEarned) msg += ' BONUS +5! 🌟';
      showToast(msg, 4000);
      await renderToday();
      await renderHero();
    });
  }

  // Checkbox handlers (only if not completed)
  if (!log.completed) {
    section.querySelectorAll('.exercise-checkbox').forEach((cb) => {
      cb.addEventListener('change', async () => {
        await markExerciseDone(log.date, cb.dataset.exerciseId, cb.checked);
        await renderToday();
      });
    });
  }
}

// ─── Program Tab ──────────────────────────────────────────────────────────────
async function renderProgram() {
  const section = document.getElementById('tab-program');
  const programs = await getPrograms();

  section.innerHTML = `<h2 style="margin:0 0 16px;">📋 Programs</h2>`;

  // New program form
  section.innerHTML += `
    <div class="card" id="new-program-form-card">
      <div id="new-prog-toggle-area">
        <button class="btn btn-primary btn-block" id="show-new-prog-btn">➕ New Program</button>
      </div>
      <div id="new-prog-form" class="hidden">
        <input type="text" id="new-prog-name" placeholder="Program name">
        <div class="form-row">
          <button class="btn btn-primary" id="save-new-prog-btn">Save</button>
          <button class="btn" id="cancel-new-prog-btn" style="background:#eee;">Cancel</button>
        </div>
      </div>
    </div>`;

  document.getElementById('show-new-prog-btn').addEventListener('click', () => {
    document.getElementById('new-prog-form').classList.remove('hidden');
    document.getElementById('show-new-prog-btn').classList.add('hidden');
    document.getElementById('new-prog-name').focus();
  });
  document.getElementById('cancel-new-prog-btn').addEventListener('click', () => {
    document.getElementById('new-prog-form').classList.add('hidden');
    document.getElementById('show-new-prog-btn').classList.remove('hidden');
  });
  document.getElementById('save-new-prog-btn').addEventListener('click', async () => {
    const name = document.getElementById('new-prog-name').value.trim();
    if (!name) { showToast('Enter a program name'); return; }
    const programs = await getPrograms();
    // First program is auto-set as active
    const prog = createProgram({ name, active: programs.length === 0 });
    await saveProgram(prog);
    showToast('✅ Program created!');
    await renderProgram();
  });

  if (programs.length === 0) {
    section.insertAdjacentHTML('beforeend', `<div class="card" style="text-align:center;color:var(--text-light);">No programs yet. Create one above!</div>`);
    return;
  }

  for (const prog of programs) {
    const progDiv = document.createElement('div');
    progDiv.className = 'card program-card';
    progDiv.dataset.progId = prog.id;

    const activeExCount = (prog.exercises || []).filter((e) => e.active).length;
    const isActive = !!prog.active;
    progDiv.innerHTML = `
      <div class="program-header" data-prog-id="${prog.id}">
        <div>
          <span class="program-name-display" id="pname-${prog.id}">${escHtml(prog.name)}</span>
          ${isActive ? '<span class="active-badge">▶ Active</span>' : ''}
          <span style="font-size:12px;color:var(--text-light);margin-left:8px;">(${activeExCount} active exercises)</span>
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          ${!isActive ? `<button class="btn-icon set-active-btn" data-prog-id="${prog.id}" title="Set as today's program">▶️</button>` : ''}
          <button class="btn-icon edit-prog-btn" data-prog-id="${prog.id}" title="Rename">✏️</button>
          <button class="btn-icon delete-prog-btn" data-prog-id="${prog.id}" title="Delete" style="color:var(--danger);">🗑️</button>
          <span class="toggle-arrow" id="arrow-${prog.id}">▼</span>
        </div>
      </div>
      <div id="prog-edit-${prog.id}" class="hidden" style="margin:8px 0;">
        <input type="text" id="prog-name-input-${prog.id}" value="${escHtml(prog.name)}" maxlength="50">
        <div class="form-row">
          <button class="btn btn-primary save-prog-name-btn" data-prog-id="${prog.id}">Save</button>
          <button class="btn cancel-prog-name-btn" data-prog-id="${prog.id}" style="background:#eee;">Cancel</button>
        </div>
      </div>
      <div class="exercise-list" id="exlist-${prog.id}"></div>
      <div id="add-ex-area-${prog.id}">
        <button class="btn btn-primary" style="margin-top:8px;font-size:14px;" data-prog-id="${prog.id}" id="show-add-ex-${prog.id}">➕ Add Exercise</button>
        <div id="add-ex-form-${prog.id}" class="hidden" style="margin-top:8px;">
          <input type="text" id="ex-name-${prog.id}" placeholder="Exercise name">
          <div class="form-row">
            <select id="ex-type-${prog.id}">
              <option value="reps">Reps</option>
              <option value="seconds">Seconds</option>
            </select>
            <input type="number" id="ex-target-${prog.id}" placeholder="10" min="1" style="width:90px;">
          </div>
          <div class="form-row">
            <button class="btn btn-success save-ex-btn" data-prog-id="${prog.id}">Add</button>
            <button class="btn cancel-ex-btn" data-prog-id="${prog.id}" style="background:#eee;">Cancel</button>
          </div>
        </div>
      </div>
    `;

    section.appendChild(progDiv);
    renderExerciseList(prog);

    // Toggle expand/collapse
    progDiv.querySelector('.program-header').addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('input')) return;
      const list = document.getElementById(`exlist-${prog.id}`);
      const addArea = document.getElementById(`add-ex-area-${prog.id}`);
      const arrow = document.getElementById(`arrow-${prog.id}`);
      const collapsed = list.classList.toggle('hidden');
      addArea.classList.toggle('hidden', collapsed);
      arrow.textContent = collapsed ? '▶' : '▼';
    });

    // Edit program name
    progDiv.querySelector('.edit-prog-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById(`prog-edit-${prog.id}`).classList.remove('hidden');
      document.getElementById(`pname-${prog.id}`).classList.add('hidden');
    });
    progDiv.querySelector('.cancel-prog-name-btn').addEventListener('click', () => {
      document.getElementById(`prog-edit-${prog.id}`).classList.add('hidden');
      document.getElementById(`pname-${prog.id}`).classList.remove('hidden');
    });
    progDiv.querySelector('.save-prog-name-btn').addEventListener('click', async () => {
      const newName = document.getElementById(`prog-name-input-${prog.id}`).value.trim();
      if (!newName) return;
      prog.name = newName;
      await saveProgram(prog);
      showToast('✅ Program renamed!');
      await renderProgram();
    });

    // Delete program
    progDiv.querySelector('.delete-prog-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`Delete program "${prog.name}"?`)) return;
      await deleteProgram(prog.id);
      showToast('🗑️ Program deleted');
      await renderProgram();
    });

    // Set as active program
    const setActiveBtn = progDiv.querySelector('.set-active-btn');
    if (setActiveBtn) {
      setActiveBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await setActiveProgram(prog.id);
        // Rebuild today's log with new active program (if not completed)
        await rebuildTodayLog(prog.id);
        showToast(`▶ "${escHtml(prog.name)}" is now the active program`);
        await renderProgram();
      });
    }

    // Show add exercise form
    document.getElementById(`show-add-ex-${prog.id}`).addEventListener('click', () => {
      document.getElementById(`add-ex-form-${prog.id}`).classList.remove('hidden');
      document.getElementById(`show-add-ex-${prog.id}`).classList.add('hidden');
      document.getElementById(`ex-name-${prog.id}`).focus();
    });

    // Cancel add exercise
    progDiv.querySelector('.cancel-ex-btn').addEventListener('click', () => {
      document.getElementById(`add-ex-form-${prog.id}`).classList.add('hidden');
      document.getElementById(`show-add-ex-${prog.id}`).classList.remove('hidden');
    });

    // Save exercise
    progDiv.querySelector('.save-ex-btn').addEventListener('click', async () => {
      const name = document.getElementById(`ex-name-${prog.id}`).value.trim();
      const type = document.getElementById(`ex-type-${prog.id}`).value;
      const target = parseInt(document.getElementById(`ex-target-${prog.id}`).value, 10) || 10;
      if (!name) { showToast('Enter exercise name'); return; }
      const ex = createExercise({ name, type, target, order: (prog.exercises || []).length });
      prog.exercises = [...(prog.exercises || []), ex];
      await saveProgram(prog);
      showToast('✅ Exercise added!');
      await renderProgram();
    });
  }
}

function renderExerciseList(prog) {
  const container = document.getElementById(`exlist-${prog.id}`);
  if (!container) return;
  const exercises = (prog.exercises || []).sort((a, b) => a.order - b.order);

  if (exercises.length === 0) {
    container.innerHTML = `<p style="color:var(--text-light);font-size:14px;">No exercises yet.</p>`;
    return;
  }

  container.innerHTML = exercises.map((ex, idx) => `
    <div class="exercise-item" data-ex-id="${ex.id}">
      <input type="checkbox" class="ex-active-toggle" data-prog-id="${prog.id}" data-ex-id="${ex.id}" ${ex.active ? 'checked' : ''} title="Active">
      <span style="flex:1;font-size:15px;${ex.active ? '' : 'opacity:0.5;text-decoration:line-through;'}">${escHtml(ex.name)}</span>
      <span class="ex-target-display" data-ex-id="${ex.id}" style="font-size:13px;color:var(--text-light);min-width:60px;cursor:pointer;" title="Tap to edit">${ex.target} ${ex.type === 'seconds' ? 'sec' : 'reps'} ✏️</span>
      <span class="ex-target-edit hidden" data-ex-id="${ex.id}" style="display:none;align-items:center;gap:4px;">
        <input type="number" class="ex-target-input" data-ex-id="${ex.id}" value="${ex.target}" min="1" style="width:60px;padding:4px 6px;font-size:14px;margin:0;">
        <button class="btn-icon ex-target-save" data-ex-id="${ex.id}" title="Save">✅</button>
        <button class="btn-icon ex-target-cancel" data-ex-id="${ex.id}" title="Cancel">❌</button>
      </span>
      <button class="btn-icon move-up-btn" data-prog-id="${prog.id}" data-ex-id="${ex.id}" ${idx === 0 ? 'disabled' : ''} title="Move up">⬆️</button>
      <button class="btn-icon move-down-btn" data-prog-id="${prog.id}" data-ex-id="${ex.id}" ${idx === exercises.length - 1 ? 'disabled' : ''} title="Move down">⬇️</button>
      <button class="btn-icon del-ex-btn" data-prog-id="${prog.id}" data-ex-id="${ex.id}" title="Delete" style="color:var(--danger);">🗑️</button>
    </div>
  `).join('');

  // Active toggle — also rebuilds today's log if this is the active program
  container.querySelectorAll('.ex-active-toggle').forEach((cb) => {
    cb.addEventListener('change', async () => {
      const ex = prog.exercises.find((e) => e.id === cb.dataset.exId);
      if (ex) ex.active = cb.checked;
      await saveProgram(prog);
      // Rebuild today's log if this program is active
      const activeProgram = await getActiveProgram();
      if (activeProgram && activeProgram.id === prog.id) {
        await rebuildTodayLog(prog.id);
      }
      renderExerciseList(prog);
    });
  });

  // Move up
  container.querySelectorAll('.move-up-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const sorted = [...prog.exercises].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((e) => e.id === btn.dataset.exId);
      if (idx <= 0) return;
      [sorted[idx - 1].order, sorted[idx].order] = [sorted[idx].order, sorted[idx - 1].order];
      prog.exercises = sorted;
      await saveProgram(prog);
      renderExerciseList(prog);
    });
  });

  // Move down
  container.querySelectorAll('.move-down-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const sorted = [...prog.exercises].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((e) => e.id === btn.dataset.exId);
      if (idx >= sorted.length - 1) return;
      [sorted[idx + 1].order, sorted[idx].order] = [sorted[idx].order, sorted[idx + 1].order];
      prog.exercises = sorted;
      await saveProgram(prog);
      renderExerciseList(prog);
    });
  });

  // Delete exercise
  container.querySelectorAll('.del-ex-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      prog.exercises = prog.exercises.filter((e) => e.id !== btn.dataset.exId);
      await saveProgram(prog);
      renderExerciseList(prog);
    });
  });

  // Edit target (reps/secs) inline
  container.querySelectorAll('.ex-target-display').forEach((span) => {
    span.addEventListener('click', () => {
      const id = span.dataset.exId;
      span.style.display = 'none';
      const editSpan = container.querySelector(`.ex-target-edit[data-ex-id="${id}"]`);
      editSpan.style.display = 'flex';
      editSpan.classList.remove('hidden');
      editSpan.querySelector('.ex-target-input').focus();
    });
  });

  container.querySelectorAll('.ex-target-cancel').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.exId;
      container.querySelector(`.ex-target-display[data-ex-id="${id}"]`).style.display = '';
      const editSpan = container.querySelector(`.ex-target-edit[data-ex-id="${id}"]`);
      editSpan.style.display = 'none';
    });
  });

  container.querySelectorAll('.ex-target-save').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.exId;
      const input = container.querySelector(`.ex-target-input[data-ex-id="${id}"]`);
      const newTarget = parseInt(input.value, 10);
      if (!newTarget || newTarget < 1) { showToast('Enter a valid number'); return; }
      const ex = prog.exercises.find((e) => e.id === id);
      if (ex) ex.target = newTarget;
      await saveProgram(prog);
      // Rebuild today's log if this is the active program
      const activeProgram = await getActiveProgram();
      if (activeProgram && activeProgram.id === prog.id) {
        await rebuildTodayLog(prog.id);
      }
      showToast('✅ Updated!');
      renderExerciseList(prog);
    });
  });
}

// ─── History Tab ──────────────────────────────────────────────────────────────
async function renderHistory() {
  const section = document.getElementById('tab-history');
  const logs = await getDayLogs();

  section.innerHTML = `<h2 style="margin:0 0 16px;">📅 Workout History</h2>`;

  if (logs.length === 0) {
    section.innerHTML += `<div class="card" style="text-align:center;color:var(--text-light);">No workouts yet. Start today!</div>`;
    return;
  }

  const rows = logs.map((log) => {
    const dateObj = new Date(log.date + 'T00:00:00');
    const dateLabel = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit' });
    const doneCount = (log.exercises || []).filter((e) => e.done).length;
    const totalCount = (log.exercises || []).length;
    return `<tr>
      <td>${dateLabel}</td>
      <td style="text-align:center;">${log.completed ? '✅' : '❌'}</td>
      <td style="text-align:center;">${doneCount}/${totalCount}</td>
      <td style="text-align:center;">${log.pointsEarned ?? 0}</td>
      <td style="text-align:center;">${log.streakOnDay ?? 0} 🔥</td>
    </tr>`;
  }).join('');

  section.innerHTML += `
    <div style="overflow-x:auto;">
      <table class="history-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Status</th>
            <th>Done</th>
            <th>Pts</th>
            <th>Streak</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ─── Backup Tab ───────────────────────────────────────────────────────────────
async function renderBackup() {
  const section = document.getElementById('tab-backup');
  section.innerHTML = `
    <h2 style="margin:0 0 16px;">💾 Backup & Restore</h2>
    <div class="card">
      <p style="color:var(--text-light);font-size:14px;">Export all your data to a JSON file you can keep safe.</p>
      <button class="btn btn-primary btn-block" id="export-btn">📤 Export Backup</button>
    </div>
    <div class="card">
      <p style="color:var(--text-light);font-size:14px;">⚠️ Importing will overwrite all current data.</p>
      <button class="btn btn-warning btn-block" id="import-btn">📥 Import Backup</button>
      <input type="file" id="import-file" accept=".json" class="hidden">
    </div>
  `;

  document.getElementById('export-btn').addEventListener('click', async () => {
    const [hero, programs, dayLogs, rewardHistory] = await Promise.all([
      getAllRecords('hero'),
      getAllRecords('programs'),
      getAllRecords('dayLogs'),
      getAllRecords('rewardHistory'),
    ]);
    const backup = { hero, programs, dayLogs, rewardHistory };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `training-game-backup-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📤 Backup exported!');
  });

  document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });

  document.getElementById('import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      const stores = ['hero', 'programs', 'dayLogs', 'rewardHistory'];
      for (const store of stores) {
        await clearStore(store);
        if (backup[store]) {
          for (const record of backup[store]) {
            await putRecord(store, record);
          }
        }
      }
      showToast('✅ Backup restored!');
      await renderBackup();
    } catch (err) {
      showToast('❌ Import failed: ' + err.message);
    }
  });
}

// ─── Utility ──────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Init ─────────────────────────────────────────────────────────────────────
async function init() {
  await openDB();
  await initHero();

  // Hide all sections except today
  document.querySelectorAll('.tab-section').forEach((s) => s.classList.add('hidden'));
  document.getElementById('tab-today').classList.remove('hidden');

  initNav();
  await renderToday();
}

init().catch(console.error);
