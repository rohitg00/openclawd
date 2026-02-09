import { TASK_STATUS } from './types.js';

export class TaskManager {
  constructor() {
    this.tasks = new Map();
    this._nextId = 1;
  }

  createTask({ title, description, priority = 'normal' }) {
    if (!title) throw new Error('Task title is required');
    const id = String(this._nextId++);
    const task = {
      id,
      title,
      description: description || '',
      status: TASK_STATUS.pending,
      priority,
      owner: null,
      blockedBy: [],
      blocks: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.tasks.set(id, task);
    return task;
  }

  getTask(id) {
    return this.tasks.get(id) || null;
  }

  listTasks() {
    return Array.from(this.tasks.values());
  }

  updateTask(id, updates) {
    const task = this.tasks.get(id);
    if (!task) throw new Error(`Task '${id}' not found`);

    const allowed = ['title', 'description', 'status', 'priority', 'blockedBy', 'blocks'];
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        task[key] = updates[key];
      }
    }
    task.updatedAt = Date.now();
    return task;
  }

  deleteTask(id) {
    const task = this.tasks.get(id);
    if (!task) throw new Error(`Task '${id}' not found`);
    for (const other of this.tasks.values()) {
      other.blockedBy = other.blockedBy.filter(bid => bid !== id);
      other.blocks = other.blocks.filter(bid => bid !== id);
    }
    this.tasks.delete(id);
    return true;
  }

  assignTask(id, agentName) {
    const task = this.tasks.get(id);
    if (!task) throw new Error(`Task '${id}' not found`);
    task.owner = agentName;
    task.status = TASK_STATUS.in_progress;
    task.updatedAt = Date.now();
    return task;
  }

  getAvailableTasks() {
    return this.listTasks().filter(t =>
      t.status === TASK_STATUS.pending &&
      !t.owner &&
      t.blockedBy.every(bid => {
        const blocker = this.tasks.get(bid);
        return blocker && blocker.status === TASK_STATUS.completed;
      })
    );
  }

  getBlockedTasks() {
    return this.listTasks().filter(t =>
      t.blockedBy.some(bid => {
        const blocker = this.tasks.get(bid);
        return blocker && blocker.status !== TASK_STATUS.completed;
      })
    );
  }
}
