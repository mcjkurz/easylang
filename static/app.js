const searchBtn = document.getElementById('searchBtn');
const phraseInput = document.getElementById('phraseInput');
const numExamples = document.getElementById('numExamples');
const sourceLanguage = document.getElementById('sourceLanguage');
const results = document.getElementById('results');
const resultsContent = document.getElementById('resultsContent');
const languagesGrid = document.getElementById('languagesGrid');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const savedBtn = document.getElementById('savedBtn');
const savedPanel = document.getElementById('savedPanel');
const savedList = document.getElementById('savedList');
const savedCount = document.getElementById('savedCount');
const savedEmpty = document.getElementById('savedEmpty');
const clearSavedBtn = document.getElementById('clearSavedBtn');
const modelSelect = document.getElementById('modelSelect');

const DEFAULT_LANGUAGES = ["Chinese", "English", "French", "German", "Polish", "Russian"];
const DEFAULT_MODELS = [
    'Claude-Haiku-4.5',
    'Claude-Opus-4.8',
    'Claude-Sonnet-4.6',
    'Gemini-3.1-Flash-Lite',
    'Gemini-3.5-Flash-Lite',
    'Gemini-3.7-Flash',
    'GPT-5.4',
    'GPT-5.4-Mini',
    'GPT-5.4-Nano',
    'Grok-4.1-Fast-Reasoning',
    'Grok-4.6',
    'MiMo-V2-Flash',
];
const DEFAULT_MODEL = 'GPT-5.4-Mini';
const STORAGE_KEY = 'easylang_languages';
const MODEL_STORAGE_KEY = 'easylang_model';
const SAVED_KEY = 'easylang_saved_sentences';
const EXPLAIN_CACHE_KEY = 'easylang_explain_cache';
const DIFFICULTY_LABELS = ['Easy', 'Medium', 'Hard', 'Advanced', 'Expert', 'Native', 'Literary'];

let lastQuery = '';

function getStoredModel() {
    return localStorage.getItem(MODEL_STORAGE_KEY) || DEFAULT_MODEL;
}

function saveModel(model) {
    localStorage.setItem(MODEL_STORAGE_KEY, model);
}

function populateModelSelect(models, defaultModel) {
    const sorted = [...new Set(models)].sort((a, b) =>
        a.localeCompare(b, undefined, { sensitivity: 'base' })
    );
    const saved = getStoredModel();
    const selected = sorted.includes(saved) ? saved : defaultModel;
    modelSelect.innerHTML = sorted.map(m =>
        `<option value="${escapeHtml(m)}"${m === selected ? ' selected' : ''}>${escapeHtml(m)}</option>`
    ).join('');
    if (selected !== saved) {
        saveModel(selected);
    }
}

async function initSettings() {
    let models = DEFAULT_MODELS;
    let defaultModel = DEFAULT_MODEL;
    try {
        const response = await fetch('/models');
        if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data.models) && data.models.length) {
                models = data.models;
            }
            if (data.default) {
                defaultModel = data.default;
            }
        }
    } catch (e) {
        // Fall back to client defaults
    }
    populateModelSelect(models, defaultModel);
}

function setPanelOpen(panel, btn, open) {
    panel.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

settingsBtn.addEventListener('click', () => {
    const open = settingsPanel.hidden;
    setPanelOpen(settingsPanel, settingsBtn, open);
    if (open) setPanelOpen(savedPanel, savedBtn, false);
});

savedBtn.addEventListener('click', () => {
    const open = savedPanel.hidden;
    setPanelOpen(savedPanel, savedBtn, open);
    if (open) {
        setPanelOpen(settingsPanel, settingsBtn, false);
        renderSavedList();
    }
});

modelSelect.addEventListener('change', () => {
    saveModel(modelSelect.value);
});

// Language name → Google Translate code
const GT_LANG_CODES = {
    'english': 'en',
    'chinese': 'zh-CN',
    'mandarin': 'zh-CN',
    'simplified chinese': 'zh-CN',
    'traditional chinese': 'zh-TW',
    'cantonese': 'zh-TW',
    'spanish': 'es',
    'french': 'fr',
    'german': 'de',
    'italian': 'it',
    'portuguese': 'pt',
    'brazilian portuguese': 'pt',
    'russian': 'ru',
    'japanese': 'ja',
    'korean': 'ko',
    'arabic': 'ar',
    'hindi': 'hi',
    'polish': 'pl',
    'dutch': 'nl',
    'swedish': 'sv',
    'norwegian': 'no',
    'danish': 'da',
    'finnish': 'fi',
    'greek': 'el',
    'turkish': 'tr',
    'czech': 'cs',
    'slovak': 'sk',
    'hungarian': 'hu',
    'romanian': 'ro',
    'bulgarian': 'bg',
    'croatian': 'hr',
    'serbian': 'sr',
    'slovenian': 'sl',
    'ukrainian': 'uk',
    'lithuanian': 'lt',
    'latvian': 'lv',
    'estonian': 'et',
    'icelandic': 'is',
    'catalan': 'ca',
    'thai': 'th',
    'vietnamese': 'vi',
    'indonesian': 'id',
    'malay': 'ms',
    'tagalog': 'tl',
    'filipino': 'tl',
    'hebrew': 'iw',
    'persian': 'fa',
    'farsi': 'fa',
    'swahili': 'sw',
    'esperanto': 'eo',
    'latin': 'la',
};

function getGtLangCode(langName) {
    if (!langName) return 'auto';
    const normalized = langName.toLowerCase().trim();
    if (GT_LANG_CODES[normalized]) return GT_LANG_CODES[normalized];
    for (const [key, code] of Object.entries(GT_LANG_CODES)) {
        if (key.includes(normalized) || normalized.includes(key)) {
            return code;
        }
    }
    return 'auto';
}

function googleTranslateUrl(text, fromLang, toLang) {
    const sl = getGtLangCode(fromLang);
    const tl = getGtLangCode(toLang) === 'auto' ? 'en' : getGtLangCode(toLang);
    const params = new URLSearchParams({
        sl,
        tl,
        text,
        op: 'translate',
    });
    return `https://translate.google.com/?${params.toString()}`;
}

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function getStoredLanguages() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            return [...DEFAULT_LANGUAGES];
        }
    }
    return [...DEFAULT_LANGUAGES];
}

function saveLanguages(languages) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(languages));
}

let languages = getStoredLanguages();

function renderLanguages() {
    languagesGrid.innerHTML = '';
    
    languages.forEach((lang, index) => {
        const div = document.createElement('div');
        div.className = 'lang-item';
        div.innerHTML = `
            <input type="checkbox" class="lang-checkbox" id="lang-${index}" value="${lang}" checked>
            <label class="lang-label" for="lang-${index}">
                ${lang}
                <button type="button" class="lang-remove" data-index="${index}" title="Remove ${lang}">×</button>
            </label>
        `;
        languagesGrid.appendChild(div);
    });

    const addWrapper = document.createElement('div');
    addWrapper.className = 'add-lang-wrapper';
    addWrapper.innerHTML = `
        <button type="button" class="add-lang-btn" id="addLangBtn">+ Add</button>
        <div class="add-lang-input-wrapper" id="addLangInputWrapper">
            <input type="text" class="add-lang-input" id="addLangInput" placeholder="e.g. Spanish">
            <button type="button" class="add-lang-confirm" id="addLangConfirm">Add</button>
            <button type="button" class="add-lang-cancel" id="addLangCancel">Cancel</button>
        </div>
    `;
    languagesGrid.appendChild(addWrapper);

    attachLanguageHandlers();
}

function attachLanguageHandlers() {
    document.querySelectorAll('.lang-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const index = parseInt(btn.dataset.index);
            if (languages.length > 1) {
                languages.splice(index, 1);
                saveLanguages(languages);
                renderLanguages();
            } else {
                alert('You need at least one language');
            }
        });
    });

    const addLangBtn = document.getElementById('addLangBtn');
    const addLangInputWrapper = document.getElementById('addLangInputWrapper');
    const addLangInput = document.getElementById('addLangInput');
    const addLangConfirm = document.getElementById('addLangConfirm');
    const addLangCancel = document.getElementById('addLangCancel');

    addLangBtn.addEventListener('click', () => {
        addLangBtn.style.display = 'none';
        addLangInputWrapper.classList.add('visible');
        addLangInput.focus();
    });

    function addNewLanguage() {
        const newLang = addLangInput.value.trim();
        if (newLang) {
            const formatted = newLang.charAt(0).toUpperCase() + newLang.slice(1).toLowerCase();
            if (!languages.includes(formatted)) {
                languages.push(formatted);
                saveLanguages(languages);
            }
        }
        addLangInput.value = '';
        addLangBtn.style.display = '';
        addLangInputWrapper.classList.remove('visible');
        renderLanguages();
    }

    addLangConfirm.addEventListener('click', addNewLanguage);
    
    addLangInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addNewLanguage();
        }
    });

    addLangCancel.addEventListener('click', () => {
        addLangInput.value = '';
        addLangBtn.style.display = '';
        addLangInputWrapper.classList.remove('visible');
    });
}

function getSelectedLanguages() {
    const checkboxes = document.querySelectorAll('.lang-checkbox:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

const GT_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12.87 15.07l-2.54-2.51.03-.03A17.5 17.5 0 0 0 14.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>`;
const EXPLAIN_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm2.85 11.1l-.85.6V16h-4v-2.3l-.85-.6A4.997 4.997 0 0 1 7 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.63-.8 3.16-2.15 4.1z"/></svg>`;
const BOOKMARK_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z"/></svg>`;
const BOOKMARK_FILLED_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>`;

/* ---------- Saved sentences ---------- */

function getSavedSentences() {
    try {
        const raw = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
        return Array.isArray(raw) ? raw : [];
    } catch (e) {
        return [];
    }
}

function writeSavedSentences(items) {
    localStorage.setItem(SAVED_KEY, JSON.stringify(items));
    updateSavedCount();
}

function updateSavedCount() {
    const count = getSavedSentences().length;
    savedCount.textContent = String(count);
    savedCount.hidden = count === 0;
    clearSavedBtn.hidden = count === 0;
}

function findSaved(language, sentence) {
    return getSavedSentences().find(
        (item) => item.language === language && item.sentence === sentence
    ) || null;
}

function isSaved(language, sentence) {
    return Boolean(findSaved(language, sentence));
}

function makeId() {
    return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function saveSentence(entry) {
    const items = getSavedSentences();
    const existing = items.findIndex(
        (item) => item.language === entry.language && item.sentence === entry.sentence
    );
    if (existing >= 0) return items[existing];

    const saved = {
        id: makeId(),
        sentence: entry.sentence,
        language: entry.language,
        difficulty: entry.difficulty || '',
        query: entry.query || '',
        siblings: Array.isArray(entry.siblings) ? entry.siblings : [],
        savedAt: new Date().toISOString(),
    };
    items.unshift(saved);
    writeSavedSentences(items);
    return saved;
}

function removeSavedById(id) {
    writeSavedSentences(getSavedSentences().filter((item) => item.id !== id));
}

function removeSavedBySentence(language, sentence) {
    writeSavedSentences(
        getSavedSentences().filter(
            (item) => !(item.language === language && item.sentence === sentence)
        )
    );
}

function formatSavedDate(iso) {
    try {
        const d = new Date(iso);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (e) {
        return '';
    }
}

function renderSavedList() {
    const items = getSavedSentences();
    savedEmpty.hidden = items.length > 0;
    clearSavedBtn.hidden = items.length === 0;

    if (!items.length) {
        savedList.innerHTML = '';
        return;
    }

    savedList.innerHTML = items.map((item) => `
        <div class="saved-item" data-id="${escapeHtml(item.id)}" role="button" tabindex="0">
            <div class="saved-item-main">
                <div class="saved-item-meta">
                    <span class="lang-badge">${escapeHtml(item.language)}</span>
                    ${item.difficulty ? `<span class="saved-item-difficulty">${escapeHtml(item.difficulty)}</span>` : ''}
                    <span class="saved-item-date">${escapeHtml(formatSavedDate(item.savedAt))}</span>
                </div>
                <div class="saved-item-sentence">${escapeHtml(item.sentence)}</div>
                ${item.query ? `<div class="saved-item-query">From: ${escapeHtml(item.query)}</div>` : ''}
            </div>
            <button type="button" class="saved-item-remove" data-remove-id="${escapeHtml(item.id)}" title="Remove" aria-label="Remove saved sentence">×</button>
        </div>
    `).join('');
}

function renderLangRow(lang, sentence, difficulty, siblings) {
    const translateTo = sourceLanguage.value || 'English';
    const gtUrl = googleTranslateUrl(sentence, lang, translateTo);
    const saved = isSaved(lang, sentence);
    const payload = escapeHtml(JSON.stringify({
        language: lang,
        sentence,
        difficulty: difficulty || '',
        query: lastQuery || '',
        siblings: siblings || [],
    }));

    return `
        <div class="lang-row">
            <span class="lang-badge">${escapeHtml(lang)}</span>
            <span class="lang-sentence">${escapeHtml(sentence)}</span>
            <span class="row-actions">
                <button type="button" class="icon-btn save-btn${saved ? ' saved' : ''}" data-save="${payload}" title="${saved ? 'Remove from saved' : 'Save for revision'}" aria-label="${saved ? 'Remove from saved' : 'Save for revision'}" aria-pressed="${saved ? 'true' : 'false'}">${saved ? BOOKMARK_FILLED_ICON : BOOKMARK_ICON}</button>
                <a class="icon-btn gt-link" href="${escapeHtml(gtUrl)}" target="_blank" rel="noopener noreferrer" title="Google Translate" aria-label="Google Translate">${GT_ICON}</a>
                <button type="button" class="icon-btn explain-btn" data-lang="${escapeHtml(lang)}" data-sentence="${escapeHtml(sentence)}" title="Explain grammar" aria-label="Explain grammar">${EXPLAIN_ICON}</button>
            </span>
        </div>
    `;
}

function renderExampleBlock(title, rows, focusLanguage) {
    const siblings = rows.map((r) => ({ language: r.language, sentence: r.sentence }));
    let html = `<div class="sentence-block">`;
    html += `<div class="sentence-title">${escapeHtml(title)}</div>`;

    const ordered = focusLanguage
        ? [
            ...rows.filter((r) => r.language === focusLanguage),
            ...rows.filter((r) => r.language !== focusLanguage),
          ]
        : rows;

    for (const row of ordered) {
        html += renderLangRow(row.language, row.sentence, title, siblings);
    }
    html += `</div>`;
    return html;
}

function openSavedExample(item) {
    const siblings = Array.isArray(item.siblings) && item.siblings.length
        ? item.siblings
        : [{ language: item.language, sentence: item.sentence }];

    // Ensure the focused sentence is present
    if (!siblings.some((s) => s.language === item.language && s.sentence === item.sentence)) {
        siblings.unshift({ language: item.language, sentence: item.sentence });
    }

    lastQuery = item.query || '';
    const title = item.difficulty || 'Saved';
    let html = '';
    if (item.query) {
        html += `<div class="results-subheader">Saved example from “${escapeHtml(item.query)}”</div>`;
    } else {
        html += `<div class="results-subheader">Saved example</div>`;
    }
    html += renderExampleBlock(title, siblings, item.language);

    results.classList.add('visible');
    resultsContent.innerHTML = html;
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setPanelOpen(savedPanel, savedBtn, false);
}

savedList.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-remove-id]');
    if (removeBtn) {
        e.preventDefault();
        e.stopPropagation();
        removeSavedById(removeBtn.dataset.removeId);
        renderSavedList();
        syncSaveButtons();
        return;
    }

    const itemEl = e.target.closest('.saved-item');
    if (!itemEl) return;
    const item = getSavedSentences().find((s) => s.id === itemEl.dataset.id);
    if (item) openSavedExample(item);
});

savedList.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const itemEl = e.target.closest('.saved-item');
    if (!itemEl || e.target.closest('[data-remove-id]')) return;
    e.preventDefault();
    const item = getSavedSentences().find((s) => s.id === itemEl.dataset.id);
    if (item) openSavedExample(item);
});

clearSavedBtn.addEventListener('click', () => {
    if (!getSavedSentences().length) return;
    if (!confirm('Clear all saved sentences?')) return;
    writeSavedSentences([]);
    renderSavedList();
    syncSaveButtons();
});

function syncSaveButtons() {
    document.querySelectorAll('.save-btn').forEach((btn) => {
        try {
            const data = JSON.parse(btn.dataset.save);
            const saved = isSaved(data.language, data.sentence);
            btn.classList.toggle('saved', saved);
            btn.setAttribute('aria-pressed', saved ? 'true' : 'false');
            btn.title = saved ? 'Remove from saved' : 'Save for revision';
            btn.setAttribute('aria-label', btn.title);
            btn.innerHTML = saved ? BOOKMARK_FILLED_ICON : BOOKMARK_ICON;
        } catch (e) {
            // ignore bad payloads
        }
    });
}

function formatMarkdown(text) {
    const escaped = escapeHtml(text || '');
    const lines = escaped.split('\n');
    const html = [];
    let inList = false;

    const inline = (line) => line
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>');

    const closeList = () => {
        if (inList) {
            html.push('</ul>');
            inList = false;
        }
    };

    for (const raw of lines) {
        const line = raw.trimEnd();
        const bullet = line.match(/^[-*•]\s+(.+)$/);
        const heading = line.match(/^#{1,3}\s+(.+)$/);

        if (bullet) {
            if (!inList) {
                html.push('<ul>');
                inList = true;
            }
            html.push(`<li>${inline(bullet[1])}</li>`);
            continue;
        }

        closeList();

        if (!line.trim()) {
            html.push('<br>');
            continue;
        }

        if (heading) {
            html.push(`<p class="md-heading">${inline(heading[1])}</p>`);
        } else {
            html.push(`<p>${inline(line)}</p>`);
        }
    }

    closeList();
    return html.join('');
}

function parseResults(text) {
    const difficultyPattern = DIFFICULTY_LABELS.map(l => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const headingSplit = new RegExp(
        `\\*\\*(?:(${difficultyPattern})|Sentence\\s*(\\d+))\\*\\*`,
        'gi'
    );

    const parts = text.split(headingSplit);
    let html = '';

    for (let i = 1; i < parts.length; i += 3) {
        const difficultyLabel = parts[i];
        const sentenceNum = parts[i + 1];
        const content = parts[i + 2] || '';
        const title = difficultyLabel
            ? difficultyLabel.charAt(0).toUpperCase() + difficultyLabel.slice(1).toLowerCase()
            : `Sentence ${sentenceNum}`;

        const langLines = content.match(/^[-•]\s*([^:]+):\s*(.+)$/gm) || [];
        const rows = [];
        for (const line of langLines) {
            const match = line.match(/^[-•]\s*([^:]+):\s*(.+)$/);
            if (match) {
                rows.push({ language: match[1].trim(), sentence: match[2].trim() });
            }
        }

        if (rows.length > 0) {
            html += renderExampleBlock(title, rows);
        }
    }

    if (!html) {
        html = escapeHtml(text).replace(/\n/g, '<br>');
    }

    return html;
}

const explainModal = document.getElementById('explainModal');
const explainModalSentence = document.getElementById('explainModalSentence');
const explainModalBody = document.getElementById('explainModalBody');
const explainModalClose = document.getElementById('explainModalClose');

function explainCacheKey(sentence, lang, explainIn) {
    return `${lang}\n${explainIn}\n${sentence}`;
}

function getCachedExplanation(sentence, lang, explainIn) {
    try {
        const cache = JSON.parse(localStorage.getItem(EXPLAIN_CACHE_KEY) || '{}');
        return cache[explainCacheKey(sentence, lang, explainIn)] || null;
    } catch (e) {
        return null;
    }
}

function setCachedExplanation(sentence, lang, explainIn, explanation) {
    try {
        const cache = JSON.parse(localStorage.getItem(EXPLAIN_CACHE_KEY) || '{}');
        cache[explainCacheKey(sentence, lang, explainIn)] = explanation;
        localStorage.setItem(EXPLAIN_CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
        // Ignore quota / serialization errors
    }
}

function closeExplainModal() {
    explainModal.hidden = true;
    explainModalBody.innerHTML = '';
    explainModalSentence.textContent = '';
}

async function openExplainModal(sentence, lang) {
    const explainIn = sourceLanguage.value || 'English';
    explainModalSentence.textContent = sentence;
    explainModal.hidden = false;

    const cached = getCachedExplanation(sentence, lang, explainIn);
    if (cached) {
        explainModalBody.classList.remove('loading');
        explainModalBody.innerHTML = formatMarkdown(cached);
        return;
    }

    explainModalBody.classList.add('loading');
    explainModalBody.textContent = 'Explaining';

    try {
        const response = await fetch('/explain', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sentence,
                sentence_language: lang,
                explain_in: explainIn,
                model: modelSelect.value || getStoredModel(),
            }),
        });
        const data = await response.json();
        explainModalBody.classList.remove('loading');
        if (data.explanation) {
            setCachedExplanation(sentence, lang, explainIn, data.explanation);
            explainModalBody.innerHTML = formatMarkdown(data.explanation);
        } else {
            explainModalBody.textContent = data.error || 'No explanation available';
        }
    } catch (err) {
        explainModalBody.classList.remove('loading');
        explainModalBody.textContent = 'Failed to load explanation';
    }
}

resultsContent.addEventListener('click', (e) => {
    const saveBtn = e.target.closest('.save-btn');
    if (saveBtn) {
        try {
            const data = JSON.parse(saveBtn.dataset.save);
            if (isSaved(data.language, data.sentence)) {
                removeSavedBySentence(data.language, data.sentence);
            } else {
                saveSentence(data);
            }
            syncSaveButtons();
            if (!savedPanel.hidden) renderSavedList();
            else updateSavedCount();
        } catch (err) {
            console.warn('Could not toggle save', err);
        }
        return;
    }

    const btn = e.target.closest('.explain-btn');
    if (!btn) return;
    openExplainModal(btn.dataset.sentence, btn.dataset.lang);
});

explainModalClose.addEventListener('click', closeExplainModal);
explainModal.addEventListener('click', (e) => {
    if (e.target === explainModal) closeExplainModal();
});
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !explainModal.hidden) closeExplainModal();
});

async function search() {
    const phrase = phraseInput.value.trim();
    if (!phrase) {
        alert('Please enter a word, phrase, or question');
        return;
    }

    const selectedLangs = getSelectedLanguages();
    if (selectedLangs.length === 0) {
        alert('Please select at least one language');
        return;
    }

    lastQuery = phrase;
    searchBtn.disabled = true;
    searchBtn.textContent = 'Learning';
    results.classList.add('visible');
    resultsContent.innerHTML = '<div class="loading">Generating</div>';

    try {
        const payload = {
            phrase: phrase,
            num_examples: parseInt(numExamples.value),
            languages: selectedLangs,
            model: modelSelect.value || getStoredModel()
        };
        if (sourceLanguage.value) {
            payload.source_language = sourceLanguage.value;
        }
        const response = await fetch('/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        if (data.error) {
            resultsContent.innerHTML = `<div class="error">${escapeHtml(data.error)}</div>`;
        } else {
            resultsContent.innerHTML = parseResults(data.result);
        }
    } catch (error) {
        resultsContent.innerHTML = `<div class="error">Error: ${escapeHtml(error.message)}</div>`;
    }

    searchBtn.disabled = false;
    searchBtn.textContent = 'Learn';
}

renderLanguages();
initSettings();
updateSavedCount();

searchBtn.addEventListener('click', search);
phraseInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        search();
    }
});
