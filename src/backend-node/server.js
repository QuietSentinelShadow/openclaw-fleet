import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const db = new Database('openclaw_fleet.db');

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS instances (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    agent_role TEXT NOT NULL,
    container_id TEXT,
    container_name TEXT,
    port INTEGER UNIQUE,
    status TEXT DEFAULT 'stopped',
    ollama_model TEXT,
    workspace_path TEXT,
    custom_config TEXT,
    soul_content TEXT,
    agents_content TEXT,
    skills_path TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_started_at TEXT,
    last_stopped_at TEXT
  );

  CREATE TABLE IF NOT EXISTS agent_roles (
    id TEXT PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    default_model TEXT,
    default_soul_content TEXT,
    default_agents_content TEXT,
    capabilities TEXT,
    default_skills TEXT,
    is_system INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    instance_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    type TEXT,
    status TEXT DEFAULT 'pending',
    priority INTEGER DEFAULT 5,
    required_capabilities TEXT,
    preferred_model TEXT,
    submitted_by TEXT,
    input_data TEXT,
    result TEXT,
    error_message TEXT,
    parent_task_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    started_at TEXT,
    completed_at TEXT,
    timeout_seconds INTEGER DEFAULT 300,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    instance_id TEXT,
    direction TEXT,
    type TEXT,
    content TEXT,
    response TEXT,
    source TEXT,
    destination TEXT,
    user_id TEXT,
    session_id TEXT,
    model TEXT,
    request_tokens INTEGER,
    response_tokens INTEGER,
    latency_ms INTEGER,
    is_success INTEGER DEFAULT 1,
    error_message TEXT,
    metadata TEXT,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed default roles
const roleCount = db.prepare('SELECT COUNT(*) as count FROM agent_roles').get();
if (roleCount.count === 0) {
  const defaultRoles = [
    ['code-helper', 'Code Helper', 'General coding assistance and debugging', 'llama3.2', 
     'You are a helpful coding assistant specialized in writing clean, efficient code.',
     'Focus on providing code solutions with explanations.'],
    ['code-reviewer', 'Code Reviewer', 'Code review and quality analysis', 'codellama',
     'You are an expert code reviewer focused on code quality, security, and best practices.',
     'Analyze code for bugs, security issues, and improvements.'],
    ['research-assistant', 'Research Assistant', 'Research and information gathering', 'mistral',
     'You are a research assistant skilled at finding and synthesizing information.',
     'Provide thorough research with citations when possible.'],
    ['task-orchestrator', 'Task Orchestrator', 'Multi-agent task coordination', 'llama3.2',
     'You are a task orchestrator that coordinates work between multiple agents.',
     'Break down complex tasks and coordinate agent collaboration.'],
    ['doc-writer', 'Documentation Writer', 'Technical documentation generation', 'mistral',
     'You are a technical writer skilled at creating clear documentation.',
     'Generate comprehensive documentation with examples.'],
    ['test-engineer', 'Test Engineer', 'Test case generation and QA', 'codellama',
     'You are a test engineer focused on quality assurance.',
     'Generate test cases and identify edge cases.']
  ];

  const insertRole = db.prepare(`
    INSERT INTO agent_roles (id, key, name, description, default_model, default_soul_content, default_agents_content, is_system, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1)
  `);

  for (const role of defaultRoles) {
    insertRole.run(uuidv4(), ...role);
  }
}

// Middleware
app.use(cors({ origin: 'http://localhost:4200', credentials: true }));
app.use(express.json());

// Helper to get next available port
function getNextPort() {
  const result = db.prepare('SELECT MAX(port) as maxPort FROM instances').get();
  return (result.maxPort || 8080) + 1;
}

// ============ API Routes ============

// Get all instances
app.get('/api/fleet/instances', (req, res) => {
  const instances = db.prepare('SELECT * FROM instances ORDER BY created_at DESC').all();
  res.json(instances.map(inst => ({
    ...inst,
    status: inst.status || 'stopped'
  })));
});

// Get single instance
app.get('/api/fleet/instances/:id', (req, res) => {
  const instance = db.prepare('SELECT * FROM instances WHERE id = ?').get(req.params.id);
  if (!instance) return res.status(404).json({ error: 'Instance not found' });
  res.json(instance);
});

// Create instance
app.post('/api/fleet/instances', (req, res) => {
  const { name, description, agentRoleId, ollamaModel, soulContent, agentsContent } = req.body;
  
  if (!name || !agentRoleId) {
    return res.status(400).json({ error: 'Name and agentRoleId are required' });
  }

  const role = db.prepare('SELECT * FROM agent_roles WHERE id = ?').get(agentRoleId);
  if (!role) {
    return res.status(400).json({ error: 'Invalid agent role' });
  }

  const id = uuidv4();
  const port = getNextPort();
  const model = ollamaModel || role.default_model;
  const soul = soulContent || role.default_soul_content;
  const agents = agentsContent || role.default_agents_content;

  db.prepare(`
    INSERT INTO instances (id, name, description, agent_role, port, ollama_model, soul_content, agents_content, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'stopped')
  `).run(id, name, description || '', role.key, port, model, soul, agents);

  const instance = db.prepare('SELECT * FROM instances WHERE id = ?').get(id);
  res.status(201).json(instance);
});

// Update instance
app.put('/api/fleet/instances/:id', (req, res) => {
  const { description, ollamaModel, soulContent, agentsContent, customConfig } = req.body;
  
  const instance = db.prepare('SELECT * FROM instances WHERE id = ?').get(req.params.id);
  if (!instance) return res.status(404).json({ error: 'Instance not found' });

  db.prepare(`
    UPDATE instances SET 
      description = COALESCE(?, description),
      ollama_model = COALESCE(?, ollama_model),
      soul_content = COALESCE(?, soul_content),
      agents_content = COALESCE(?, agents_content),
      custom_config = COALESCE(?, custom_config)
    WHERE id = ?
  `).run(description, ollamaModel, soulContent, agentsContent, customConfig, req.params.id);

  const updated = db.prepare('SELECT * FROM instances WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// Delete instance
app.delete('/api/fleet/instances/:id', (req, res) => {
  const instance = db.prepare('SELECT * FROM instances WHERE id = ?').get(req.params.id);
  if (!instance) return res.status(404).json({ error: 'Instance not found' });
  
  db.prepare('DELETE FROM instances WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

// Start instance
app.post('/api/fleet/instances/:id/start', (req, res) => {
  const instance = db.prepare('SELECT * FROM instances WHERE id = ?').get(req.params.id);
  if (!instance) return res.status(404).json({ error: 'Instance not found' });

  // Simulate starting (in real implementation, would use Docker)
  db.prepare(`
    UPDATE instances SET status = 'running', last_started_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(req.params.id);

  // Log audit
  db.prepare(`
    INSERT INTO audit_logs (id, instance_id, direction, type, content, is_success)
    VALUES (?, ?, 'internal', 'command', 'Instance started', 1)
  `).run(uuidv4(), req.params.id);

  const updated = db.prepare('SELECT * FROM instances WHERE id = ?').get(req.params.id);
  res.json({ message: 'Instance started', instance: updated });
});

// Stop instance
app.post('/api/fleet/instances/:id/stop', (req, res) => {
  const instance = db.prepare('SELECT * FROM instances WHERE id = ?').get(req.params.id);
  if (!instance) return res.status(404).json({ error: 'Instance not found' });

  db.prepare(`
    UPDATE instances SET status = 'stopped', last_stopped_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(req.params.id);

  // Log audit
  db.prepare(`
    INSERT INTO audit_logs (id, instance_id, direction, type, content, is_success)
    VALUES (?, ?, 'internal', 'command', 'Instance stopped', 1)
  `).run(uuidv4(), req.params.id);

  const updated = db.prepare('SELECT * FROM instances WHERE id = ?').get(req.params.id);
  res.json({ message: 'Instance stopped', instance: updated });
});

// Get instance logs
app.get('/api/fleet/instances/:id/logs', (req, res) => {
  const instance = db.prepare('SELECT * FROM instances WHERE id = ?').get(req.params.id);
  if (!instance) return res.status(404).json({ error: 'Instance not found' });
  
  // Return simulated logs
  const logs = `[${new Date().toISOString()}] Instance ${instance.name} (${instance.agent_role})
Status: ${instance.status}
Model: ${instance.ollama_model}
Port: ${instance.port}
---
Container logs would appear here when running with Docker.`;
  
  res.json({ logs });
});

// Get agent roles
app.get('/api/fleet/roles', (req, res) => {
  const roles = db.prepare('SELECT * FROM agent_roles WHERE is_active = 1').all();
  res.json(roles);
});

// Get fleet stats
app.get('/api/fleet/stats', (req, res) => {
  const instances = db.prepare('SELECT status, COUNT(*) as count FROM instances GROUP BY status').all();
  const tasks = db.prepare('SELECT status, COUNT(*) as count FROM tasks WHERE status IN (?, ?) GROUP BY status').all('pending', 'running');
  
  const stats = {
    instances: {
      total: 0,
      running: 0,
      stopped: 0,
      error: 0
    },
    tasks: {
      pending: 0,
      running: 0
    }
  };

  for (const inst of instances) {
    stats.instances.total += inst.count;
    if (inst.status === 'running') stats.instances.running = inst.count;
    if (inst.status === 'stopped') stats.instances.stopped = inst.count;
    if (inst.status === 'error') stats.instances.error = inst.count;
  }

  for (const task of tasks) {
    if (task.status === 'pending') stats.tasks.pending = task.count;
    if (task.status === 'running') stats.tasks.running = task.count;
  }

  res.json(stats);
});

// Get audit logs
app.get('/api/fleet/audit', (req, res) => {
  const logs = db.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100').all();
  res.json(logs);
});

// Send message to instance (chat)
app.post('/api/fleet/instances/:id/chat', (req, res) => {
  const { message } = req.body;
  const instance = db.prepare('SELECT * FROM instances WHERE id = ?').get(req.params.id);
  
  if (!instance) return res.status(404).json({ error: 'Instance not found' });
  if (instance.status !== 'running') return res.status(400).json({ error: 'Instance is not running' });

  // Log the inbound message
  const auditId = uuidv4();
  const startTime = Date.now();
  
  // Simulate response (in real implementation, would call Ollama)
  const response = `[${instance.agent_role}] I received your message: "${message}"\n\n` +
    `I'm running on model ${instance.ollama_model}. In a full deployment, I would process ` +
    `your request using Ollama and provide a helpful response based on my role as ${instance.name}.`;

  const latency = Date.now() - startTime;

  // Log audit
  db.prepare(`
    INSERT INTO audit_logs (id, instance_id, direction, type, content, response, model, latency_ms, is_success)
    VALUES (?, ?, 'inbound', 'chat', ?, ?, ?, ?, 1)
  `).run(auditId, req.params.id, message, response, instance.ollama_model, latency);

  res.json({ response, auditId, latencyMs: latency });
});

// Start server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`🚀 OpenClaw Fleet API running at http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:4200 (after starting Angular)`);
  console.log(`\nAPI Endpoints:`);
  console.log(`  GET  /api/fleet/instances`);
  console.log(`  POST /api/fleet/instances`);
  console.log(`  GET  /api/fleet/roles`);
  console.log(`  GET  /api/fleet/stats`);
});