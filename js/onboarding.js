// Onboarding flow: character creator (step 1) + interests (step 2).
// Depends on auth.js, character.js, and supabaseClient.js being loaded first.

(async function () {
  const user = await requireAuth();
  if (!user) return; // requireAuth already redirected to login.html

  // Returning users already have a profile; onboarding would fail on the PK insert.
  if (!(await isFirstLogin(user.id))) {
    window.location.href = 'index.html';
    return;
  }

  // ---- Constants ----
  const SKIN_OPTIONS = [
    { id: 'light',       color: '#f4c8a8' },
    { id: 'mediumLight', color: '#d9a578' },
    { id: 'medium',      color: '#b07d4f' },
    { id: 'dark',        color: '#6b4327' },
  ];
  const HAIR_OPTIONS = [
    { id: 'black',    color: '#1a1a1a' },
    { id: 'brown',    color: '#6b3a1f' },
    { id: 'blonde',   color: '#e8c46b' },
    { id: 'auburn',   color: '#8b2c1c' },
    { id: 'platinum', color: '#f0ead6' },
    { id: 'red',      color: '#c34a36' },
  ];
  const HAIR_STYLES   = ['short', 'long', 'spiky'];
  const EYE_STYLES    = ['normal', 'happy', 'wide'];
  const ACCESSORIES   = ['none', 'glasses', 'cap'];
  const PRESET_TAGS   = [
    'Gaming', 'Movies', 'Reading', 'Coding', 'Music',
    'Art', 'Food', 'Fitness', 'Exploring', 'Family', 'Friends',
  ];

  // ---- State ----
  const character = {
    name: '',
    skin: 'medium',
    hairStyle: 'short',
    hairColor: 'brown',
    eyes: 'normal',
    shirt: '#4a90e2',
    pants: '#3a3a3a',
    shoes: '#1a1a1a',
    accessory: 'none',
  };

  // interests Map<tag, { rating: number, isCustom: boolean }>
  const interests = new Map();

  // ---- DOM refs ----
  const previewEl   = document.getElementById('characterPreview');
  const previewName = document.getElementById('previewName');
  const nameInput   = document.getElementById('nameInput');
  const step1       = document.getElementById('step1');
  const step2       = document.getElementById('step2');
  const stepLabel   = document.getElementById('stepLabel');
  const nextBtn     = document.getElementById('nextBtn');
  const finishBtn   = document.getElementById('finishBtn');
  const customInput = document.getElementById('customInterestInput');
  const addCustomBtn= document.getElementById('addCustomBtn');
  const customList  = document.getElementById('customInterests');
  const presetList  = document.getElementById('presetInterests');

  // ---- Character preview ----
  function repaint() {
    renderCharacter(previewEl, character);
  }

  // ---- Swatch / pill row helpers ----
  function buildSwatches(container, options, currentId, onPick) {
    container.innerHTML = '';
    for (const opt of options) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'swatch' + (opt.id === currentId ? ' active' : '');
      btn.style.background = opt.color;
      btn.setAttribute('aria-label', opt.id);
      btn.title = opt.id;
      btn.addEventListener('click', () => {
        onPick(opt.id);
        for (const child of container.children) child.classList.remove('active');
        btn.classList.add('active');
      });
      container.appendChild(btn);
    }
  }

  function buildPills(container, options, currentId, onPick) {
    container.innerHTML = '';
    for (const opt of options) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pill' + (opt === currentId ? ' active' : '');
      btn.textContent = opt;
      btn.addEventListener('click', () => {
        onPick(opt);
        for (const child of container.children) child.classList.remove('active');
        btn.classList.add('active');
      });
      container.appendChild(btn);
    }
  }

  // ---- Wire controls ----
  buildSwatches(document.getElementById('skinSwatches'), SKIN_OPTIONS, character.skin, (id) => {
    character.skin = id;
    repaint();
  });
  buildSwatches(document.getElementById('hairColorSwatches'), HAIR_OPTIONS, character.hairColor, (id) => {
    character.hairColor = id;
    repaint();
  });
  buildPills(document.getElementById('hairStyleButtons'), HAIR_STYLES, character.hairStyle, (id) => {
    character.hairStyle = id;
    repaint();
  });
  buildPills(document.getElementById('eyesButtons'), EYE_STYLES, character.eyes, (id) => {
    character.eyes = id;
    repaint();
  });
  buildPills(document.getElementById('accessoryButtons'), ACCESSORIES, character.accessory, (id) => {
    character.accessory = id;
    repaint();
  });

  document.getElementById('shirtColor').addEventListener('input', (e) => {
    character.shirt = e.target.value;
    repaint();
  });
  document.getElementById('pantsColor').addEventListener('input', (e) => {
    character.pants = e.target.value;
    repaint();
  });
  document.getElementById('shoesColor').addEventListener('input', (e) => {
    character.shoes = e.target.value;
    repaint();
  });

  nameInput.addEventListener('input', (e) => {
    character.name = e.target.value;
    previewName.textContent = character.name.trim() || 'your name here';
  });

  repaint();
  previewName.textContent = 'your name here';

  // ---- Step 1 -> Step 2 ----
  nextBtn.addEventListener('click', () => {
    if (!character.name.trim()) {
      nameInput.focus();
      nameInput.classList.add('shake');
      setTimeout(() => nameInput.classList.remove('shake'), 400);
      return;
    }
    step1.classList.add('hidden');
    step2.classList.remove('hidden');
    stepLabel.textContent = 'step 2 of 2 · what lights you up?';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // ---- Preset interests ----
  for (const tag of PRESET_TAGS) {
    const row = document.createElement('div');
    row.className = 'interest-row';

    const check = document.createElement('label');
    check.className = 'check';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    const labelText = document.createElement('span');
    labelText.textContent = tag;
    check.appendChild(cb);
    check.appendChild(labelText);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '1';
    slider.max = '10';
    slider.value = '5';
    slider.className = 'slider hidden';
    slider.setAttribute('aria-label', tag + ' rating');

    const value = document.createElement('span');
    value.className = 'slider-value';
    value.textContent = '5';

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove-btn hidden';
    remove.textContent = '×';
    remove.setAttribute('aria-label', 'remove ' + tag);

    row.appendChild(check);
    row.appendChild(slider);
    row.appendChild(value);
    presetList.appendChild(row);

    cb.addEventListener('change', () => {
      if (cb.checked) {
        slider.classList.remove('hidden');
        value.classList.remove('hidden');
        interests.set(tag, { rating: Number(slider.value), isCustom: false });
      } else {
        slider.classList.add('hidden');
        value.classList.add('hidden');
        interests.delete(tag);
      }
    });

    slider.addEventListener('input', () => {
      value.textContent = slider.value;
      if (interests.has(tag)) {
        interests.get(tag).rating = Number(slider.value);
      }
    });
  }

  // ---- Custom interests ----
  function addCustomInterest() {
    const tag = customInput.value.trim();
    if (!tag) return;
    if (interests.has(tag)) {
      customInput.select();
      return;
    }

    const row = document.createElement('div');
    row.className = 'interest-row';

    const name = document.createElement('span');
    name.className = 'check';
    name.textContent = tag;

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '1';
    slider.max = '10';
    slider.value = '5';
    slider.className = 'slider';

    const value = document.createElement('span');
    value.className = 'slider-value';
    value.textContent = '5';

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove-btn';
    remove.textContent = '×';
    remove.setAttribute('aria-label', 'remove ' + tag);

    row.appendChild(name);
    row.appendChild(slider);
    row.appendChild(value);
    row.appendChild(remove);
    customList.appendChild(row);

    interests.set(tag, { rating: 5, isCustom: true });

    slider.addEventListener('input', () => {
      value.textContent = slider.value;
      interests.get(tag).rating = Number(slider.value);
    });
    remove.addEventListener('click', () => {
      interests.delete(tag);
      row.remove();
    });

    customInput.value = '';
    customInput.focus();
  }

  addCustomBtn.addEventListener('click', addCustomInterest);
  customInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustomInterest();
    }
  });

  // ---- Finish ----
  // Inline error message, created and inserted next to the interests list (HTML left untouched).
  const interestsError = document.createElement('div');
  interestsError.id = 'interestsError';
  interestsError.textContent = 'Pick at least one interest to continue,';
  interestsError.style.cssText =
    'color:#c34a36;font-size:18px;text-align:center;margin:8px 0 0;min-height:22px;display:none;';
  const finishNavRow = finishBtn.parentNode;
  finishNavRow.parentNode.insertBefore(interestsError, finishNavRow);

  finishBtn.addEventListener('click', async () => {
    if (interests.size === 0) {
      interestsError.style.display = 'block';
      return;
    }
    interestsError.style.display = 'none';

    finishBtn.disabled = true;
    finishBtn.textContent = 'saving...';

    try {
      const { error: profileErr } = await window.supabaseClient
        .from('profiles')
        .insert({
          user_id:     user.id,
          name:        character.name.trim(),
          skin:        character.skin,
          hair_style:  character.hairStyle,
          hair_color:  character.hairColor,
          eyes:        character.eyes,
          shirt:       character.shirt,
          pants:       character.pants,
          shoes:       character.shoes,
          accessory:   character.accessory,
        });
      if (profileErr) throw profileErr;

      if (interests.size > 0) {
        const rows = Array.from(interests.entries()).map(([tag, info]) => ({
          user_id:  user.id,
          tag:      tag,
          rating:   info.rating,
          is_custom: info.isCustom,
        }));
        const { error: intErr } = await window.supabaseClient
          .from('interests')
          .insert(rows);
        if (intErr) throw intErr;
      }

      window.location.href = 'index.html';
    } catch (err) {
      console.error('onboarding save failed', err);
      alert('failed to save: ' + (err && err.message ? err.message : 'unknown error'));
      finishBtn.disabled = false;
      finishBtn.textContent = 'finish ✦';
    }
  });
})();
