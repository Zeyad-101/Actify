// Schedule CRUD + home-page busy-time UI for Actify.
// Depends on auth.js (requireAuth) and supabaseClient.js being loaded first.

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ---- helpers ----
function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTime(t) {
  // time columns may come back as "HH:MM:SS" — strip to "HH:MM"
  return String(t || '').slice(0, 5);
}

function formatDays(item) {
  if (item.is_recurring) {
    const days = (item.weekdays || []).slice().sort((a, b) => a - b);
    if (days.length === 0) return 'no days set';
    if (days.length === 7) return 'every day';
    if (days.length === 5 && [1, 2, 3, 4, 5].every(d => days.includes(d))) return 'weekdays';
    if (days.length === 2 && [0, 6].every(d => days.includes(d))) return 'weekends';
    return 'every ' + days.map(d => DAY_NAMES[d]).join(', ');
  }
  if (item.specific_date) {
    const d = new Date(item.specific_date + 'T00:00:00');
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    }
  }
  return '';
}

function isToday(item) {
  if (item.is_recurring) {
    return Array.isArray(item.weekdays) && item.weekdays.includes(new Date().getDay());
  }
  return item.specific_date === todayStr();
}

async function getCurrentUserId() {
  const { data: { user } } = await window.supabaseClient.auth.getUser();
  return user ? user.id : null;
}

// ---- CRUD (global) ----
async function addScheduleItem(data) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('not authenticated');
  const payload = { ...data, user_id: userId };
  const { data: row, error } = await window.supabaseClient
    .from('schedule_items')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return row;
}

async function updateScheduleItem(id, data) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('not authenticated');
  const { data: row, error } = await window.supabaseClient
    .from('schedule_items')
    .update(data)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) throw error;
  return row;
}

async function deleteScheduleItem(id) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('not authenticated');
  const { error } = await window.supabaseClient
    .from('schedule_items')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

async function getAllScheduleItems() {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const { data, error } = await window.supabaseClient
    .from('schedule_items')
    .select('*')
    .eq('user_id', userId)
    .order('start_time', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function getTodayScheduleItems() {
  const all = await getAllScheduleItems();
  const todayDow = new Date().getDay();
  const today = todayStr();
  return all
    .filter(item => {
      if (item.is_recurring) {
        return Array.isArray(item.weekdays) && item.weekdays.includes(todayDow);
      }
      return item.specific_date === today;
    })
    .sort((a, b) => formatTime(a.start_time).localeCompare(formatTime(b.start_time)));
}

window.addScheduleItem = addScheduleItem;
window.updateScheduleItem = updateScheduleItem;
window.deleteScheduleItem = deleteScheduleItem;
window.getAllScheduleItems = getAllScheduleItems;
window.getTodayScheduleItems = getTodayScheduleItems;

// ---- Home-page busy-time modal + list UI ----
(async function () {
  if (!document.getElementById('dayModal')) return;

  const user = await requireAuth();
  if (!user) return;

  const form = document.getElementById('scheduleForm');
  const modal = document.getElementById('dayModal');
  const openBtn = document.getElementById('openDayModal');
  const closeBtn = document.getElementById('closeDayModal');
  const titleInput = document.getElementById('titleInput');
  const startInput = document.getElementById('startTime');
  const endInput = document.getElementById('endTime');
  const dateInput = document.getElementById('specificDate');
  const dateField = document.getElementById('dateField');
  const weekdaysField = document.getElementById('weekdaysField');
  const typeToggle = document.getElementById('typeToggle');
  const weekdayToggles = document.getElementById('weekdayToggles');
  const submitBtn = document.getElementById('submitBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const listEl = document.getElementById('scheduleList');
  const emptyState = document.getElementById('emptyState');
  const dayItemType = document.getElementById('dayItemType');
  const busyFields = document.getElementById('busyFields');
  const taskFields = document.getElementById('taskFields');
  let editingId = null;
  let formType = 'oneoff';
  let selectedDays = new Set();
  let allItems = [];
  let lastOpener = null;

  function isBusyMode() { return modal.dataset.mode !== 'task'; }
  function setMode(mode) {
    const busyMode = mode === 'busy';
    modal.dataset.mode = mode;
    for (const child of dayItemType.children) child.classList.toggle('active', child.dataset.dayType === mode);
    busyFields.classList.toggle('hidden', !busyMode);
    taskFields.classList.toggle('hidden', busyMode);
    for (const input of busyFields.querySelectorAll('input')) input.disabled = !busyMode;
    for (const input of taskFields.querySelectorAll('input')) input.disabled = busyMode;
    submitBtn.textContent = busyMode && editingId ? 'save ✦' : 'add ✦';
  }
  function openModal(mode, opener) {
    lastOpener = opener || document.activeElement;
    setMode(mode);
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    const focusTarget = mode === 'task'
      ? document.getElementById('taskTitleInput')
      : titleInput;
    focusTarget.focus();
  }

  function closeModal() {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    resetForm();
    if (lastOpener && typeof lastOpener.focus === 'function') lastOpener.focus();
  }

  function resetForm() {
    editingId = null;
    form.reset();
    formType = 'oneoff';
    selectedDays.clear();
    for (const child of typeToggle.children) child.classList.toggle('active', child.dataset.type === 'oneoff');
    for (const child of weekdayToggles.children) child.classList.remove('active');
    dateField.classList.remove('hidden');
    weekdaysField.classList.add('hidden');
    dateInput.value = todayStr();
    setMode('busy');
  }

  dayItemType.addEventListener('click', event => {
    const button = event.target.closest('button[data-day-type]');
    if (!button || editingId) return;
    setMode(button.dataset.dayType);
    const target = button.dataset.dayType === 'task'
      ? document.getElementById('taskTitleInput')
      : titleInput;
    target.focus();
  });

  openBtn.addEventListener('click', () => openModal('busy', openBtn));
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', event => {
    if (event.target === modal) closeModal();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
  });
  window.addEventListener('actify:open-day-modal', event => {
    openModal(event.detail && event.detail.mode === 'task' ? 'task' : 'busy', event.detail && event.detail.opener);
  });

  typeToggle.addEventListener('click', event => {
    const button = event.target.closest('button[data-type]');
    if (!button) return;
    formType = button.dataset.type;
    for (const child of typeToggle.children) child.classList.toggle('active', child === button);
    dateField.classList.toggle('hidden', formType !== 'oneoff');
    weekdaysField.classList.toggle('hidden', formType !== 'recurring');
  });
  weekdayToggles.addEventListener('click', event => {
    const button = event.target.closest('button[data-day]');
    if (!button) return;
    const day = Number(button.dataset.day);
    if (selectedDays.has(day)) {
      selectedDays.delete(day);
      button.classList.remove('active');
    } else {
      selectedDays.add(day);
      button.classList.add('active');
    }
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!isBusyMode()) return;
    const title = titleInput.value.trim();
    const start_time = startInput.value;
    const end_time = endInput.value;
    if (!title || !start_time || !end_time) return;
    if (start_time >= end_time) {
      alert('start time must be before end time');
      return;
    }
    if (formType === 'oneoff' && !dateInput.value) {
      alert('pick a date');
      return;
    }
    if (formType === 'recurring' && selectedDays.size === 0) {
      alert('pick at least one weekday');
      return;
    }

    const payload = {
      title,
      start_time,
      end_time,
      is_recurring: formType === 'recurring',
      weekdays: formType === 'recurring' ? Array.from(selectedDays).sort((a, b) => a - b) : [],
      specific_date: formType === 'oneoff' ? dateInput.value : null,
    };
    submitBtn.disabled = true;
    try {
      if (editingId) await updateScheduleItem(editingId, payload);
      else await addScheduleItem(payload);
      await renderList();
      closeModal();
    } catch (err) {
      console.error(err);
      alert('save failed: ' + (err && err.message ? err.message : 'unknown error'));
    } finally {
      submitBtn.disabled = false;
    }
  });

  listEl.addEventListener('click', async event => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const item = allItems.find(candidate => candidate.id === button.dataset.id);
    if (!item) return;
    if (button.dataset.action === 'edit') {
      startEdit(item, button);
      return;
    }
    if (button.dataset.action !== 'delete' || !confirm('delete "' + item.title + '"?')) return;
    try {
      await deleteScheduleItem(item.id);
      await renderList();
    } catch (err) {
      console.error(err);
      alert('delete failed: ' + (err && err.message ? err.message : 'unknown error'));
    }
  });

  function startEdit(item, opener) {
    editingId = item.id;
    titleInput.value = item.title || '';
    startInput.value = formatTime(item.start_time);
    endInput.value = formatTime(item.end_time);
    formType = item.is_recurring ? 'recurring' : 'oneoff';
    for (const child of typeToggle.children) child.classList.toggle('active', child.dataset.type === formType);
    selectedDays = new Set(item.weekdays || []);
    for (const child of weekdayToggles.children) {
      child.classList.toggle('active', selectedDays.has(Number(child.dataset.day)));
    }
    dateField.classList.toggle('hidden', formType !== 'oneoff');
    weekdaysField.classList.toggle('hidden', formType !== 'recurring');
    dateInput.value = item.specific_date || todayStr();
    openModal('busy', opener);
    submitBtn.textContent = 'save ✦';
  }

  async function renderList() {
    allItems = await getAllScheduleItems();
    listEl.innerHTML = '';
    if (allItems.length === 0) {
      emptyState.classList.remove('hidden');
      listEl.appendChild(emptyState);
      return;
    }
    emptyState.classList.add('hidden');
    for (const item of allItems) {
      const card = document.createElement('div');
      card.className = 'schedule-card' + (isToday(item) ? ' today' : '');
      const info = document.createElement('div');
      info.className = 'schedule-info';
      const titleRow = document.createElement('div');
      titleRow.className = 'schedule-title';
      titleRow.textContent = item.title;
      if (isToday(item)) {
        const badge = document.createElement('span');
        badge.className = 'today-badge';
        badge.textContent = 'today';
        titleRow.appendChild(badge);
      }
      const timeRow = document.createElement('div');
      timeRow.className = 'schedule-meta';
      timeRow.textContent = formatTime(item.start_time) + ' – ' + formatTime(item.end_time);
      const daysRow = document.createElement('div');
      daysRow.className = 'schedule-meta';
      daysRow.textContent = formatDays(item);
      info.append(titleRow, timeRow, daysRow);

      const actions = document.createElement('div');
      actions.className = 'schedule-actions';
      for (const [action, label, className] of [
        ['edit', 'edit', 'btn small'],
        ['delete', 'delete', 'btn small danger'],
      ]) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = className;
        button.dataset.action = action;
        button.dataset.id = item.id;
        button.textContent = label;
        actions.appendChild(button);
      }
      card.append(info, actions);
      listEl.appendChild(card);
    }
  }

  resetForm();
  try {
    await renderList();
  } catch (err) {
    console.error('schedule load failed:', err);
  }
})();
