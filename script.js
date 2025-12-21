// Responsive Todo Matrix with colored quadrant & task accents
const form = document.getElementById('todo-form');
const input = document.getElementById('todo-input');
const quadrantSelect = document.getElementById('quadrant-select');
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
const modalUpdateBtn = document.getElementById('modal-update');
const modalDeleteBtn = document.getElementById('modal-delete');
const modalCancelBtn = document.getElementById('modal-cancel');

let todos = []; // {id, text, quadrant, completed}
const LS_KEY = 'todo_matrix_v2';
let currentEditId = null;
let lastFocusedElement = null;

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,8);

function save() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(todos)); } catch(e){}
}
function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    todos = raw ? JSON.parse(raw) : [];
  } catch (e) { todos = []; }
}

function render() {
  Object.values(lists).forEach(ul => ul.innerHTML = '');
  const grouped = { I: [], II: [], III: [], IV: [] };
  todos.forEach(t => { if (!grouped[t.quadrant]) grouped[t.quadrant]=[]; grouped[t.quadrant].push(t); });

  let total = 0;
  Object.keys(grouped).forEach(q => {
    const group = grouped[q];
    countEls[q].textContent = String(group.filter(t => !t.completed).length);
    total += group.length;

    group.forEach(todo => {
      const li = document.createElement('li');
      li.className = 'todo-item' + (todo.completed ? ' completed' : '');
      li.dataset.id = todo.id;
      li.tabIndex = -1;

      // checkbox
      const cb = document.createElement('button');
      cb.className = 'checkbox';
      cb.type = 'button';
      cb.setAttribute('aria-label', todo.completed ? 'Mark as active' : 'Mark as completed');
      cb.innerHTML = todo.completed ? '✓' : '';

      // status dot (colored)
      const statusDot = document.createElement('span');
      statusDot.className = 'status-dot';
      // status-dot color is handled by CSS via parent quadrant (.q-i .status-dot)

      // text
      const text = document.createElement('div');
      text.className = 'todo-text' + (todo.completed ? ' completed' : '');
      // show dot + text using flex inside todo-text
      const textNode = document.createElement('span');
      textNode.textContent = todo.text;
      text.appendChild(statusDot);
      text.appendChild(textNode);
      text.title = 'Double-click to edit';

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
function addTodo(text, quadrant) {
  const trimmed = (text||'').trim();
  if (!trimmed) return;
  todos.unshift({ id: uid(), text: trimmed, quadrant: quadrant || 'II', completed: false });
  save(); render();
}
function toggleTodo(id) {
  const t = todos.find(x => x.id === id); if (!t) return;
  t.completed = !t.completed; save(); render();
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
  lastFocusedElement = document.activeElement;

  modal.setAttribute('aria-hidden','false');
  document.body.classList.add('no-scroll');

  // focus first input
  setTimeout(()=> modalText.focus(), 20);

  // focus trap & ESC
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
    todo.completed = !!modalCompleted.checked;
  } else {
    todos = todos.filter(x => x.id !== currentEditId);
  }
  save(); render(); closeModal();
});
modalDeleteBtn.addEventListener('click', () => { if (!currentEditId) return; todos = todos.filter(x => x.id !== currentEditId); save(); render(); closeModal(); });
modalCancelBtn.addEventListener('click', () => closeModal());

/* events */
form.addEventListener('submit', (e) => { e.preventDefault(); addTodo(input.value, quadrantSelect.value); input.value=''; input.focus(); });

Object.values(lists).forEach(ul => {
  ul.addEventListener('click', (e) => {
    const li = e.target.closest('li.todo-item'); if (!li) return;
    const id = li.dataset.id;
    if (e.target.matches('.checkbox')) toggleTodo(id);
    else if (e.target.matches('.action-btn.delete')) openModal(id); // confirm delete via modal
    else if (e.target.matches('.action-btn.edit')) openModal(id);   // open modal edit
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

/* initial load */
load();
render();

/* expose small API for debugging */
window._todoMatrix = {
  add: addTodo,
  all: () => todos,
  clear: () => { todos = []; save(); render(); }
};