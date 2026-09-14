// Custom error type thrown when a task title is submitted blank
class EmptyTaskError extends Error {
  constructor(message) {
    super(message);
    this.name = "EmptyTaskError";
  }
}

// State
let tasks = []; 
let currentFilter = "all"; 

const STORAGE_KEY = "task-tracker-data";

// DOM Elements
const taskForm = document.getElementById("task-form");
const taskTitleInput = document.getElementById("task-title");
const taskDueDateInput = document.getElementById("task-due-date");
const taskListEl = document.getElementById("task-list");
const emptyStateEl = document.getElementById("empty-state");
const statsEl = document.getElementById("stats");
const errorEl = document.getElementById("error-message");
const filterButtons = document.querySelectorAll(".filter-btn");
const clearCompletedBtn = document.getElementById("clear-completed-btn");

// Loads saved tasks from localStorage or returns empty array if unreadable
function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.warn("Saved tasks were unreadable, starting fresh:", error.message);
    return [];
  }
}

// Persists the current tasks array to localStorage
function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (error) {
    showError("Your changes could not be saved: " + error.message);
  }
}

// Displays a temporal error message in the banner
function showError(message) {
  errorEl.textContent = message;
  errorEl.classList.remove("hidden");
  setTimeout(() => errorEl.classList.add("hidden"), 4000);
}

// Generates a short unique string ID for new tasks
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Formats an ISO date string for display using the date-fns library
function formatDueDate(isoDate) {
  try {
    const date = new Date(isoDate + "T00:00:00");
    return dateFns.format(date, "MMM d, yyyy");
  } catch (error) {
    return isoDate; 
  }
}

// Factory function that constructs a new task object
function createTask(title, dueDate) {
  return {
    id: generateId(),
    title: title.trim(),
    dueDate: dueDate || null,
    completed: false,
    subtasks: []
  };
}

// Adds a new top-level task or subtask and updates storage
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

// Toggles completion status of a task by ID
function toggleComplete(id) {
  const task = findTaskById(tasks, id);
  if (!task) return;
  task.completed = !task.completed;
  saveTasks();
  render();
}

// Updates title of an existing task after validating input
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

// Deletes a task from the list by ID
function deleteTask(id) {
  tasks = removeTaskById(tasks, id);
  saveTasks();
  render();
}

// Removes all completed tasks across all levels
function clearCompleted() {
  tasks = removeCompleted(tasks);
  saveTasks();
  render();
}

// Builds inline DOM form element for editing task titles
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

// Toggles visibility of a task row's edit form
function toggleEditForm(li) {
  li.querySelector(".edit-form").classList.toggle("hidden");
}

// Builds inline DOM form element for adding subtasks
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

// Toggles visibility of a task row's subtask creation form
function toggleSubtaskForm(li) {
  li.querySelector(".subtask-form").classList.toggle("hidden");
}

// Calculates total, active, and completed task counts using Array.reduce
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

// Renders total task progress percentage in the footer
function renderStats() {
  const { total, completed } = computeStats();
  if (total === 0) {
    statsEl.textContent = "";
    return;
  }
  const percent = Math.round((completed / total) * 100);
  statsEl.textContent = `You've completed ${completed} of ${total} tasks (${percent}%).`;
}

// Rebuilds and renders task list DOM structure based on filter state
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

// Event Listeners
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

// Initial Application Load
tasks = loadTasks();
render();