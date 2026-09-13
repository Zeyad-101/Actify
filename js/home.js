// Home page wiring for Actify.
// Composes: auth, character, free-time, recommendation, tasks modules.

async function fetchProfile(userId) {
  const { data, error } = await window.supabaseClient
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error) throw error;
  return data;
}

function greetingFor(hour) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function nowMinutes() {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

function timeToMinutes(t) {
  const [h, m] = String(t).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatDuration(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// "You have 1h 30m free [until 16:00 / starting now / starting at 15:00]"
function describeFreeTime(gap) {
  const dur = formatDuration(gap.minutes);
  const startMin = timeToMinutes(gap.start);
  const isActive = startMin === nowMinutes();
  const goesToEOD = gap.end === '24:00';

  if (isActive) {
    if (goesToEOD) return `You have ${dur} free starting now`;
    return `You have ${dur} free until ${gap.end}`;
  }
  return `You have ${dur} free starting at ${gap.start}`;
}

// Format activity duration for display. RAWG games have minutes=null.
function formatMinutes(minutes) {
  if (minutes == null) return 'flexible';
  return `${minutes} min`;
}

(async function () {
  // ---- auth gate ----
  const user = await requireAuth();
  if (!user) return;

  if (await isFirstLogin(user.id)) {
    window.location.href = 'onboarding.html';
    return;
  }

  // ---- profile ----
  let profile;
  try {
    profile = await fetchProfile(user.id);
  } catch (err) {
    console.error('profile load failed:', err);
    return;
  }

  // ---- greeting ----
  const greeting = document.getElementById('greeting');
  const name = profile.name || 'friend';
  greeting.textContent = `${greetingFor(new Date().getHours())}, ${name}`;

  // ---- character (front and center) ----
  window.renderCharacter(document.getElementById('characterSlot'), {
    skin:      profile.skin,
    hairStyle: profile.hair_style,
    hairColor: profile.hair_color,
    eyes:      profile.eyes,
    shirt:     profile.shirt,
    pants:     profile.pants,
    shoes:     profile.shoes,
    accessory: profile.accessory,
  });

  // ---- free-time card ----
  const freeTimeText = document.getElementById('freeTimeText');
  const ideaBtn      = document.getElementById('ideaBtn');
  let freeMinutes    = 0;

  try {
    const gaps = await window.getFreeTimeToday();
    const candidates = gaps.filter(g => g.bucket !== 'tiny');
    if (candidates.length > 0) {
      candidates.sort((a, b) => b.minutes - a.minutes);
      const largest = candidates[0];
      freeMinutes = largest.minutes;
      freeTimeText.textContent = describeFreeTime(largest);
    } else {
      freeTimeText.textContent = 'No real free time right now';
      freeTimeText.classList.add('free-time-empty');
    }
  } catch (err) {
    console.error('free time load failed:', err);
    freeTimeText.textContent = "couldn't load free time";
    freeTimeText.classList.add('free-time-empty');
  }

  // ---- mood picker + recommendations ----
  const moodSection     = document.getElementById('moodSection');
  const recommendSection = document.getElementById('recommendSection');
  const recommendList   = document.getElementById('recommendList');
  const moodGrid        = document.getElementById('moodGrid');
  let currentMood = null;

  // Session-level set: IDs of activities already shown or dismissed.
  // Passed to getRecommendations so the engine never re-surfaces them.
  const sessionSeenIds = new Set();

  // Show the idea button only if we have real free time.
  if (freeMinutes > 0) {
    ideaBtn.classList.remove('hidden');
    ideaBtn.addEventListener('click', () => {
      moodSection.classList.toggle('hidden');
    });
  }

  moodGrid.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-mood]');
    if (!btn) return;
    const mood = btn.dataset.mood;
    currentMood = mood;

    for (const child of moodGrid.children) {
      child.classList.toggle('active', child === btn);
    }
    for (const child of moodGrid.children) child.disabled = true;
    recommendSection.classList.remove('hidden');
    recommendList.innerHTML = '<p class="empty-state">thinking…</p>';

    try {
      const recs = await window.getRecommendations(freeMinutes, mood, sessionSeenIds);
      // Mark these as seen so re-rolls don't show them again.
      for (const r of recs) sessionSeenIds.add(r.id);
      renderRecommendations(recs, mood);
    } catch (err) {
      console.error(err);
      recommendList.innerHTML =
        '<p class="empty-state">recommendations failed — try again</p>';
    } finally {
      for (const child of moodGrid.children) child.disabled = false;
    }
  });

  function getCurrentPosition() {
    return new Promise(resolve => {
      if (!navigator.geolocation) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        pos  => resolve(pos.coords),
        ()   => resolve(null),
        { timeout: 8000, maximumAge: 300000 },
      );
    });
  }

  function formatNearbyDistance(distanceMeters) {
    if (distanceMeters > 1000) return `${(distanceMeters / 1000).toFixed(1)} km`;
    return `${distanceMeters} m`;
  }

  async function addNearbyOptions(card) {
    try {
      const coords = await getCurrentPosition();
      if (!coords || !window.OverpassAdapter) return;

      const places = await window.OverpassAdapter.findNearby(
        coords.latitude,
        coords.longitude,
      );
      if (!places || places.length === 0) return;

      const nearby   = document.createElement('div');
      nearby.className = 'nearby-options';
      const heading  = document.createElement('p');
      heading.className = 'nearby-options-title';
      heading.textContent = 'Nearby options';
      nearby.appendChild(heading);

      const list = document.createElement('ul');
      for (const place of places) {
        const item = document.createElement('li');
        item.textContent =
          `${place.name} · ${place.type} · ${formatNearbyDistance(place.distanceMeters)}`;
        list.appendChild(item);
      }
      nearby.appendChild(list);
      card.appendChild(nearby);
    } catch {
      // Nearby options are optional and must not interrupt feedback.
    }
  }

  // Trigger a fresh recommendation fetch for the current mood,
  // excluding already-seen IDs.
  async function refreshRecommendations() {
    if (!currentMood) return;
    recommendList.innerHTML = '<p class="empty-state">thinking…</p>';
    for (const child of moodGrid.children) child.disabled = true;
    try {
      const recs = await window.getRecommendations(freeMinutes, currentMood, sessionSeenIds);
      for (const r of recs) sessionSeenIds.add(r.id);
      renderRecommendations(recs, currentMood);
    } catch (err) {
      console.error(err);
      recommendList.innerHTML =
        '<p class="empty-state">recommendations failed — try again</p>';
    } finally {
      for (const child of moodGrid.children) child.disabled = false;
    }
  }

  function renderRecommendations(recs, mood) {
    recommendList.innerHTML = '';
    if (!recs || recs.length === 0) {
      recommendList.innerHTML =
        '<p class="empty-state">no matches for that mood and time</p>';
      renderTaskNudge();
      return;
    }

    for (const rec of recs) {
      const card = document.createElement('div');
      card.className = 'rec-card';

      const head = document.createElement('div');
      head.className = 'rec-head';

      const title = document.createElement('h3');
      title.className = 'rec-title';
      title.textContent = rec.title;

      const cat = document.createElement('span');
      cat.className = 'rec-cat';
      cat.textContent = rec.category;

      head.appendChild(title);
      head.appendChild(cat);

      const meta = document.createElement('p');
      meta.className = 'rec-meta';
      // rec.minutes is null for RAWG games — show "flexible" instead of "null min".
      meta.textContent = formatMinutes(rec.minutes);

      const reason = document.createElement('p');
      reason.className = 'rec-reason';
      reason.textContent = rec.reason;

      const actions = document.createElement('div');
      actions.className = 'rec-actions';

      const feedbackOptions = [
        { label: '❤️ Loved', feedback: 'loved', primary: true },
        { label: '👍 Good',  feedback: 'good'  },
        { label: '😐 Not really', feedback: 'meh' },
        { label: '👎 No',    feedback: 'no'    },
      ];

      const feedbackButtons = feedbackOptions.map(option => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = option.primary ? 'btn primary small' : 'btn small';
        button.textContent = option.label;
        actions.appendChild(button);
        return { button, option };
      });

      card.appendChild(head);
      card.appendChild(meta);
      card.appendChild(reason);
      card.appendChild(actions);
      recommendList.appendChild(card);

      // ---- feedback state machine ----
      // Each card is entirely independent. A boolean flag prevents the
      // reason-picker from being shown twice (e.g. rapid double-click on "No").
      let reasonPickerShown = false;
      let feedbackSubmitted = false;

      function disableAllFeedbackButtons() {
        for (const { button } of feedbackButtons) button.disabled = true;
      }

      async function submit(button, feedback, rejectionReason = null) {
        if (feedbackSubmitted) return;
        feedbackSubmitted = true;
        disableAllFeedbackButtons();
        try {
          await window.submitFeedback(
            rec.id,
            rec.category,
            mood,
            feedback,
            rejectionReason,
            rec.topTag,
          );
          button.textContent = '✓';
          card.classList.add('feedback-submitted');
          if (
            rec.category === 'GoOut' &&
            (feedback === 'loved' || feedback === 'good')
          ) {
            addNearbyOptions(card);
          }
        } catch (err) {
          console.error('feedback submit failed:', err);
          feedbackSubmitted = false;
          disableAllFeedbackButtons(); // keep disabled; card is in bad state
        }
      }

      function showReasonPicker() {
        // Guard: show only once per card, never after another feedback.
        if (reasonPickerShown || feedbackSubmitted) return;
        reasonPickerShown = true;

        // Disable the original buttons before wiping the DOM so there is no
        // window where they can receive clicks.
        disableAllFeedbackButtons();
        actions.innerHTML = '';

        const prompt = document.createElement('span');
        prompt.className = 'rec-reason-prompt';
        prompt.textContent = 'Why not?';
        actions.appendChild(prompt);

        const reasons = [
          'Too long',
          'Not my mood',
          'Not interested',
          'Already did it',
          'Too much effort',
        ];

        let reasonSubmitted = false;

        for (const rejectionReason of reasons) {
          const reasonBtn = document.createElement('button');
          reasonBtn.type = 'button';
          reasonBtn.className = 'btn small';
          reasonBtn.textContent = rejectionReason;

          reasonBtn.addEventListener('click', async () => {
            // Prevent double-submission from double-clicks.
            if (reasonSubmitted) return;
            reasonSubmitted = true;

            for (const child of actions.querySelectorAll('button')) {
              child.disabled = true;
            }

            try {
              await window.submitFeedback(
                rec.id,
                rec.category,
                mood,
                'no',
                rejectionReason,
                rec.topTag,
              );
              reasonBtn.textContent = '✓';
              card.classList.add('feedback-submitted');

              // Offer a "suggest something else" button so the user can
              // immediately get fresh picks without re-selecting a mood.
              const rerollBtn = document.createElement('button');
              rerollBtn.type = 'button';
              rerollBtn.className = 'btn small primary';
              rerollBtn.textContent = 'suggest something else ↺';
              rerollBtn.addEventListener('click', refreshRecommendations);
              actions.appendChild(rerollBtn);
            } catch (err) {
              console.error('feedback submit failed:', err);
              reasonSubmitted = false;
              for (const child of actions.querySelectorAll('button')) {
                child.disabled = false;
              }
            }
          });

          actions.appendChild(reasonBtn);
        }
      }

      // Wire up the original feedback buttons.
      for (const { button, option } of feedbackButtons) {
        button.addEventListener('click', () => {
          if (option.feedback === 'no') {
            showReasonPicker();
          } else {
            submit(button, option.feedback);
          }
        });
      }
    }

    renderTaskNudge();
  }

  function renderTaskNudge() {
    window.getAllTasks().then(tasks => {
      const task = tasks.find(item => !item.done);
      if (!task) return;

      const nudge = document.createElement('div');
      nudge.className = 'rec-card task-nudge';

      const copy = document.createElement('p');
      copy.className = 'task-nudge-copy';
      copy.textContent = 'or knock out: ' + task.title;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn small';
      button.textContent = 'mark done ✓';
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          await window.toggleTask(task.id);
          nudge.remove();
          document.dispatchEvent(new CustomEvent('actify:tasks-changed'));
        } catch (err) {
          console.error('task nudge update failed:', err);
          button.disabled = false;
        }
      });

      nudge.append(copy, button);
      recommendList.appendChild(nudge);
    }).catch(err => console.error('task nudge load failed:', err));
  }

  // ---- to-do panel ----
  const todoList      = document.getElementById('todoList');
  const dayModal      = document.getElementById('dayModal');
  const taskTitleInput = document.getElementById('taskTitleInput');
  const scheduleForm  = document.getElementById('scheduleForm');
  const submitBtn     = document.getElementById('submitBtn');


  async function renderTodos() {
    let tasks;
    try {
      tasks = await window.getAllTasks();
    } catch (err) {
      console.error(err);
      return;
    }
    todoList.innerHTML = '';
    if (tasks.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'empty-state';
      empty.textContent = 'no tasks yet — add one below ✿';
      todoList.appendChild(empty);
      return;
    }
    for (const t of tasks) {
      const li = document.createElement('li');
      li.className = 'todo-item' + (t.done ? ' done' : '');

      const check = document.createElement('input');
      check.type = 'checkbox';
      check.checked = !!t.done;
      check.setAttribute('aria-label', 'mark ' + t.title + ' done');
      check.addEventListener('change', async () => {
        // Optimistic UI: flip the class first, revert on error.
        const wasDone = li.classList.contains('done');
        li.classList.toggle('done', !wasDone);
        try {
          await window.toggleTask(t.id);
          document.dispatchEvent(new CustomEvent('actify:tasks-changed'));
        } catch (err) {
          console.error(err);
          li.classList.toggle('done', wasDone);
          check.checked = wasDone;
        }
      });

      const span = document.createElement('span');
      span.className = 'todo-title';
      span.textContent = t.title;

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'todo-del';
      del.textContent = '×';
      del.setAttribute('aria-label', 'delete ' + t.title);
      del.addEventListener('click', async () => {
        if (!confirm('delete "' + t.title + '"?')) return;
        try {
          await window.deleteTask(t.id);
          await renderTodos();
          document.dispatchEvent(new CustomEvent('actify:tasks-changed'));
        } catch (err) {
          console.error(err);
        }
      });

      li.appendChild(check);
      li.appendChild(span);
      li.appendChild(del);
      todoList.appendChild(li);
    }
  }

  scheduleForm.addEventListener('submit', async event => {
    if (dayModal.dataset.mode !== 'task') return;
    event.preventDefault();
    const title = taskTitleInput.value.trim();
    if (!title) return;
    submitBtn.disabled = true;
    try {
      await window.addTask(title);
      taskTitleInput.value = '';
      await renderTodos();
      document.dispatchEvent(new CustomEvent('actify:tasks-changed'));
      document.getElementById('closeDayModal').click();
    } catch (err) {
      console.error(err);
      alert('add failed: ' + (err && err.message ? err.message : 'unknown error'));
    } finally {
      submitBtn.disabled = false;
    }
  });

  document.addEventListener('actify:tasks-changed', renderTodos);
  await renderTodos();

  // ---- logout ----
  document.getElementById('logoutLink').addEventListener('click', (e) => {
    e.preventDefault();
    window.signOut();
  });
})();
