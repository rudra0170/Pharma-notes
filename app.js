// ============ SUPABASE CONFIG ============
const SUPABASE_URL = 'chvabsselwbtcufeyjam';
const SUPABASE_ANON_KEY = 'sb_publishable_V1xlVFEG7SljToGCz21scg_XmlPMvE7';

// ============ SUPABASE CLIENT ============
let supabaseClient = null;

function initSupabase() {
  if (typeof supabase !== 'undefined') {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseClient;
}

// ============ ICON HELPER ============
function getIcon(name) {
  const icons = {
    python: '💻',
    pharmacy: '💊',
    psychology: '🧠',
    anatomy: '🫀',
    pharmacognosy: '🌿',
    chemistry: '⚗️'
  };
  return icons[name] || '📘';
}

// ============ NAVBAR ============
async function renderNavbar() {
  const nav = document.getElementById('navbar');
  if (!nav) return;

  const client = initSupabase();
  const { data: { user } } = await client.auth.getUser();

  nav.innerHTML = `
    <div class="nav-inner">
      <a href="home.html" class="logo">PharmaNotes</a>
      <div class="nav-links">
        <a href="home.html">Home</a>
        <a href="upload.html">Upload</a>
        ${user
          ? '<button class="logout-btn" onclick="logout()">Logout</button>'
          : '<a href="login.html" class="login-link">Login</a>'}
      </div>
    </div>
  `;
}

async function logout() {
  const client = initSupabase();
  await client.auth.signOut();
  location.href = 'index.html';
}

// ============ SUBJECTS ============
async function loadSubjects() {
  const client = initSupabase();
  const container = document.getElementById('subjects');
  if (!container) return;

  const { data, error } = await client.from('subjects').select('*').order('name');

  if (error || !data) {
    container.innerHTML = '<p class="loading">Error loading subjects</p>';
    return;
  }

  container.innerHTML = data.map(s => `
    <a href="subject.html?id=${s.id}" class="card">
      <div class="card-icon">${getIcon(s.icon)}</div>
      <div class="card-title">${s.name}</div>
      <div class="card-code">${s.code || ''}</div>
    </a>
  `).join('');
}

// ============ SUBJECT PAGE ============
async function loadSubjectPage() {
  const client = initSupabase();
  const params = new URLSearchParams(location.search);
  const id = params.get('id');

  const { data: subject } = await client.from('subjects').select('*').eq('id', id).single();

  document.getElementById('subject-icon').textContent = getIcon(subject?.icon);
  document.getElementById('subject-name').textContent = subject?.name || '';
  document.getElementById('subject-code').textContent = subject?.code || '';

  const container = document.getElementById('units');
  const units = [1, 2, 3, 4, 5];
  container.innerHTML = units.map(u => `
    <a href="unit.html?subject=${id}&unit=${u}" class="unit-card">
      <div class="unit-label">UNIT</div>
      <div class="unit-num">${u}</div>
      <div class="unit-hint">View Notes →</div>
    </a>
  `).join('');
}

// ============ UNIT PAGE ============
async function loadUnitPage() {
  const client = initSupabase();
  const params = new URLSearchParams(location.search);
  const subjectId = params.get('subject');
  const unit = params.get('unit');

  document.getElementById('unit-label').textContent = `UNIT ${unit}`;
  document.getElementById('back-link').href = `subject.html?id=${subjectId}`;

  const container = document.getElementById('notes');

  const { data, error } = await client
    .from('notes')
    .select('*')
    .eq('subject_id', subjectId)
    .eq('unit', Number(unit))
    .order('created_at', { ascending: false });

  if (error || !data || data.length === 0) {
    container.innerHTML = `
      <div class="empty">
        <div class="empty-icon">📭</div>
        <p class="empty-text">No notes uploaded yet</p>
        <a href="upload.html" class="enter-btn" style="padding:10px 20px;font-size:14px">+ Upload Notes</a>
      </div>
    `;
    return;
  }

  container.innerHTML = data.map(n => {
    const { data: urlData } = client.storage.from('notes').getPublicUrl(n.file_path);
    const url = urlData.publicUrl;
    return `
      <div class="note-item">
        <div class="note-left">
          <div class="note-icon">📄</div>
          <div class="note-info">
            <div class="note-title">${n.title}</div>
            ${n.description ? `<div class="note-desc">${n.description}</div>` : ''}
          </div>
        </div>
        <div class="note-actions">
          <a href="${url}" target="_blank" class="btn-view">View</a>
          <a href="${url}" download class="btn-download">Download</a>
        </div>
      </div>
    `;
  }).join('');
}

// ============ UPLOAD PAGE ============
async function loadUploadPage() {
  const client = initSupabase();
  const { data: { user } } = await client.auth.getUser();

  const authBox = document.getElementById('auth-required');
  const formBox = document.getElementById('upload-form');

  if (!user) {
    authBox.style.display = 'block';
    formBox.style.display = 'none';
    return;
  }
  authBox.style.display = 'none';
  formBox.style.display = 'block';

  const { data: subjects } = await client.from('subjects').select('*').order('name');
  const select = document.getElementById('subject-select');
  select.innerHTML = '<option value="">-- Select Subject --</option>' +
    (subjects || []).map(s => `<option value="${s.id}">${s.name}</option>`).join('');
}

async function submitUpload() {
  const client = initSupabase();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return alert('Please login first');

  const subjectId = document.getElementById('subject-select').value;
  const unit = document.getElementById('unit-select').value;
  const title = document.getElementById('title-input').value.trim();
  const description = document.getElementById('desc-input').value.trim();
  const fileInput = document.getElementById('file-input');
  const file = fileInput.files[0];

  if (!subjectId || !title || !file) return alert('Subject, Title and PDF are required');

  const btn = document.getElementById('upload-btn');
  btn.disabled = true;
  btn.textContent = 'Uploading...';

  const filePath = `${user.id}/${Date.now()}-${file.name}`;

  const { error: upErr } = await client.storage.from('notes').upload(filePath, file);
  if (upErr) {
    btn.disabled = false;
    btn.textContent = 'Upload';
    return alert(upErr.message);
  }

  const { error: dbErr } = await client.from('notes').insert({
    user_id: user.id,
    subject_id: subjectId,
    unit: Number(unit),
    title,
    description,
    file_path: filePath,
  });

  btn.disabled = false;
  btn.textContent = 'Upload';

  if (dbErr) return alert(dbErr.message);

  alert('Notes uploaded successfully!');
  document.getElementById('title-input').value = '';
  document.getElementById('desc-input').value = '';
  fileInput.value = '';
}

// ============ LOGIN ============
let isSignup = false;

async function submitLogin() {
  const client = initSupabase();
  const email = document.getElementById('email-input').value.trim();
  const password = document.getElementById('password-input').value;
  if (!email || !password) return alert('Please enter email and password');

  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.textContent = '...';

  const fn = isSignup
    ? client.auth.signUp({ email, password })
    : client.auth.signInWithPassword({ email, password });

  const { error } = await fn;

  btn.disabled = false;
  btn.textContent = isSignup ? 'Sign Up' : 'Login';

  if (error) return alert(error.message);
  location.href = 'home.html';
}

function toggleMode() {
  isSignup = !isSignup;
  document.getElementById('login-title').textContent = isSignup ? 'Sign Up' : 'Login';
  document.getElementById('login-btn').textContent = isSignup ? 'Sign Up' : 'Login';
  document.getElementById('switch-text').textContent = isSignup ? 'Already have account?' : 'New user?';
  document.getElementById('switch-btn').textContent = isSignup ? 'Login' : 'Sign Up';
    }
