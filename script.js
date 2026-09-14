class EmptyTaskError extends Error {
  constructor(message) {
    super(message);
    this.name = "EmptyTaskError";
  }
}

let tasks = []; 
let currentFilter = "all"; 

const STORAGE_KEY = "task-tracker-data";

const taskForm = document.getElementById("task-form");
const taskTitleInput = document.getElementById("task-title");
const taskDueDateInput = document.getElementById("task-due-date");
const taskListEl = document.getElementById("task-list");
const emptyStateEl = document.getElementById("empty-state");
const statsEl = document.getElementById("stats");
const errorEl = document.getElementById("error-message");
const filterButtons = document.querySelectorAll(".filter-btn");
const clearCompletedBtn = document.getElementById("clear-completed-btn");

/**
 * Loads saved tasks from localStorage. Wrapped in try/catch because the
 * stored value could be missing, or corrupted (e.g. hand-edited in
 * DevTools), which makes JSON.parse throw a SyntaxError.
 * @returns {Array<object>} the saved tasks, or [] if there are none/they're invalid
 */
function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.warn("Saved tasks were unreadable, starting fresh:", error.message);
    return [];
  }
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (error) {
    showError("Your changes could not be saved: " + error.message);
  }
}

/**
 * Displays a message in the error banner for a few seconds.
 * @param {string} message
 */
function showError(message) {
  errorEl.textContent = message;
  errorEl.classList.remove("hidden");
  setTimeout(() => errorEl.classList.add("hidden"), 4000);
}

/**
 * Generates a short, good-enough-for-this-app unique id. Avoids
 * crypto.randomUUID(), which some browsers restrict to secure
 * contexts - this file is sometimes opened directly from disk.
 * @returns {string}
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * Formats an ISO date string for display using date-fns (loaded via
 * CDN in index.html). This satisfies the "use a library written by
 * someone else" requirement.
 * @param {string} isoDate - value from an <input type="date">, e.g. "2026-09-20"
 * @returns {string} e.g. "Sep 20, 2026"
 */
function formatDueDate(isoDate) {
  try {
    const date = new Date(isoDate + "T00:00:00");
    return dateFns.format(date, "MMM d, yyyy");
  } catch (error) {
    return isoDate; 
  }
}


/**
 * Builds a new task object.
 * @param {string} title
 * @param {string} dueDate - ISO date string, or "" for none
 * @returns {object}
 */
function createTask(title, dueDate) {
  return {
    id: generateId(),
    title: title.trim(),
    dueDate: dueDate || null,
    completed: false,
    subtasks: []
  };
}

/**
 * Adds a new task. With no parentId it becomes a new top-level task;
 * with a parentId it is pushed into that task's subtasks array (the
 * parent is located recursively, since it could be nested anywhere).
 * Throws EmptyTaskError on a blank title - callers are expected to
 * catch it and show the message via showError().
 * @param {string} title
 * @param {string} dueDate
 * @param {string|null} [parentId]
 */
function addTask(title, dueDate, parentId = null) {
  if (!title || !title.trim()) {
    throw new EmptyTaskError("Task title can't be empty.");
  }

  const newTask = createTask(title, dueDate);

  if (parentId === null) {
    tasks.push(newTask);
  } else {
    const parent = findTaskById(tasks, parentId); // recursion.js
    if (!parent) {
      throw new Error("Couldn't find the parent task for that subtask.");
    }
    parent.subtasks.push(newTask);
  }

  saveTasks();
  render();
}

/**
 * Flips a task's completed flag.
 * @param {string} id
 */
function toggleComplete(id) {
  const task = findTaskById(tasks, id); // recursion.js
  if (!task) return;
  task.completed = !task.completed;
  saveTasks();
  render();
}

/**
 * Updates a task's title. Throws EmptyTaskError on a blank value, same
 * as addTask().
 * @param {string} id
 * @param {string} newTitle
 */
function editTaskTitle(id, newTitle) {
  if (!newTitle || !newTitle.trim()) {
    throw new EmptyTaskError("Task title can't be empty.");
  }
  const task = findTaskById(tasks, id); // recursion.js
  if (!task) return;
  task.title = newTitle.trim();
  saveTasks();
  render();
}

/**
 * Removes a task (and any subtasks it has) from the tree, wherever it
 * is nested.
 * @param {string} id
 */
function deleteTask(id) {
  tasks = removeTaskById(tasks, id); // recursion.js
  saveTasks();
  render();
}

function clearCompleted() {
  tasks = removeCompleted(tasks); // recursion.js
  saveTasks();
  render();
}

/**
 * Builds the (initially hidden) inline edit form for a task: a text
 * input pre-filled with its current title, plus Save/Cancel. Showing
 * and hiding it is done purely by toggling the `.hidden` CSS class.
 * @param {object} task
 * @returns {HTMLElement}
 */
function buildEditForm(task) {
  const form = document.createElement("div");
  form.className = "edit-form hidden";

  const input = document.createElement("input");
  input.type = "text";
  input.value = task.title;

  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.textContent = "Save";
  saveBtn.addEventListener("click", () => {
    try {
      editTaskTitle(task.id, input.value);
    } catch (error) {
      showError(error.message); 
    }
  });

  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", () => form.classList.add("hidden"));

  form.append(input, saveBtn, cancelBtn);
  return form;
}

/**
 * Shows or hides a task row's edit form.
 * @param {HTMLElement} li - the task's <li> element
 */
function toggleEditForm(li) {
  li.querySelector(".edit-form").classList.toggle("hidden");
}

/**
 * Builds the (initially hidden) inline form used to add a subtask
 * under a given parent task.
 * @param {object} task - the parent task
 * @returns {HTMLElement}
 */
function buildSubtaskForm(task) {
  const form = document.createElement("div");
  form.className = "subtask-form hidden";

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Subtask title";

  const addBtn = document.createElement("button");
  addBtn.type = "button";
  addBtn.textContent = "Add";
  addBtn.addEventListener("click", () => {
    try {
      addTask(input.value, "", task.id);
      input.value = "";
      form.classList.add("hidden");
    } catch (error) {
      showError(error.message); 
    }
  });

  form.append(input, addBtn);
  return form;
}

/**
 * Shows or hides a task row's "add subtask" form.
 * @param {HTMLElement} li - the task's <li> element
 */
function toggleSubtaskForm(li) {
  li.querySelector(".subtask-form").classList.toggle("hidden");
}


/**
 * Computes summary stats across every task, including subtasks, by
 * flattening the tree (recursion.js) and reducing it to counts.
 * @returns {{total: number, completed: number, active: number}}
 */
function computeStats() {
  const flat = flattenTasks(tasks); 
  return flat.reduce(
    (stats, task) => {
      stats.total += 1;
      task.completed ? (stats.completed += 1) : (stats.active += 1);
      return stats;
    },
    { total: 0, completed: 0, active: 0 }
  );
}

function renderStats() {
  const { total, completed } = computeStats();
  if (total === 0) {
    statsEl.textContent = "";
    return;
  }
  const percent = Math.round((completed / total) * 100);
  statsEl.textContent = `You've completed ${completed} of ${total} tasks (${percent}%).`;
}

function render() {
  taskListEl.innerHTML = ""; 

  const visibleCount =
    currentFilter === "all"
      ? flattenTasks(tasks).length 
      : flattenTasks(tasks).filter(task =>
          currentFilter === "completed" ? task.completed : !task.completed
        ).length;

  emptyStateEl.classList.toggle("hidden", visibleCount > 0);

  if (currentFilter === "all") {
    renderTaskTree(tasks, taskListEl); 
  } else {
    const filtered = flattenTasks(tasks).filter(task =>
      currentFilter === "completed" ? task.completed : !task.completed
    );
    filtered.forEach(task => renderTaskTree([task], taskListEl, 0, true));
  }

  renderStats();
}

taskForm.addEventListener("submit", event => {
  event.preventDefault();
  try {
    addTask(taskTitleInput.value, taskDueDateInput.value);
    taskTitleInput.value = "";
    taskDueDateInput.value = "";
    taskTitleInput.focus();
  } catch (error) {
    showError(error.message);
  }
});

filterButtons.forEach(button => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;
    filterButtons.forEach(b => b.classList.remove("active"));
    button.classList.add("active");
    render();
  });
});

clearCompletedBtn.addEventListener("click", clearCompleted);

tasks = loadTasks();
render();
