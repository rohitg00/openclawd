export const AGENT_STATUS = {
  idle: 'idle',
  busy: 'busy',
  error: 'error',
  killed: 'killed'
};

export const TASK_STATUS = {
  pending: 'pending',
  in_progress: 'in_progress',
  completed: 'completed',
  failed: 'failed'
};

export const PERMISSION_PRESETS = {
  full: {
    allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'TodoWrite', 'Skill']
  },
  edit: {
    allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Grep']
  },
  plan: {
    allowedTools: ['Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch']
  },
  ask: {
    allowedTools: ['Read', 'Glob', 'Grep']
  }
};
