/* Daily Posts — shared logic.
   Rule: a post lives exactly 24 hours. uploadedAt is the upload time (ISO).
   - The feed hides anything older than 24h the moment the page loads.
   - A GitHub Action (cleanup.yml) deletes the expired files + manifest entries
     from the repo every hour, so they are truly gone, not just hidden.
*/

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PER_DAY = 10;

function isExpired(post) {
  return Date.now() - new Date(post.uploadedAt).getTime() >= DAY_MS;
}
function timeLeft(post) {
  const left = DAY_MS - (Date.now() - new Date(post.uploadedAt).getTime());
  if (left <= 0) return 'expired';
  const h = Math.floor(left / 3600000);
  const m = Math.floor((left % 3600000) / 60000);
  return h > 0 ? h + 'h ' + m + 'm left' : m + 'm left';
}
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function todayCount(posts) {
  const today = new Date().toDateString();
  return posts.filter(p => new Date(p.uploadedAt).toDateString() === today).length;
}

async function loadPosts() {
  const res = await fetch('posts.json', { cache: 'no-store' });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/* ---------- Feed page ---------- */
async function renderFeed(el) {
  let posts = [];
  try { posts = await loadPosts(); } catch (e) { /* offline / first run */ }
  const live = posts
    .filter(p => !isExpired(p))
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

  if (!live.length) {
    el.innerHTML = '<p class="empty">No posts right now. Today\'s posts will appear here as soon as they are uploaded — and vanish 24 hours later.</p>';
    return;
  }
  el.innerHTML = live.map((p, i) => `
    <article class="post" data-idx="${i}">
      <div class="card-photo">
        <a href="${escapeHtml(p.file)}" target="_blank" rel="noopener"><img src="${escapeHtml(p.file)}" alt="" loading="lazy"></a>
        <div class="headline">${escapeHtml(p.title || '')}</div>
        <div class="wordmark"><span>DAILY&nbsp;POSTS</span></div>
      </div>
      <div class="body">
        <p class="caption">${escapeHtml(p.caption || '')}</p>
        <div class="meta">
          <span class="left">${timeLeft(p)}</span>
          <span>${new Date(p.uploadedAt).toLocaleString()}</span>
        </div>
        <div class="actions">
          <a href="${escapeHtml(p.file)}" download><button type="button">Download Photo</button></a>
          <button type="button" data-act="copy-title">Copy Title</button>
          <button type="button" data-act="copy-caption">Copy Caption</button>
          <button type="button" class="danger" data-act="delete">Delete</button>
        </div>
      </div>
    </article>`).join('');

  el.querySelectorAll('.post').forEach((card, i) => {
    const p = live[i];
    card.querySelector('[data-act="copy-title"]').onclick = () => copyText(p.title || '');
    card.querySelector('[data-act="copy-caption"]').onclick = () => copyText(p.caption || '');
    card.querySelector('[data-act="delete"]').onclick = async (ev) => {
      if (!confirm('Delete this post now?')) return;
      ev.target.disabled = true;
      ev.target.textContent = 'Deleting…';
      try { await deletePost(p); renderFeed(el); }
      catch (e) { alert('Delete needs the GitHub token — set it up on the upload page first. (' + e.message + ')'); ev.target.disabled = false; ev.target.textContent = 'Delete'; }
    };
  });
  // Refresh the countdowns every minute while the page is open.
  setInterval(() => renderFeed(el), 60000);
}

async function copyText(t) {
  try { await navigator.clipboard.writeText(t); }
  catch (e) {
    const ta = document.createElement('textarea');
    ta.value = t; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove();
  }
}

/* Delete one post right now (photo file + manifest entry) via the GitHub API. */
async function deletePost(post) {
  const { owner, repo, token } = gh();
  if (!owner || !repo || !token) throw new Error('no token saved');
  const manifest = await ghApi('posts.json', 'GET');
  const posts = JSON.parse(atob(manifest.content.replace(/\n/g, '')));
  const rest = posts.filter(x => x.file !== post.file);
  const fileInfo = await ghApi(post.file, 'GET');
  await ghApi(post.file, 'DELETE', { message: 'Delete post ' + post.file, sha: fileInfo.sha });
  const updated = btoa(unescape(encodeURIComponent(JSON.stringify(rest, null, 2))));
  await ghApi('posts.json', 'PUT', { message: 'Remove deleted post', content: updated, sha: manifest.sha });
}

/* ---------- Upload page ---------- */
function gh() {
  return {
    owner: localStorage.getItem('dp_owner') || '',
    repo: localStorage.getItem('dp_repo') || '',
    token: localStorage.getItem('dp_token') || ''
  };
}
async function ghApi(path, method, body) {
  const { owner, repo, token } = gh();
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    method,
    headers: {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(res.status + ' — ' + t.slice(0, 200));
  }
  return res.json();
}
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function initUploadPage() {
  const setupCard = document.getElementById('setup-card');
  const uploadCard = document.getElementById('upload-card');
  const statusEl = document.getElementById('setup-status');
  const { owner, repo, token } = gh();
  if (owner) document.getElementById('owner').value = owner;
  if (repo) document.getElementById('repo').value = repo;
  if (token) document.getElementById('token').value = token;

  document.getElementById('save-setup').onclick = async () => {
    const o = document.getElementById('owner').value.trim();
    const r = document.getElementById('repo').value.trim();
    const t = document.getElementById('token').value.trim();
    if (!o || !r || !t) { statusEl.textContent = 'Please fill owner, repo and token.'; statusEl.className = 'status err'; return; }
    localStorage.setItem('dp_owner', o);
    localStorage.setItem('dp_repo', r);
    localStorage.setItem('dp_token', t);
    statusEl.textContent = 'Checking…';
    try {
      await ghApi('posts.json', 'GET');
      statusEl.textContent = 'Connected. You can upload now.';
      statusEl.className = 'status ok';
      setupCard.hidden = true;
      uploadCard.hidden = false;
      buildSlots();
    } catch (e) {
      statusEl.textContent = 'Could not reach the repo: ' + e.message + ' — check owner, repo name and token.';
      statusEl.className = 'status err';
    }
  };

  if (owner && repo && token) {
    setupCard.hidden = true;
    uploadCard.hidden = false;
    buildSlots();
  }

  async function buildSlots() {
    const slotsEl = document.getElementById('slots');
    const countEl = document.getElementById('today-count');
    let posts = [];
    try { posts = await loadPosts(); } catch (e) {}
    const done = todayCount(posts);
    const remaining = MAX_PER_DAY - done;
    countEl.textContent = done + ' / ' + MAX_PER_DAY;
    slotsEl.innerHTML = '';
    if (remaining <= 0) {
      slotsEl.innerHTML = '<p class="status">Today\'s 10 posts are done. Come back tomorrow.</p>';
      document.getElementById('upload-all').disabled = true;
      return;
    }
    for (let i = 0; i < remaining; i++) {
      const div = document.createElement('div');
      div.className = 'slot';
      div.innerHTML = `
        <strong>Post ${i + 1}</strong>
        <input type="file" accept="image/*" class="file">
        <img hidden>
        <p class="name"></p>
        <input type="text" class="ttl" placeholder="Title — big headline on the photo, e.g. ROBERT PATTINSON IS THE NEW JAMES BOND">
        <textarea class="cap" placeholder="Caption — write it here"></textarea>`;
      const fileInput = div.querySelector('.file');
      const img = div.querySelector('img');
      fileInput.onchange = () => {
        const f = fileInput.files[0];
        if (!f) return;
        div.querySelector('.name').textContent = f.name + ' (' + (f.size / 1048576).toFixed(1) + ' MB)';
        img.src = URL.createObjectURL(f);
        img.hidden = false;
      };
      slotsEl.appendChild(div);
    }
  }

  document.getElementById('upload-all').onclick = async () => {
    const btn = document.getElementById('upload-all');
    const status = document.getElementById('upload-status');
    const slots = [...document.querySelectorAll('.slot')];
    const jobs = slots.map(s => ({
      file: s.querySelector('.file').files[0],
      title: s.querySelector('.ttl').value.trim(),
      caption: s.querySelector('.cap').value.trim()
    })).filter(j => j.file);
    if (!jobs.length) { status.textContent = 'Pick at least one photo first.'; status.className = 'status err'; return; }
    btn.disabled = true;
    status.textContent = 'Uploading ' + jobs.length + ' post(s)… do not close this page.';
    status.className = 'status';
    try {
      // Read the current manifest (with its sha, so we can update it).
      const manifest = await ghApi('posts.json', 'GET');
      const posts = JSON.parse(atob(manifest.content.replace(/\n/g, '')));
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      for (let i = 0; i < jobs.length; i++) {
        const j = jobs[i];
        const ext = (j.file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
        const path = `posts/${stamp}-${i + 1}.${ext}`;
        const b64 = await fileToBase64(j.file);
        await ghApi(path, 'PUT', { message: 'Add post ' + path, content: b64 });
        posts.push({ file: path, title: j.title, caption: j.caption, uploadedAt: new Date().toISOString() });
        status.textContent = 'Uploaded ' + (i + 1) + ' of ' + jobs.length + '…';
      }
      const updated = btoa(unescape(encodeURIComponent(JSON.stringify(posts, null, 2))));
      await ghApi('posts.json', 'PUT', { message: 'Update posts manifest', content: updated, sha: manifest.sha });
      status.textContent = 'Done! ' + jobs.length + ' post(s) live. Each one will delete itself 24 hours from now.';
      status.className = 'status ok';
      buildSlots();
    } catch (e) {
      status.textContent = 'Upload failed: ' + e.message;
      status.className = 'status err';
    }
    btn.disabled = false;
  };
}
