// script.js — Todo Matrix (IST, Theme A, AUTO-SORT ENABLED)

/*------------------------------------------------------------------------------
| DOM REFERENCES
------------------------------------------------------------------------------*/
const form = document.getElementById('todo-form');
const input = document.getElementById('todo-input');
const quadrantSelect = document.getElementById('quadrant-select');
const statsEl = document.getElementById('stats');

const dateInput = document.getElementById('todo-date');
const timeInput = document.getElementById('todo-time');

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

/*------------------------------------------------------------------------------
| GLOBALS
------------------------------------------------------------------------------*/
let todos = []; 
const LS_KEY = 'todo_matrix_v7_auto_sort';
let currentEditId = null;

/*------------------------------------------------------------------------------
| HELPERS — DATETIME (IST)
------------------------------------------------------------------------------*/
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,8);

function toISO(date, time){
  if(!date) return null;
  const t = time || "00:00";
  const [y,m,d] = date.split("-").map(Number);
  const [hh,mm] = t.split(":").map(Number);
  const IST_OFFSET = 330;
  const utc = Date.UTC(y,m-1,d,hh,mm) - IST_OFFSET*60000;
  return new Date(utc).toISOString();
}

function formatIST(iso){
  if (!iso) return '';
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-GB',{ timeZone:'Asia/Kolkata' });
  const time = d.toLocaleTimeString('en-GB',{
    timeZone:'Asia/Kolkata', hour12:false, hour:'2-digit', minute:'2-digit'
  });
  return `${date} ${time} IST`;
}

/*------------------------------------------------------------------------------
| STATUS & COLOR THEMES
------------------------------------------------------------------------------*/
function statusFor(t){
  const now = Date.now();
  const due = t.due ? new Date(t.due).getTime() : null;
  if (t.completed){
    if (due && new Date(t.completedAt).getTime() > due) return 'done-late';
    return 'done';
  }
  if (due && now > due) return 'overdue';
  return 'active';
}

// THEME A confirmed
const COLOR_THEME = {
  active:{bg:'#FFF0C2',border:'#E0B100',dot:'#C99700'},
  overdue:{bg:'#FFD7D7',border:'#D64545',dot:'#B03030'},
  done:{bg:'#D8FDD8',border:'#3C9A3C',dot:'#2C7A2C'},
  'done-late':{bg:'#CCE6FF',border:'#1462B0',dot:'#0B5394'}
};

/*------------------------------------------------------------------------------
| STORAGE
------------------------------------------------------------------------------*/
function save(){ localStorage.setItem(LS_KEY, JSON.stringify(todos)); }
function load(){ todos = JSON.parse(localStorage.getItem(LS_KEY)||'[]'); }

/*------------------------------------------------------------------------------
| AUTO SORT (YES CONFIRMED)
------------------------------------------------------------------------------*/
function autoSort(){
  todos.sort((a,b)=>{
    const order = {overdue:0, active:1, 'done-late':2, done:3};
    const sa = order[statusFor(a)];
    const sb = order[statusFor(b)];

    if(sa !== sb) return sa - sb;

    if(a.due && b.due){
      return new Date(a.due) - new Date(b.due);
    }

    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

/*------------------------------------------------------------------------------
| RENDER
------------------------------------------------------------------------------*/
function render(){
  autoSort();
  Object.values(lists).forEach(l=>l.innerHTML='');

  const grouped = {I:[],II:[],III:[],IV:[]};
  todos.forEach(t=>grouped[t.quadrant].push(t));

  let total = 0;

  Object.keys(grouped).forEach(q=>{
    countEls[q].textContent = grouped[q].filter(x=>!x.completed).length;
    total += grouped[q].length;

    grouped[q].forEach(t=>{
      const st = statusFor(t);
      const c = COLOR_THEME[st];

      const li = document.createElement('li');
      li.className = 'todo-card';
      li.dataset.id = t.id;
      li.style.background = c.bg;
      li.style.border = "none";
      //li.style.border = `3px solid ${c.border}`;
      li.style.borderRadius = "14px";
      li.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)"; // clean premium shadow

      li.innerHTML = `
        <div class="card-inner">
          <!-- ⭐ Left Thick Border Bar -->
          <div class="card-bar"></div>

          <!-- ⭐ LARGE Checkbox -->
          <button class="check ${t.completed?'checked':''}">
            ${t.completed ? "✔️" : ""}
          </button>

          <div class="card-info" title="${t.text}">
            <div class="task-name">${t.text}</div>
            ${t.due ? `<div class="task-due">Due: ${formatIST(t.due)}</div>` : ''}
          </div>

          <select class="quad">
            <option ${t.quadrant=='I'?'selected':''}>I</option>
            <option ${t.quadrant=='II'?'selected':''}>II</option>
            <option ${t.quadrant=='III'?'selected':''}>III</option>
            <option ${t.quadrant=='IV'?'selected':''}>IV</option>
          </select>

          <button class="edit icon-btn" title="Edit">✏️</button>
          <button class="del icon-btn" title="Delete">🗑️</button>
        </div>
      `;

      // Apply thick LEFT bar color
        const bar = li.querySelector(".card-bar");
        bar.style.width = "8px";       // ⭐ thicker
        bar.style.background = c.border;
        bar.style.borderRadius = "8px";
      
      lists[q].appendChild(li);
    });
  });

  statsEl.textContent = `${total} Total Tasks`;
}

/*------------------------------------------------------------------------------
| CRUD
------------------------------------------------------------------------------*/
function addTodo(text, q, date, time){
  text = text.trim(); 
  if(!text) return;
  todos.unshift({
    id: uid(),
    text,
    quadrant: q,
    due: toISO(date,time),
    completed:false,
    createdAt:new Date().toISOString(),
    completedAt:null
  });
  save(); render();
}

function toggle(id){
  const t = todos.find(x=>x.id===id); if(!t) return;
  t.completed = !t.completed;
  t.completedAt = t.completed ? new Date().toISOString() : null;
  save(); render();
}

function remove(id){ todos = todos.filter(x=>x.id!==id); save(); render(); }

function move(id,q){
  const t = todos.find(x=>x.id===id);
  if(t){ t.quadrant=q; save(); render(); }
}

/*------------------------------------------------------------------------------
| MODAL
------------------------------------------------------------------------------*/
function openModal(id){
  const t = todos.find(x=>x.id===id); if(!t) return;
  currentEditId=id;
  modalText.value = t.text;
  modalQuadrant.value = t.quadrant;
  modalCompleted.checked = t.completed;

  if(t.due){
    const d = new Date(t.due);
    modalDate.value = d.toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'});
    modalTime.value = d.toLocaleTimeString('en-GB',{timeZone:'Asia/Kolkata',hour12:false,hour:'2-digit',minute:'2-digit'});
  } else {
    modalDate.value=''; modalTime.value='';
  }
  modal.setAttribute('open','');
}
function closeModal(){ modal.removeAttribute('open'); currentEditId=null; }

modalForm.addEventListener('submit',e=>{
  e.preventDefault();
  const t = todos.find(x=>x.id===currentEditId); if(!t) return;

  t.text = modalText.value.trim();
  t.quadrant = modalQuadrant.value;
  t.due = modalDate.value?toISO(modalDate.value, modalTime.value):null;

  if(modalCompleted.checked && !t.completed){
    t.completed = true;
    t.completedAt = new Date().toISOString();
  }
  if(!modalCompleted.checked && t.completed){
    t.completed = false;
    t.completedAt = null;
  }

  save(); render(); closeModal();
});

modalDeleteBtn.addEventListener('click',()=>{ remove(currentEditId); closeModal(); });
modalCancelBtn.addEventListener('click',closeModal);

/*------------------------------------------------------------------------------ 
| EVENTS (FIXED)
------------------------------------------------------------------------------*/
form.addEventListener('submit', (e) => {
  e.preventDefault();

  // Validate selectors exist
  if(!input || !quadrantSelect){
    alert("❌ Form elements missing — check HTML IDs:\n#todo-input #quadrant-select");
    return;
  }

  // Gather values safely
  const text = (input.value || "").trim();
  const quadrant = quadrantSelect.value || "I";
  const date = dateInput ? dateInput.value : "";
  const time = timeInput ? timeInput.value : "";

  // Prevent empty task
  if(text === ""){
    input.classList.add("error-shake");
    setTimeout(()=>input.classList.remove("error-shake"), 600);
    return;
  }

  addTodo(text, quadrant, date, time);

  // Reset fields
  input.value = "";
  if(dateInput) dateInput.value = "";
  if(timeInput) timeInput.value = "";

  input.focus();
});


document.body.addEventListener('click',e=>{
  const li = e.target.closest('.todo-card'); if(!li) return;
  const id = li.dataset.id;
  if(e.target.classList.contains('check')){
    toggle(id);
    e.target.textContent = e.target.classList.contains("checked") ? "" : "✔️";
  }
  if(e.target.classList.contains('edit')) openModal(id);

  // ❗️STOP auto delete here — modal will handle later
  if(e.target.classList.contains('del')) {
    return; // just ignore; modal code will catch this click
  }
});

document.body.addEventListener('change',e=>{
  if(e.target.classList.contains('quad')){
    const id = e.target.closest('.todo-card').dataset.id;
    move(id, e.target.value);
  }
});

/*------------------------------------------------------------------------------
| LIVE REFRESH + INIT
------------------------------------------------------------------------------*/
setInterval(render, 15000);
window.addEventListener('focus',render);

load();
render();

// ================= Delete Confirmation Modal ================= //
let taskToDelete = null;

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("del")) {
    const card = e.target.closest(".todo-card");
    const id = card.dataset.id;
    taskToDelete = id;

    const t = todos.find(x => x.id == id);
    document.getElementById("delTaskName").textContent = t.text;
    document.getElementById("delTaskDue").textContent = t.due ? "Due: " + formatIST(t.due) : "";

    document.getElementById("deleteModal").style.display = "flex";
  }
});

document.querySelector(".close-modal").onclick = () =>
  deleteModal.style.display = "none";

document.querySelector(".cancel-btn").onclick = () =>
  deleteModal.style.display = "none";

document.querySelector(".confirm-delete-btn").onclick = () => {
  todos = todos.filter(t => t.id != taskToDelete);
  save();
  render();
  deleteModal.style.display = "none";
};

window.onclick = (e) => {
  if (e.target == deleteModal) deleteModal.style.display = "none";
};

// ================= Swipe to Delete on Mobile ================= //
let startX = 0;

document.addEventListener("touchstart", (e) => {
  if (e.target.closest(".todo-card")) {
    startX = e.touches[0].clientX;
  }
});

document.addEventListener("touchend", (e) => {
  const card = e.target.closest(".todo-card");
  if (!card) return;

  let endX = e.changedTouches[0].clientX;

  if (startX - endX > 100) { // swipe left threshold
    card.querySelector(".del").click();
  }
});

// ================= Long Press to Delete on Mobile ================= //
let pressTimer = null;

document.addEventListener("touchstart", (e) => {
  const card = e.target.closest(".todo-card");
  if (!card) return;

  pressTimer = setTimeout(() => {
    card.querySelector(".del").click(); // triggers confirmation modal
  }, 700); // long press duration (700ms)
});

document.addEventListener("touchend", (e) => {
  clearTimeout(pressTimer);
});

document.addEventListener("touchmove", (e) => {
  clearTimeout(pressTimer); // cancel if finger moves
});

// =================== VOICE INPUT =================== //
// 🎤 Voice Add Feature (Chrome / Edge)
const mic = document.getElementById("mic-btn");
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if(SpeechRecognition){
  const recog = new SpeechRecognition();
  recog.lang = "en-IN";
  recog.continuous = false;
  recog.interimResults = false;

  mic.addEventListener("click", () => {
    mic.classList.add("listening");
    recog.start();
  });

  recog.onresult = (e) => {
    document.getElementById("todo-input").value = e.results[0][0].transcript;
    mic.classList.remove("listening");
  };

  recog.onerror = () => mic.classList.remove("listening");

} else {
  mic.style.display = "none";
  console.warn("Voice recognition not supported!");
}

// =================== THEME TOGGLER =================== //
// DARK MODE TOGGLE
const themeBtn = document.getElementById("theme-toggle");
themeBtn.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  themeBtn.textContent = document.body.classList.contains("dark") ? "☀️" : "🌙";
  localStorage.setItem("theme", document.body.classList.contains("dark") ? "dark" : "light");
});

// Load saved theme
if (localStorage.getItem("theme") === "dark") {
  document.body.classList.add("dark");
  themeBtn.textContent = "☀️";
}
