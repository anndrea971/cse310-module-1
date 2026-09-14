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

function showError(message) {
  errorEl.textContent = message;
  errorEl.classList.remove("hidden");
  setTimeout(() => errorEl.classList.add("hidden"), 4000);
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function formatDueDate(isoDate) {
  try {
    const date = new Date(isoDate + "T00:00:00");
    return dateFns.format(date, "MMM d, yyyy");
  } catch (error) {
    return isoDate; 
  }
}

function createTask(title, dueDate) {
  return {
    id: generateId(),
    title: title.trim(),
    dueDate: dueDate || null,
    completed: false,
    subtasks: []
  };
}

function addTask(title, dueDate, parentId = null) {
  if (!title || !title.trim()) {
    throw new EmptyTaskError("Task title can't be empty.");
  }

  const newTask = createTask(title, dueDate);

  if (parentId === null) {
    tasks.push(newTask);
  } else {
    const parent = findTaskById(tasks, parentId);
    if (!parent) {
      throw new Error("Couldn't find the parent task for that subtask.");
    }
    parent.subtasks.push(newTask);
  }

  saveTasks();
  render();
}

function toggleComplete(id) {
  const task = findTaskById(tasks, id);
  if (!task) return;
  task.completed = !task.completed;
  saveTasks();
  render();
}

function editTaskTitle(id, newTitle) {
  if (!newTitle || !newTitle.trim()) {
    throw new EmptyTaskError("Task title can't be empty.");
  }
  const task = findTaskById(tasks, id); 
  if (!task) return;
  task.title = newTitle.trim();
  saveTasks();
  render();
}

function deleteTask(id) {
  tasks = removeTaskById(tasks, id);
  saveTasks();
  render();
}

function clearCompleted() {
  tasks = removeCompleted(tasks);
  saveTasks();
  render();
}

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

function toggleEditForm(li) {
  li.querySelector(".edit-form").classList.toggle("hidden");
}

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

function toggleSubtaskForm(li) {
  li.querySelector(".subtask-form").classList.toggle("hidden");
}

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
