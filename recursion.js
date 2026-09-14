/**
 * recursion.js
 * CSE 310 - Applied Programming, Module 1 (JavaScript)
 *
 * Tasks can contain subtasks, which can contain their own subtasks, and
 * so on - the data is a tree, not a flat list. Every function in this
 * file walks that tree by calling itself on a task's `subtasks` array,
 * which is what makes each of them recursive. script.js calls these
 * functions but never has to know how deep the nesting goes.
 */

/**
 * Recursively searches the task tree for a task with the given id.
 * Checks the current level with Array.find(), then recurses into
 * each task's subtasks until a match turns up (or the tree runs out).
 * @param {Array<object>} taskList - tasks to search (top level or a subtasks array)
 * @param {string} id
 * @returns {object|null} the matching task, or null if it isn't in the tree
 */
function findTaskById(taskList, id) {
  const directMatch = taskList.find(task => task.id === id);
  if (directMatch) return directMatch;

  for (const task of taskList) {
    const foundInChildren = findTaskById(task.subtasks, id); // recursive call
    if (foundInChildren) return foundInChildren;
  }
  return null;
}

/**
 * Recursively rebuilds the tree with the task matching `id` removed,
 * however deeply it is nested. Array.filter() drops the match at the
 * current level; Array.map() rebuilds every surviving task with its
 * own subtasks processed the same way.
 * @param {Array<object>} taskList
 * @param {string} id
 * @returns {Array<object>} a new tree with the task removed
 */
function removeTaskById(taskList, id) {
  return taskList
    .filter(task => task.id !== id)
    .map(task => ({
      ...task,
      subtasks: removeTaskById(task.subtasks, id) // recursive call
    }));
}

/**
 * Recursively rebuilds the tree with every completed task removed,
 * at every level of nesting.
 * @param {Array<object>} taskList
 * @returns {Array<object>} a new tree with completed tasks removed
 */
function removeCompleted(taskList) {
  return taskList
    .filter(task => !task.completed)
    .map(task => ({
      ...task,
      subtasks: removeCompleted(task.subtasks) // recursive call
    }));
}

/**
 * Recursively collapses the nested task tree into one flat array, so
 * stats and the Active/Completed views don't need to care about depth.
 * @param {Array<object>} taskList
 * @returns {Array<object>} every task in the tree, parents and subtasks alike
 */
function flattenTasks(taskList) {
  return taskList.reduce((flat, task) => {
    flat.push(task);
    flat.push(...flattenTasks(task.subtasks)); // recursive call
    return flat;
  }, []);
}

/**
 * Recursively builds the <li>/<ul> DOM structure for a list of tasks and
 * appends it to `container`. Every element is created with
 * document.createElement() and styled purely through CSS classes from
 * style.css - nothing here is hard-coded markup from index.html.
 *
 * @param {Array<object>} taskList - tasks to render at this level
 * @param {HTMLElement} container - element the new <li>s are appended to
 * @param {number} [depth=0] - nesting depth (unused visually, kept for clarity/debugging)
 * @param {boolean} [flat=false] - when true, don't render this task's own
 *   subtasks or its "+ Subtask" button (used by the Active/Completed views,
 *   which show a flat list instead of the nested tree)
 */
function renderTaskTree(taskList, container, depth = 0, flat = false) {
  taskList.forEach(task => {
    const li = document.createElement("li");
    li.className = "task-item" + (task.completed ? " completed" : "");

    // --- checkbox + title + due date ---
    const content = document.createElement("div");
    content.className = "task-content";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task-checkbox";
    checkbox.checked = task.completed;
    checkbox.addEventListener("change", () => toggleComplete(task.id));

    const titleSpan = document.createElement("span");
    titleSpan.className = "task-title-text";
    titleSpan.textContent = task.title;

    content.append(checkbox, titleSpan);

    if (task.dueDate) {
      const dueSpan = document.createElement("span");
      dueSpan.className = "task-due-date";
      dueSpan.textContent = formatDueDate(task.dueDate); // script.js, uses date-fns
      content.append(dueSpan);
    }

    // --- action row ---
    const actions = document.createElement("div");
    actions.className = "task-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => toggleEditForm(li));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.textContent = "Delete";
    deleteBtn.className = "delete-btn";
    deleteBtn.addEventListener("click", () => deleteTask(task.id));

    actions.append(editBtn, deleteBtn);

    if (!flat) {
      const addSubBtn = document.createElement("button");
      addSubBtn.type = "button";
      addSubBtn.textContent = "+ Subtask";
      addSubBtn.addEventListener("click", () => toggleSubtaskForm(li));
      actions.append(addSubBtn);
    }

    li.append(content, actions);
    li.appendChild(buildEditForm(task)); // hidden until "Edit" is clicked

    if (!flat) {
      li.appendChild(buildSubtaskForm(task)); // hidden until "+ Subtask" is clicked

      if (task.subtasks.length > 0) {
        const nestedList = document.createElement("ul");
        nestedList.className = "subtask-list";
        renderTaskTree(task.subtasks, nestedList, depth + 1); // recursive call
        li.appendChild(nestedList);
      }
    }

    container.appendChild(li);
  });
}
