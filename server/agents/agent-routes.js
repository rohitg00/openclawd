import { Router } from 'express';

export function createAgentRouter(agentManager, taskManager, sessionManager) {
  const router = Router();

  router.post('/ask', async (req, res) => {
    const { message, provider, model, systemPrompt, permissions } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required' });

    try {
      const response = await agentManager.ask(message, { provider, model, systemPrompt, permissions });
      res.json({ response });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/tasks', (_req, res) => {
    res.json({ tasks: taskManager.listTasks() });
  });

  router.post('/tasks', (req, res) => {
    const { title, description, priority } = req.body;
    if (!title) return res.status(400).json({ error: 'title is required' });

    try {
      const task = taskManager.createTask({ title, description, priority });
      res.status(201).json(task);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.patch('/tasks/:id', (req, res) => {
    try {
      const task = taskManager.updateTask(req.params.id, req.body);
      res.json(task);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  });

  router.post('/tasks/:id/assign', (req, res) => {
    const { agentName } = req.body;
    if (!agentName) return res.status(400).json({ error: 'agentName is required' });

    try {
      const task = taskManager.assignTask(req.params.id, agentName);
      res.json(task);
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  });

  router.delete('/tasks/:id', (req, res) => {
    try {
      taskManager.deleteTask(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  });

  router.get('/sessions', (_req, res) => {
    res.json({ sessions: sessionManager.listSessions() });
  });

  router.post('/sessions', (req, res) => {
    const { name, provider, model } = req.body;
    const session = sessionManager.createSession({ name, provider, model });
    res.status(201).json(session);
  });

  router.post('/sessions/:id/agents', (req, res) => {
    const { name, provider, model, systemPrompt, permissions } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    try {
      const agent = sessionManager.addAgentToSession(req.params.id, {
        name, provider, model, systemPrompt, permissions
      });
      res.status(201).json(agent.toJSON());
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  });

  router.delete('/sessions/:id', (req, res) => {
    try {
      sessionManager.closeSession(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  });

  router.get('/', (_req, res) => {
    res.json({ agents: agentManager.listAgents() });
  });

  router.post('/', (req, res) => {
    const { name, provider, model, systemPrompt, permissions } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    try {
      const agent = agentManager.createAgent({ name, provider, model, systemPrompt, permissions });
      res.status(201).json(agent.toJSON());
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get('/:name', (req, res) => {
    const agent = agentManager.getAgent(req.params.name);
    if (!agent) return res.status(404).json({ error: `Agent '${req.params.name}' not found` });
    res.json(agent.toJSON());
  });

  router.post('/:name/ask', async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required' });

    const agent = agentManager.getAgent(req.params.name);
    if (!agent) return res.status(404).json({ error: `Agent '${req.params.name}' not found` });

    try {
      const response = await agent.ask(message);
      res.json({ response });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/:name/stream', async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required' });

    const agent = agentManager.getAgent(req.params.name);
    if (!agent) return res.status(404).json({ error: `Agent '${req.params.name}' not found` });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const heartbeatInterval = setInterval(() => {
      if (!res.writableEnded) res.write(': heartbeat\n\n');
    }, 15000);

    res.on('close', () => clearInterval(heartbeatInterval));

    try {
      for await (const chunk of agent.stream(message)) {
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }
      }
    } catch (error) {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      }
    } finally {
      clearInterval(heartbeatInterval);
      if (!res.writableEnded) res.end();
    }
  });

  router.post('/:name/message', (req, res) => {
    const { to, content } = req.body;
    if (!content) return res.status(400).json({ error: 'content is required' });

    const from = req.params.name;
    const fromAgent = agentManager.getAgent(from);
    if (!fromAgent) return res.status(404).json({ error: `Agent '${from}' not found` });

    if (to) {
      try {
        agentManager.sendMessage(from, to, content);
        res.json({ success: true, to });
      } catch (error) {
        res.status(404).json({ error: error.message });
      }
    } else {
      const count = agentManager.broadcast(from, content);
      res.json({ success: true, broadcast: true, recipients: count });
    }
  });

  router.post('/:name/kill', (req, res) => {
    try {
      agentManager.killAgent(req.params.name);
      res.json({ success: true });
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  });

  return router;
}
