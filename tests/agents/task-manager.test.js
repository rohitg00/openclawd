import { describe, it, expect, beforeEach } from 'vitest';
import { TaskManager } from '../../server/agents/task-manager.js';
import { TASK_STATUS } from '../../server/agents/types.js';

describe('TaskManager', () => {
  let tm;

  beforeEach(() => {
    tm = new TaskManager();
  });

  it('creates a task', () => {
    const task = tm.createTask({ title: 'Fix bug' });
    expect(task.id).toBe('1');
    expect(task.title).toBe('Fix bug');
    expect(task.status).toBe(TASK_STATUS.pending);
    expect(task.owner).toBeNull();
  });

  it('requires a title', () => {
    expect(() => tm.createTask({})).toThrow('Task title is required');
  });

  it('auto-increments IDs', () => {
    const t1 = tm.createTask({ title: 'A' });
    const t2 = tm.createTask({ title: 'B' });
    expect(t1.id).toBe('1');
    expect(t2.id).toBe('2');
  });

  it('gets a task by ID', () => {
    tm.createTask({ title: 'Find me' });
    expect(tm.getTask('1').title).toBe('Find me');
    expect(tm.getTask('99')).toBeNull();
  });

  it('lists all tasks', () => {
    tm.createTask({ title: 'A' });
    tm.createTask({ title: 'B' });
    expect(tm.listTasks()).toHaveLength(2);
  });

  it('updates a task', () => {
    tm.createTask({ title: 'Old' });
    const updated = tm.updateTask('1', { title: 'New', status: TASK_STATUS.completed });
    expect(updated.title).toBe('New');
    expect(updated.status).toBe(TASK_STATUS.completed);
  });

  it('throws when updating non-existent task', () => {
    expect(() => tm.updateTask('99', { title: 'X' })).toThrow("Task '99' not found");
  });

  it('deletes a task and cleans up references', () => {
    const t1 = tm.createTask({ title: 'Blocker' });
    const t2 = tm.createTask({ title: 'Blocked' });
    tm.updateTask(t2.id, { blockedBy: [t1.id] });
    tm.updateTask(t1.id, { blocks: [t2.id] });

    tm.deleteTask(t1.id);
    expect(tm.getTask(t1.id)).toBeNull();
    expect(tm.getTask(t2.id).blockedBy).toEqual([]);
  });

  it('assigns a task to an agent', () => {
    tm.createTask({ title: 'Work' });
    const task = tm.assignTask('1', 'agent-1');
    expect(task.owner).toBe('agent-1');
    expect(task.status).toBe(TASK_STATUS.in_progress);
  });

  it('getAvailableTasks() returns unblocked pending tasks', () => {
    const t1 = tm.createTask({ title: 'Blocker' });
    const t2 = tm.createTask({ title: 'Blocked' });
    tm.updateTask(t2.id, { blockedBy: [t1.id] });
    const t3 = tm.createTask({ title: 'Free' });

    const available = tm.getAvailableTasks();
    expect(available.map(t => t.id)).toContain(t1.id);
    expect(available.map(t => t.id)).toContain(t3.id);
    expect(available.map(t => t.id)).not.toContain(t2.id);
  });

  it('getBlockedTasks() returns tasks with incomplete blockers', () => {
    const t1 = tm.createTask({ title: 'Blocker' });
    const t2 = tm.createTask({ title: 'Blocked' });
    tm.updateTask(t2.id, { blockedBy: [t1.id] });

    expect(tm.getBlockedTasks().map(t => t.id)).toContain(t2.id);

    tm.updateTask(t1.id, { status: TASK_STATUS.completed });
    expect(tm.getBlockedTasks()).toHaveLength(0);
  });
});
