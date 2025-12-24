// Responsive Todo Matrix with IST due handling, statuses and left dark band per task
// Notes:
// - Due date/time entered by user (either in add form or modal) are interpreted as IST (Asia/Kolkata).
// - We store the due as an ISO string representing the UTC instant corresponding to the IST datetime.
//   This makes comparisons reliable regardless of user's local timezone.
// - Status classes:
//    - status-warning: newly added / pending (yellow) when not overdue
//    - status-overdue: missed due and not completed (red)
//    - status-done: completed on or before due (green)
//    - status-done-late: completed after due (orange)

const form = document.getElementById('todo-form');
const input = document.getElementById('todo-input');
const quadrantSelect = document.getElementById('quadrant-select');
const todoDate = document.getElementById('todo-date');
const todoTime = document.getElementById('todo-time');
const statsEl = document.getElementById('stats');

const lists = {
  I: document.getElementById('list-I'),
  II: document.getElementById('list-II'),
  III: document.getElementById('list-III'),
  IV: document.getElementById('list-IV')
};

const countEls = {
  I: document.querySelector('[data-count-for="I"]'),
  II: document.querySelector('[data-count-for="II"]'),
  III: document.querySelector('[data-count-for="III"]'),
  IV: document.querySelector('[data-count-for="IV"]')
};

const modal = document.getElementById('modal');
const modalForm = document.getElementById('modal-form');
const modalText = document.getElementById('modal-text');
const modalQuadrant = document.getElementById('modal-quadrant');
const modalCompleted = document.getElementById('modal-completed');
const modalDeleteBtn = document.getElementById('modal-delete');
const modalCancelBtn = document.getElementById('modal-cancel');
const modalDate = document.getElementById('modal-date');
const modalTime = document.getElementById('modal-time');

let todos = []; // {id, text, quadrant, due (ISO|null), completed:bool, completedAt (ISO|null), createdAt ISO}
const LS_KEY = 'todo_matrix_v4';
let currentEditId = null;
let lastFocusedElement = null;

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,8);

// Utility: parse date+time inputs as IST and return an ISO string (UTC instant)
function parseDueAsIST(dateStr, timeStr) {
  if (!dateStr && !timeStr) return null;
  const datePart = dateStr || new Date().toISOString().slice(0,10);
  const timePart = timeStr || '23:59';
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  // Date.UTC gives ms for that Y-M-D hh:mm interpreted as UTC; user provided hh:mm in IST,
  // so subtract IST offset (5.5 hrs) to get the UTC timestamp representing that IST instant.
  const IST_OFFSET_MIN = 5.5 * 60; // minutes
  const utcMs = Date.UTC(y, m - 1, d, hh, mm) - IST_OFFSET_MIN * 60 * 1000;
  return new Date(utcMs).toISOString();
}

// Format stored due ISO into readable IST date/time
function formatDueIST(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  // show using Asia/Kolkata timezone
  const datePart = date.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' });
  const timePart = date.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit' });
  return `${datePart} ${timePart} (IST)`;
}

// Determine status for a todo and return a status class
function statusFor(todo) {
  const now = Date.now();
  const due = todo.due ? new Date(todo.due).getTime() : null;

  if (todo.completed) {
    if (!todo.completedAt) return 'status-done';
    if (due) {
      const completedAt = new Date(todo.completedAt).getTime();
      return completedAt <= due ? 'status-done' : 'status-done-late';
    }
    return 'status-done';
  } else {
    if (due && now > due) return 'status-overdue';
    return 'status-warning';
  }
}

function save() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(todos)); } catch (e) {}
}
function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    todos = raw ? JSON.parse(raw) : [];
  } catch (e) {
    todos = [];
  }
}

function render() {
  Object.values(lists).forEach(ul => ul.innerHTML = '');
  const grouped = { I: [], II: [], III: [], IV: [] };
  todos.forEach(t => { if (!grouped[t.quadrant]) grouped[t.quadrant] = []; grouped[t.quadrant].push(t); });

  let total = 0;
  Object.keys(grouped).forEach(q => {
    const group = grouped[q];
    countEls[q].textContent = String(group.filter(t => !t.completed).length);
    total += group.length;

    group.forEach(todo => {
      const li = document.createElement('li');
      const st = statusFor(todo);
      li.className = `todo-item ${st}`;
      li.dataset.id = todo.id;
      li.tabIndex = -1;

      // checkbox
      const cb = document.createElement('button');
      cb.className = 'checkbox';
      cb.type = 'button';
      cb.setAttribute('aria-label', todo.completed ? 'Mark as active' : 'Mark as completed');
      cb.innerHTML = todo.completed ? '✓' : '';

      // text + status dot + due meta
      const text = document.createElement('div');
      text.className = 'todo-text' + (todo.completed ? ' completed' : '');

      const statusDot = document.createElement('span');
      statusDot.className = 'status-dot';
      // color of dot managed by CSS via quadrant selector

      const textNode = document.createElement('span');
      textNode.textContent = todo.text;

      const meta = document.createElement('span');
      meta.className = 'meta';
      if (todo.due) {
        meta.textContent = `Due: ${formatDueIST(todo.due)}`;
      } else {
        meta.textContent = '';
      }

      text.appendChild(statusDot);
      text.appendChild(textNode);
      if (meta.textContent) text.appendChild(meta);

      // actions: quadrant select + edit + delete
      const actions = document.createElement('div');
      actions.className = 'actions';

      const sel = document.createElement('select');
      sel.className = 'item-select';
      ['I','II','III','IV'].forEach(opt => {
        const o = document.createElement('option');
        o.value = opt;
        o.textContent = opt;
        if (opt === todo.quadrant) o.selected = true;
        sel.appendChild(o);
      });

      const editBtn = document.createElement('button');
      editBtn.className = 'action-btn edit';
      editBtn.type = 'button';
      editBtn.textContent = 'Edit';

      const delBtn = document.createElement('button');
      delBtn.className = 'action-btn delete';
      delBtn.type = 'button';
      delBtn.textContent = 'Delete';

      actions.appendChild(sel);
      actions.appendChild(editBtn);
      actions.appendChild(delBtn);

      li.appendChild(cb);
      li.appendChild(text);
      li.appendChild(actions);

      // append to correct quadrant list
      lists[todo.quadrant].appendChild(li);
    });
  });

  statsEl.textContent = `${total} task${total !== 1 ? 's' : ''} total`;
}

/* CRUD */
function addTodo(text, quadrant, dueIso = null) {
  const trimmed = (text||'').trim();
  if (!trimmed) return;
  const nowIso = new Date().toISOString();
  todos.unshift({ id: uid(), text: trimmed, quadrant: quadrant || 'II', due: dueIso, completed: false, completedAt: null, createdAt: nowIso });
  save(); render();
}
function toggleTodo(id) {
  const t = todos.find(x => x.id === id); if (!t) return;
  t.completed = !t.completed;
  t.completedAt = t.completed ? new Date().toISOString() : null;
  save(); render();
}
function deleteTodo(id) { todos = todos.filter(x => x.id !== id); save(); render(); }
function moveTodo(id, quadrant) { const t = todos.find(x => x.id === id); if (!t) return; t.quadrant = quadrant; save(); render(); }

/* Inline edit */
function startInlineEdit(li, todo) {
  const textDiv = li.querySelector('.todo-text');
  const inputEl = document.createElement('input');
  inputEl.type = 'text';
  inputEl.value = todo.text;
  inputEl.className = 'edit-input';
  li.replaceChild(inputEl, textDiv);
  inputEl.focus();
  inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length);

  function finish(saveEdit) {
    if (saveEdit) {
      const newText = inputEl.value.trim();
      if (newText) todo.text = newText;
      else todos = todos.filter(x => x.id !== todo.id);
    }
    save(); render();
  }
  function onKey(e) {
    if (e.key === 'Enter') finish(true);
    else if (e.key === 'Escape') finish(false);
  }
  inputEl.addEventListener('keydown', onKey);
  inputEl.addEventListener('blur', () => finish(true));
}

/* Modal & focus trap */
function getFocusable(container) {
  return Array.from(container.querySelectorAll('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'))
    .filter(el => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement);
}

let modalKeyHandler = null;

function openModal(id) {
  const todo = todos.find(t => t.id === id); if (!todo) return;
  currentEditId = id;
  modalText.value = todo.text;
  modalQuadrant.value = todo.quadrant;
  modalCompleted.checked = !!todo.completed;

  // populate modal date/time using IST values if due exists
  if (todo.due) {
    const d = new Date(todo.due);
    // Use toLocale with Asia/Kolkata to get local IST date/time strings
    modalDate.value = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD
    modalTime.value = d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false, hour: '2-digit', minute: '2-digit' }); // HH:MM
  } else {
    modalDate.value = '';
    modalTime.value = '';
  }

  lastFocusedElement = document.activeElement;

  modal.setAttribute('aria-hidden','false');
  document.body.classList.add('no-scroll');

  setTimeout(()=> modalText.focus(), 20);

  modalKeyHandler = function(e) {
    if (e.key === 'Escape') { e.preventDefault(); closeModal(); return; }
    if (e.key === 'Tab') {
      const focusable = getFocusable(modal);
      if (focusable.length === 0) { e.preventDefault(); return; }
      const idx = focusable.indexOf(document.activeElement);
      if (e.shiftKey) {
        if (idx === 0) { focusable[focusable.length-1].focus(); e.preventDefault(); }
      } else {
        if (idx === focusable.length - 1) { focusable[0].focus(); e.preventDefault(); }
      }
    }
  };
  document.addEventListener('keydown', modalKeyHandler, true);
}

function closeModal() {
  modal.setAttribute('aria-hidden','true');
  currentEditId = null;
  document.body.classList.remove('no-scroll');
  if (modalKeyHandler) { document.removeEventListener('keydown', modalKeyHandler, true); modalKeyHandler = null; }
  if (lastFocusedElement && lastFocusedElement.focus) lastFocusedElement.focus();
}

/* modal overlay click */
modal.addEventListener('click', (e) => { if (e.target && e.target.dataset && e.target.dataset.close) closeModal(); });

/* modal form submit = update */
modalForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!currentEditId) return;
  const todo = todos.find(t => t.id === currentEditId); if (!todo) return;
  const newText = modalText.value.trim();
  if (newText) {
    todo.text = newText;
    todo.quadrant = modalQuadrant.value;
    // combine modal date/time into due ISO (interpreted as IST)
    todo.due = parseDueAsIST(modalDate.value, modalTime.value);
    const wasCompleted = !!todo.completed;
    if (modalCompleted.checked && !wasCompleted) {
      todo.completed = true;
      todo.completedAt = new Date().toISOString();
    } else if (!modalCompleted.checked && wasCompleted) {
      todo.completed = false;
      todo.completedAt = null;
    }
  } else {
    todos = todos.filter(x => x.id !== currentEditId);
  }
  save(); render(); closeModal();
});
modalDeleteBtn.addEventListener('click', () => { if (!currentEditId) return; todos = todos.filter(x => x.id !== currentEditId); save(); render(); closeModal(); });
modalCancelBtn.addEventListener('click', () => closeModal());

/* events */
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const dueIso = parseDueAsIST(todoDate.value, todoTime.value);
  addTodo(input.value, quadrantSelect.value, dueIso);
  input.value='';
  todoDate.value='';
  todoTime.value='';
  input.focus();
});

Object.values(lists).forEach(ul => {
  ul.addEventListener('click', (e) => {
    const li = e.target.closest('li.todo-item'); if (!li) return;
    const id = li.dataset.id;
    if (e.target.matches('.checkbox')) {
      toggleTodo(id);
    } else if (e.target.matches('.action-btn.delete')) {
      openModal(id);
    } else if (e.target.matches('.action-btn.edit')) {
      openModal(id);
    }
  });

  ul.addEventListener('change', (e) => {
    const sel = e.target; if (!sel.classList.contains('item-select')) return;
    const li = sel.closest('li.todo-item'); if (!li) return;
    moveTodo(li.dataset.id, sel.value);
  });

  ul.addEventListener('dblclick', (e) => {
    const li = e.target.closest('li.todo-item'); if (!li) return;
    const id = li.dataset.id; const todo = todos.find(t => t.id === id); if (!todo) return;
    startInlineEdit(li, todo);
  });

  ul.addEventListener('keydown', (e) => {
    if (e.target.classList.contains('checkbox') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.target.click(); }
  });
});

/* Periodic re-render so statuses (warning/overdue) update with time */
setInterval(() => { render(); }, 30 * 1000); // every 30s

/* initial load */
load();
render();

/* small API for debugging */
window._todoMatrix = {
  add: (t,q,d) => { addTodo(t,q, d ? parseDueAsIST(d.split(' ')[0], d.split(' ')[1]) : null); },
  all: () => todos,
  clear: () => { todos = []; save(); render(); }
};