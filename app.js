/* ============================================
   鑑賞記録アプリ — app.js
   ============================================ */

// --- 定数 ---
const MEDIUM_OPTIONS = ['映画', 'テレビ', 'ウェブサイト', '書籍', '音楽', 'その他'];
const GENRE_OPTIONS = ['アニメーション', '実写', 'ゲーム', 'ドキュメンタリー', 'その他'];
const RATINGS = ['普通', '良い', '最高', '人生'];
const STORAGE_KEY = 'appreciation_records_v2';

// --- State ---
let records = [];
let sortBy = 'createdAt';
let sortOrder = 'desc';
let expandedIds = new Set();
let editingId = null;

// --- DOM refs ---
const $ = (sel) => document.querySelector(sel);
const form = $('#record-form');
const recordsList = $('#records-list');
const recordCount = $('#record-count');
const sortBySelect = $('#sort-by');
const sortOrderBtn = $('#sort-order-btn');
const downloadAllBtn = $('#download-all-btn');
const fileInput = $('#file-input');
const ratingSlider = $('#rating');
const ratingLabel = $('#rating-label');

// --- Helpers ---
const todayString = () => new Date().toISOString().split('T')[0];

function loadRecords() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) records = JSON.parse(saved);
    } catch (e) {
        console.error('Failed to parse records', e);
    }
}

function saveRecords() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function downloadFile(content, filename) {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function generateMarkdown(record) {
    return `# ${record.title || '無題'}

- **媒体**: ${record.medium}
- **ジャンル**: ${record.genre}
- **鑑賞日**: ${record.date || '未設定'}
- **評価**: ${RATINGS[record.rating]}
- **場所**: ${record.location}
- **タグ**: ${record.tags}

## 内容
${record.content}
`;
}

function parseMarkdown(text) {
    const blocks = text.split('\n---\n\n').filter(b => b.trim());
    return blocks.map(block => {
        const record = { id: crypto.randomUUID(), createdAt: new Date().toISOString() };

        const m = (regex) => { const r = block.match(regex); return r ? r[1].trim() : null; };

        record.title = m(/^# (.*)/m) || '無題';
        record.medium = m(/- \*\*媒体\*\*: (.*)/) || MEDIUM_OPTIONS[0];
        record.genre = m(/- \*\*ジャンル\*\*: (.*)/) || GENRE_OPTIONS[0];
        const dateVal = m(/- \*\*鑑賞日\*\*: (.*)/);
        record.date = dateVal && dateVal !== '未設定' ? dateVal : todayString();
        const ratingVal = m(/- \*\*評価\*\*: (.*)/);
        record.rating = ratingVal && RATINGS.indexOf(ratingVal) !== -1 ? RATINGS.indexOf(ratingVal) : 0;
        record.location = m(/- \*\*場所\*\*: (.*)/) || '';
        record.tags = m(/- \*\*タグ\*\*: (.*)/) || '';
        const contentM = block.match(/## 内容\n([\s\S]*)/);
        record.content = contentM ? contentM[1].trim() : '';

        return record;
    });
}


// --- Icon helper (Lucide) ---
function icon(name) {
    return `<i data-lucide="${name}" class="btn-icon"></i>`;
}

function refreshIcons() {
    if (window.lucide) lucide.createIcons();
}


// --- Rendering ---
function getSortedRecords() {
    return [...records].sort((a, b) => {
        let vA = a[sortBy];
        let vB = b[sortBy];

        if (sortBy === 'rating') {
            vA = Number(vA || 0);
            vB = Number(vB || 0);
        } else {
            vA = String(vA || '');
            vB = String(vB || '');
        }

        if (vA < vB) return sortOrder === 'asc' ? -1 : 1;
        if (vA > vB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
    });
}

function renderRecords() {
    const sorted = getSortedRecords();
    recordCount.textContent = `(${records.length})`;
    downloadAllBtn.disabled = records.length === 0;

    if (sorted.length === 0) {
        recordsList.innerHTML = '<p class="records-empty">記録がありません。</p>';
        refreshIcons();
        return;
    }

    recordsList.innerHTML = sorted.map(r => {
        // 編集モード判定
        if (editingId === r.id) return renderEditForm(r);

        const isExpanded = expandedIds.has(r.id);
        const contentClass = isExpanded ? 'record-content record-content--expanded' : 'record-content';

        return `
    <div class="record-card" data-id="${r.id}">
      <div class="record-header">
        <h3 class="record-title">${escapeHtml(r.title)}</h3>
        <span class="badge">${RATINGS[r.rating]}</span>
      </div>
      <div class="record-meta">
        <p><span class="record-meta-label">鑑賞日:</span> ${r.date || '未設定'}</p>
        <p><span class="record-meta-label">ジャンル:</span> ${escapeHtml(r.genre)}</p>
        <p><span class="record-meta-label">媒体:</span> ${escapeHtml(r.medium)}</p>
        ${r.location ? `<p><span class="record-meta-label">場所:</span> ${escapeHtml(r.location)}</p>` : ''}
        ${r.tags ? `<p class="full-width"><span class="record-meta-label">タグ:</span> ${escapeHtml(r.tags)}</p>` : ''}
      </div>
      ${r.content ? `
        <p class="${contentClass} js-toggle-content" data-id="${r.id}">${escapeHtml(r.content)}</p>
        <button class="btn-expand js-toggle-content" data-id="${r.id}">
          ${isExpanded ? '折りたたむ' : '続きを読む'}
          ${isExpanded ? icon('chevron-up') : icon('chevron-down')}
        </button>
      ` : ''}
      <div class="record-actions">
        <button class="btn btn-ghost js-edit" data-id="${r.id}" title="編集">
          ${icon('pencil')}編集
        </button>
        <button class="btn btn-ghost js-download" data-id="${r.id}" title="個別保存">
          ${icon('download')}保存
        </button>
        <button class="btn btn-danger js-delete" data-id="${r.id}" title="削除">
          ${icon('trash-2')}削除
        </button>
      </div>
    </div>`;
    }).join('');

    refreshIcons();
}

function escapeHtml(str) {
    if (!str) return '';
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
}

// --- Inline Edit Form ---
function renderEditForm(r) {
    const mediumOpts = MEDIUM_OPTIONS.map(o =>
        `<option value="${o}"${o === r.medium ? ' selected' : ''}>${o}</option>`
    ).join('');
    const genreOpts = GENRE_OPTIONS.map(o =>
        `<option value="${o}"${o === r.genre ? ' selected' : ''}>${o}</option>`
    ).join('');

    return `
    <div class="record-card record-card--editing" data-id="${r.id}">
      <form class="edit-form space-y" data-id="${r.id}">
        <div class="form-group">
          <label class="form-label">タイトル</label>
          <input class="form-input" name="title" value="${escapeHtml(r.title)}" required>
        </div>
        <div class="grid-2col">
          <div class="form-group">
            <label class="form-label">媒体</label>
            <select class="form-select" name="medium">${mediumOpts}</select>
          </div>
          <div class="form-group">
            <label class="form-label">ジャンル</label>
            <select class="form-select" name="genre">${genreOpts}</select>
          </div>
        </div>
        <div class="grid-2col">
          <div class="form-group">
            <label class="form-label">鑑賞日</label>
            <input class="form-input" type="date" name="date" value="${r.date || ''}">
          </div>
          <div class="form-group">
            <label class="form-label">評価: <span class="text-bold js-edit-rating-label">${RATINGS[r.rating]}</span></label>
            <input class="form-range js-edit-rating" type="range" name="rating" min="0" max="3" step="1" value="${r.rating}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">場所</label>
          <input class="form-input" name="location" value="${escapeHtml(r.location)}">
        </div>
        <div class="form-group">
          <label class="form-label">タグ</label>
          <input class="form-input" name="tags" value="${escapeHtml(r.tags)}">
        </div>
        <div class="form-group">
          <label class="form-label">内容</label>
          <textarea class="form-textarea" name="content" rows="5">${escapeHtml(r.content)}</textarea>
        </div>
        <div class="edit-form-actions">
          <button type="button" class="btn btn-secondary js-edit-cancel">キャンセル</button>
          <button type="submit" class="btn btn-primary">${icon('save')}更新</button>
        </div>
      </form>
    </div>`;
}


// --- Event Handlers ---
function handleFormSubmit(e) {
    e.preventDefault();
    const fd = new FormData(form);
    const newRecord = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        title: fd.get('title'),
        medium: fd.get('medium'),
        genre: fd.get('genre'),
        date: fd.get('date'),
        rating: parseInt(fd.get('rating'), 10),
        location: fd.get('location'),
        tags: fd.get('tags'),
        content: fd.get('content')
    };

    records.unshift(newRecord);
    saveRecords();
    renderRecords();

    // Reset form but keep medium/genre
    form.querySelector('[name="title"]').value = '';
    form.querySelector('[name="location"]').value = '';
    form.querySelector('[name="tags"]').value = '';
    form.querySelector('[name="content"]').value = '';
    ratingSlider.value = 0;
    ratingLabel.textContent = RATINGS[0];
    form.querySelector('[name="date"]').value = todayString();
}

function handleRecordAction(e) {
    const downloadBtn = e.target.closest('.js-download');
    const deleteBtn = e.target.closest('.js-delete');
    const editBtn = e.target.closest('.js-edit');
    const toggleBtn = e.target.closest('.js-toggle-content');
    const cancelBtn = e.target.closest('.js-edit-cancel');

    // --- 展開/折りたたみ ---
    if (toggleBtn) {
        const id = toggleBtn.dataset.id;
        if (expandedIds.has(id)) expandedIds.delete(id);
        else expandedIds.add(id);
        renderRecords();
        return;
    }

    // --- 編集開始 ---
    if (editBtn) {
        editingId = editBtn.dataset.id;
        renderRecords();
        // 編集フォーム内のratinスライダーにイベント追加
        const editSlider = recordsList.querySelector('.js-edit-rating');
        if (editSlider) {
            editSlider.addEventListener('input', () => {
                const label = recordsList.querySelector('.js-edit-rating-label');
                if (label) label.textContent = RATINGS[editSlider.value];
            });
        }
        return;
    }

    // --- 編集キャンセル ---
    if (cancelBtn) {
        editingId = null;
        renderRecords();
        return;
    }

    // --- 編集フォーム送信 (submit) ---
    const editForm = e.target.closest('.edit-form');
    if (editForm && e.type === 'submit') return; // handled separately

    // --- ダウンロード ---
    if (downloadBtn) {
        const id = downloadBtn.dataset.id;
        const record = records.find(r => r.id === id);
        if (record) {
            const content = generateMarkdown(record);
            const title = record.title || '無題';
            const medium = record.medium || '';
            const genre = record.genre || '';
            const filename = `${title}_${medium}_${genre}.md`;
            downloadFile(content, filename);
        }
    }

    // --- 削除 ---
    if (deleteBtn) {
        const id = deleteBtn.dataset.id;
        records = records.filter(r => r.id !== id);
        expandedIds.delete(id);
        if (editingId === id) editingId = null;
        saveRecords();
        renderRecords();
    }
}

// --- 編集フォーム送信ハンドラ ---
function handleEditSubmit(e) {
    const editForm = e.target.closest('.edit-form');
    if (!editForm) return;
    e.preventDefault();

    const id = editForm.dataset.id;
    const idx = records.findIndex(r => r.id === id);
    if (idx === -1) return;

    const fd = new FormData(editForm);
    records[idx] = {
        ...records[idx],
        title: fd.get('title'),
        medium: fd.get('medium'),
        genre: fd.get('genre'),
        date: fd.get('date'),
        rating: parseInt(fd.get('rating'), 10),
        location: fd.get('location'),
        tags: fd.get('tags'),
        content: fd.get('content')
    };

    editingId = null;
    saveRecords();
    renderRecords();
}

function handleDownloadAll() {
    if (records.length === 0) return;
    const content = records.map(generateMarkdown).join('\n---\n\n');
    const filename = `all_records_${new Date().toISOString().slice(0, 10)}.md`;
    downloadFile(content, filename);
}

function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const imported = parseMarkdown(event.target.result);
        if (imported.length > 0) {
            records = [...imported, ...records];
            saveRecords();
            renderRecords();
        }
        fileInput.value = '';
    };
    reader.readAsText(file);
}

function handleSortChange() {
    sortBy = sortBySelect.value;
    renderRecords();
}

function handleSortOrderToggle() {
    sortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
    renderRecords();
}

function handleRatingChange() {
    ratingLabel.textContent = RATINGS[ratingSlider.value];
}


// --- Initialization ---
function init() {
    // Populate select options
    populateSelect($('#medium'), MEDIUM_OPTIONS);
    populateSelect($('#genre'), GENRE_OPTIONS);

    // Set default date
    form.querySelector('[name="date"]').value = todayString();

    // Load data
    loadRecords();
    renderRecords();

    // Event listeners
    form.addEventListener('submit', handleFormSubmit);
    recordsList.addEventListener('click', handleRecordAction);
    recordsList.addEventListener('submit', handleEditSubmit);
    sortBySelect.addEventListener('change', handleSortChange);
    sortOrderBtn.addEventListener('click', handleSortOrderToggle);
    downloadAllBtn.addEventListener('click', handleDownloadAll);
    fileInput.addEventListener('change', handleFileUpload);
    ratingSlider.addEventListener('input', handleRatingChange);

    refreshIcons();
}

function populateSelect(selectEl, options) {
    selectEl.innerHTML = options.map(opt =>
        `<option value="${opt}">${opt}</option>`
    ).join('');
}

// --- Service Worker Registration ---
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW registered:', reg.scope))
            .catch(err => console.error('SW registration failed:', err));
    }
}

// --- Boot ---
document.addEventListener('DOMContentLoaded', () => {
    init();
    registerServiceWorker();
});
