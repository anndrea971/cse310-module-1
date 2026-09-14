// Recursively searches the task tree to find a task by ID
function findTaskById(taskList, id) {
  const directMatch = taskList.find(task => task.id === id);
  if (directMatch) return directMatch;

  for (const task of taskList) {
    const foundInChildren = findTaskById(task.subtasks, id); 
    if (foundInChildren) return foundInChildren;
  }
  return null;
}

// Recursively rebuilds tree excluding the task matching specified ID
function removeTaskById(taskList, id) {
  return taskList
    .filter(task => task.id !== id)
    .map(task => ({
      ...task,
      subtasks: removeTaskById(task.subtasks, id) 
    }));
}

// Recursively removes completed tasks across all levels of the tree
function removeCompleted(taskList) {
  return taskList
    .filter(task => !task.completed)
    .map(task => ({
      ...task,
      subtasks: removeCompleted(task.subtasks)
    }));
}

// Recursively flattens nested task tree into a single array
function flattenTasks(taskList) {
  return taskList.reduce((flat, task) => {
    flat.push(task);
    flat.push(...flattenTasks(task.subtasks)); 
    return flat;
  }, []);
}

// Recursively constructs DOM list elements for tasks and nested subtasks
function renderTaskTree(taskList, container, depth = 0, flat = false) {
  taskList.forEach(task => {
    const li = document.createElement("li");
    li.className = "task-item" + (task.completed ? " completed" : "");

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
      dueSpan.textContent = formatDueDate(task.dueDate); 
      content.append(dueSpan);
    }

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
    li.appendChild(buildEditForm(task)); 

    if (!flat) {
      li.appendChild(buildSubtaskForm(task));

      if (task.subtasks.length > 0) {
        const nestedList = document.createElement("ul");
        nestedList.className = "subtask-list";
        renderTaskTree(task.subtasks, nestedList, depth + 1); 
        li.appendChild(nestedList);
      }
    }

    container.appendChild(li);
  });
}