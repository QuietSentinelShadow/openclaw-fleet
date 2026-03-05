import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import http from 'http';

const execAsync = promisify(exec);

const app = express();
const db = new Database('openclaw_fleet.db');

// Docker and Ollama configuration
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OPENCLAW_IMAGE = process.env.OPENCLAW_IMAGE || 'ghcr.io/openclaw/openclaw:latest';

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

// ============ Docker Service Functions ============

/**
 * Check if Docker is available
 */
async function isDockerAvailable() {
  try {
    const { stdout } = await execAsync('docker info --format "{{.ServerVersion}}"');
    return stdout.trim().length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Check if a Docker image exists locally
 */
async function imageExists(imageName) {
  try {
    const { stdout } = await execAsync(`docker image inspect ${imageName} --format "{{.Id}}"`);
    return stdout.trim().length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Pull Docker image
 */
async function pullImage(imageName) {
  return new Promise((resolve, reject) => {
    const process = spawn('docker', ['pull', imageName]);
    let output = '';
    
    process.stdout.on('data', (data) => { output += data; });
    process.stderr.on('data', (data) => { output += data; });
    
    process.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, output });
      } else {
        reject(new Error(`Failed to pull image: ${output}`));
      }
    });
  });
}

/**
 * Create Docker container for OpenClaw instance
 */
async function createContainer(instance) {
  const containerName = `openclaw-${instance.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
  const workspacePath = instance.workspace_path || `/tmp/openclaw/${instance.id}`;
  
  const envFlags = [
    `-e OPENCLAW_GATEWAY_PORT=${instance.port}`,
    `-e OPENCLAW_OLLAMA_BASE_URL=http://host.docker.internal:11434`,
    `-e OPENCLAW_MODEL=${instance.ollama_model}`,
    `-e OPENCLAW_BIND=lan`
  ];
  
  const cmd = [
    'create',
    '--name', containerName,
    '-p', `${instance.port}:18789`,
    ...envFlags,
    '-v', `${workspacePath}:/home/node/.openclaw/workspace`,
    '--add-host', 'host.docker.internal:host-gateway',
    '-l', 'openclaw-fleet.managed=true',
    '-l', `openclaw-fleet.instance-id=${instance.id}`,
    '-l', `openclaw-fleet.agent-role=${instance.agent_role}`,
    OPENCLAW_IMAGE
  ];
  
  const { stdout } = await execAsync(`docker ${cmd.join(' ')}`);
  return { containerId: stdout.trim(), containerName };
}

/**
 * Start Docker container
 */
async function startContainerDocker(containerId) {
  await execAsync(`docker start ${containerId}`);
}

/**
 * Stop Docker container
 */
async function stopContainerDocker(containerId) {
  await execAsync(`docker stop -t 30 ${containerId}`);
}

/**
 * Remove Docker container
 */
async function removeContainer(containerId) {
  await execAsync(`docker rm -f ${containerId}`);
}

/**
 * Get container status
 */
async function getContainerStatus(containerId) {
  try {
    const { stdout } = await execAsync(`docker inspect ${containerId} --format '{{.State.Status}} {{.State.Running}}'`);
    const [status, running] = stdout.trim().split(' ');
    return { status, isRunning: running === 'true' };
  } catch (error) {
    return { status: 'not_found', isRunning: false };
  }
}

/**
 * Get container logs
 */
async function getContainerLogsDocker(containerId, tail = 100) {
  try {
    const { stdout } = await execAsync(`docker logs ${containerId} --tail ${tail} 2>&1`);
    return stdout;
  } catch (error) {
    return `Error getting logs: ${error.message}`;
  }
}

/**
 * List all OpenClaw Fleet containers
 */
async function listFleetContainers() {
  try {
    const { stdout } = await execAsync(`docker ps -a --filter "label=openclaw-fleet.managed=true" --format "{{.ID}}|{{.Names}}|{{.Status}}"`);
    if (!stdout.trim()) return [];
    
    return stdout.trim().split('\n').map(line => {
      const [id, name, status] = line.split('|');
      return { id, name, status };
    });
  } catch (error) {
    return [];
  }
}

// ============ Ollama Service Functions ============

/**
 * Check if Ollama is available
 */
async function isOllamaAvailable() {
  return new Promise((resolve) => {
    const req = http.request(
      `${OLLAMA_BASE_URL}/`,
      { method: 'GET', timeout: 5000 },
      (res) => resolve(res.statusCode === 200)
    );
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

/**
 * Get available Ollama models
 */
async function getOllamaModels() {
  return new Promise((resolve, reject) => {
    const req = http.request(
      `${OLLAMA_BASE_URL}/api/tags`,
      { method: 'GET', timeout: 10000 },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed.models || []);
          } catch (e) {
            resolve([]);
          }
        });
      }
    );
    req.on('error', () => resolve([]));
    req.on('timeout', () => { req.destroy(); resolve([]); });
    req.end();
  });
}

/**
 * Check if specific model is available
 */
async function isModelAvailable(modelName) {
  const models = await getOllamaModels();
  return models.some(m => m.name === modelName || m.name.startsWith(`${modelName}:`));
}

/**
 * Pull/download model from Ollama
 */
async function pullOllamaModel(modelName) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ name: modelName, stream: false });
    
    const req = http.request(
      `${OLLAMA_BASE_URL}/api/pull`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
        timeout: 600000 // 10 minutes for large models
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve({ success: true });
          } else {
            reject(new Error(`Failed to pull model: ${data}`));
          }
        });
      }
    );
    req.on('error', (e) => reject(e));
    req.write(postData);
    req.end();
  });
}

/**
 * Generate chat completion using Ollama
 */
async function ollamaChat(model, messages) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model,
      messages,
      stream: false
    });
    
    const startTime = Date.now();
    
    const req = http.request(
      `${OLLAMA_BASE_URL}/api/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
        timeout: 300000 // 5 minutes
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const latency = Date.now() - startTime;
          if (res.statusCode === 200) {
            try {
              const parsed = JSON.parse(data);
              resolve({
                success: true,
                response: parsed.message?.content || '',
                model: parsed.model,
                latency,
                promptTokens: parsed.prompt_eval_count,
                responseTokens: parsed.eval_count
              });
            } catch (e) {
              reject(new Error(`Failed to parse Ollama response: ${e.message}`));
            }
          } else {
            reject(new Error(`Ollama request failed: ${data}`));
          }
        });
      }
    );
    req.on('error', (e) => reject(e));
    req.on('timeout', () => { req.destroy(); reject(new Error('Ollama request timed out')); });
    req.write(postData);
    req.end();
  });
}

/**
 * Send message to running OpenClaw container via its exposed port
 */
async function sendToOpenClaw(port, message, soulContent) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      message,
      context: soulContent
    });
    
    const startTime = Date.now();
    
    const req = http.request(
      `http://localhost:${port}/api/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
        timeout: 60000
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const latency = Date.now() - startTime;
          if (res.statusCode === 200) {
            try {
              const parsed = JSON.parse(data);
              resolve({ success: true, response: parsed.response || data, latency });
            } catch (e) {
              resolve({ success: true, response: data, latency });
            }
          } else {
            // If OpenClaw container doesn't respond, fallback to direct Ollama
            resolve({ success: false, error: `Container returned ${res.statusCode}`, latency });
          }
        });
      }
    );
    req.on('error', (e) => resolve({ success: false, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ success: false, error: 'Timeout' }); });
    req.write(postData);
    req.end();
  });
}

// ============ API Routes ============

// System status
app.get('/api/fleet/status', async (req, res) => {
  const dockerAvailable = await isDockerAvailable();
  const ollamaAvailable = await isOllamaAvailable();
  const models = ollamaAvailable ? await getOllamaModels() : [];
  
  res.json({
    docker: { available: dockerAvailable },
    ollama: { 
      available: ollamaAvailable, 
      baseUrl: OLLAMA_BASE_URL,
      models: models.map(m => ({ name: m.name, size: m.size, modified: m.modified_at }))
    }
  });
});

// Get all instances
app.get('/api/fleet/instances', async (req, res) => {
  const instances = db.prepare('SELECT * FROM instances ORDER BY created_at DESC').all();
  
  // Update status from Docker for each instance with a container
  const updatedInstances = await Promise.all(instances.map(async (inst) => {
    if (inst.container_id) {
      try {
        const { status, isRunning } = await getContainerStatus(inst.container_id);
        return { ...inst, dockerStatus: status, status: isRunning ? 'running' : 'stopped' };
      } catch (e) {
        return inst;
      }
    }
    return inst;
  }));
  
  res.json(updatedInstances);
});

// Get single instance
app.get('/api/fleet/instances/:id', (req, res) => {
  const instance = db.prepare('SELECT * FROM instances WHERE id = ?').get(req.params.id);
  if (!instance) return res.status(404).json({ error: 'Instance not found' });
  res.json(instance);
});

// Create instance
app.post('/api/fleet/instances', async (req, res) => {
  const { name, description, agentRoleId, ollamaModel, soulContent, agentsContent, workspacePath } = req.body;
  
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
  const workspace = workspacePath || `/tmp/openclaw/${name.toLowerCase().replace(/\s+/g, '-')}`;

  // Check if model is available
  const modelAvailable = await isModelAvailable(model);
  
  db.prepare(`
    INSERT INTO instances (id, name, description, agent_role, port, ollama_model, soul_content, agents_content, workspace_path, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'stopped')
  `).run(id, name, description || '', role.key, port, model, soul, agents, workspace);

  const instance = db.prepare('SELECT * FROM instances WHERE id = ?').get(id);
  
  res.status(201).json({
    ...instance,
    modelAvailable,
    warning: !modelAvailable ? `Model '${model}' not found in Ollama. You may need to pull it first.` : null
  });
});

// Update instance
app.put('/api/fleet/instances/:id', (req, res) => {
  const { description, ollamaModel, soulContent, agentsContent, customConfig, workspacePath } = req.body;
  
  const instance = db.prepare('SELECT * FROM instances WHERE id = ?').get(req.params.id);
  if (!instance) return res.status(404).json({ error: 'Instance not found' });

  db.prepare(`
    UPDATE instances SET 
      description = COALESCE(?, description),
      ollama_model = COALESCE(?, ollama_model),
      soul_content = COALESCE(?, soul_content),
      agents_content = COALESCE(?, agents_content),
      custom_config = COALESCE(?, custom_config),
      workspace_path = COALESCE(?, workspace_path)
    WHERE id = ?
  `).run(description, ollamaModel, soulContent, agentsContent, customConfig, workspacePath, req.params.id);

  const updated = db.prepare('SELECT * FROM instances WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// Delete instance
app.delete('/api/fleet/instances/:id', async (req, res) => {
  const instance = db.prepare('SELECT * FROM instances WHERE id = ?').get(req.params.id);
  if (!instance) return res.status(404).json({ error: 'Instance not found' });
  
  // Stop and remove container if it exists
  if (instance.container_id) {
    try {
      await stopContainerDocker(instance.container_id);
      await removeContainer(instance.container_id);
    } catch (e) {
      console.error('Error cleaning up container:', e.message);
    }
  }
  
  db.prepare('DELETE FROM instances WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

// Start instance (creates and starts Docker container)
app.post('/api/fleet/instances/:id/start', async (req, res) => {
  const instance = db.prepare('SELECT * FROM instances WHERE id = ?').get(req.params.id);
  if (!instance) return res.status(404).json({ error: 'Instance not found' });

  try {
    // Check Docker availability
    if (!(await isDockerAvailable())) {
      return res.status(503).json({ error: 'Docker is not available. Please ensure Docker Desktop is running.' });
    }

    // Check/pull image
    if (!(await imageExists(OPENCLAW_IMAGE))) {
      console.log(`Pulling OpenClaw image: ${OPENCLAW_IMAGE}`);
      await pullImage(OPENCLAW_IMAGE);
    }

    // Check model availability
    if (!(await isModelAvailable(instance.ollama_model))) {
      console.log(`Model ${instance.ollama_model} not found, attempting to pull...`);
      try {
        await pullOllamaModel(instance.ollama_model);
      } catch (e) {
        return res.status(503).json({ 
          error: `Model '${instance.ollama_model}' not available in Ollama and pull failed: ${e.message}` 
        });
      }
    }

    // Create container if not exists
    let containerId = instance.container_id;
    let containerName = instance.container_name;
    
    if (!containerId) {
      const result = await createContainer(instance);
      containerId = result.containerId;
      containerName = result.containerName;
      
      db.prepare(`
        UPDATE instances SET container_id = ?, container_name = ? WHERE id = ?
      `).run(containerId, containerName, req.params.id);
    }

    // Start container
    await startContainerDocker(containerId);
    
    // Update status
    db.prepare(`
      UPDATE instances SET status = 'running', last_started_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(req.params.id);

    // Log audit
    db.prepare(`
      INSERT INTO audit_logs (id, instance_id, direction, type, content, is_success)
      VALUES (?, ?, 'internal', 'command', ?, 1)
    `).run(uuidv4(), req.params.id, `Instance started on port ${instance.port}`);

    const updated = db.prepare('SELECT * FROM instances WHERE id = ?').get(req.params.id);
    res.json({ message: 'Instance started', instance: updated, containerId, port: instance.port });
    
  } catch (error) {
    console.error('Error starting instance:', error);
    
    // Log failed attempt
    db.prepare(`
      INSERT INTO audit_logs (id, instance_id, direction, type, content, is_success, error_message)
      VALUES (?, ?, 'internal', 'command', 'Instance start', 0, ?)
    `).run(uuidv4(), req.params.id, error.message);
    
    res.status(500).json({ error: error.message });
  }
});

// Stop instance
app.post('/api/fleet/instances/:id/stop', async (req, res) => {
  const instance = db.prepare('SELECT * FROM instances WHERE id = ?').get(req.params.id);
  if (!instance) return res.status(404).json({ error: 'Instance not found' });

  try {
    if (instance.container_id) {
      await stopContainerDocker(instance.container_id);
    }
    
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
    
  } catch (error) {
    console.error('Error stopping instance:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get instance logs
app.get('/api/fleet/instances/:id/logs', async (req, res) => {
  const instance = db.prepare('SELECT * FROM instances WHERE id = ?').get(req.params.id);
  if (!instance) return res.status(404).json({ error: 'Instance not found' });
  
  let logs = '';
  if (instance.container_id) {
    try {
      logs = await getContainerLogsDocker(instance.container_id, 200);
    } catch (e) {
      logs = `Error fetching logs: ${e.message}`;
    }
  } else {
    logs = 'No container associated with this instance.';
  }
  
  res.json({ logs });
});

// Get agent roles
app.get('/api/fleet/roles', (req, res) => {
  const roles = db.prepare('SELECT * FROM agent_roles WHERE is_active = 1').all();
  res.json(roles);
});

// Get fleet stats
app.get('/api/fleet/stats', async (req, res) => {
  const instances = db.prepare('SELECT status, COUNT(*) as count FROM instances GROUP BY status').all();
  const tasks = db.prepare('SELECT status, COUNT(*) as count FROM tasks WHERE status IN (?, ?) GROUP BY status').all('pending', 'running');
  
  const stats = {
    docker: { available: await isDockerAvailable() },
    ollama: { available: await isOllamaAvailable() },
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
  const { instanceId, limit = 100, offset = 0 } = req.query;
  
  let query = 'SELECT * FROM audit_logs';
  const params = [];
  
  if (instanceId) {
    query += ' WHERE instance_id = ?';
    params.push(instanceId);
  }
  
  query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));
  
  const logs = db.prepare(query).all(...params);
  res.json(logs);
});

// Send message to instance (communicates via container's exposed port)
app.post('/api/fleet/instances/:id/chat', async (req, res) => {
  const { message, useDirectOllama } = req.body;
  const instance = db.prepare('SELECT * FROM instances WHERE id = ?').get(req.params.id);
  
  if (!instance) return res.status(404).json({ error: 'Instance not found' });
  if (instance.status !== 'running') return res.status(400).json({ error: 'Instance is not running' });

  const auditId = uuidv4();
  const startTime = Date.now();
  
  try {
    let result;
    
    if (useDirectOllama || !instance.container_id) {
      // Direct Ollama communication (fallback or when requested)
      const messages = [
        { role: 'system', content: instance.soul_content },
        { role: 'user', content: message }
      ];
      
      result = await ollamaChat(instance.ollama_model, messages);
      
      // Log audit
      db.prepare(`
        INSERT INTO audit_logs (id, instance_id, direction, type, content, response, model, latency_ms, request_tokens, response_tokens, is_success, source, destination)
        VALUES (?, ?, 'inbound', 'chat', ?, ?, ?, ?, ?, ?, 1, 'user', 'ollama')
      `).run(auditId, req.params.id, message, result.response, result.model, result.latency, result.promptTokens, result.responseTokens);
      
      res.json({ 
        response: result.response, 
        auditId, 
        latencyMs: result.latency,
        model: result.model,
        tokens: { prompt: result.promptTokens, response: result.responseTokens }
      });
    } else {
      // Communicate via OpenClaw container's exposed port
      result = await sendToOpenClaw(instance.port, message, instance.soul_content);
      
      if (result.success) {
        // Log audit
        db.prepare(`
          INSERT INTO audit_logs (id, instance_id, direction, type, content, response, model, latency_ms, is_success, source, destination)
          VALUES (?, ?, 'inbound', 'chat', ?, ?, ?, ?, 1, 'user', ?)
        `).run(auditId, req.params.id, message, result.response, instance.ollama_model, result.latency, `container:${instance.port}`);
        
        res.json({ 
          response: result.response, 
          auditId, 
          latencyMs: result.latency,
          port: instance.port
        });
      } else {
        // Container didn't respond properly, fallback to direct Ollama
        console.log(`Container on port ${instance.port} didn't respond, using direct Ollama`);
        
        const messages = [
          { role: 'system', content: instance.soul_content },
          { role: 'user', content: message }
        ];
        
        const ollamaResult = await ollamaChat(instance.ollama_model, messages);
        
        // Log audit with fallback info
        db.prepare(`
          INSERT INTO audit_logs (id, instance_id, direction, type, content, response, model, latency_ms, is_success, source, destination, metadata)
          VALUES (?, ?, 'inbound', 'chat', ?, ?, ?, ?, 1, 'user', 'ollama', ?)
        `).run(auditId, req.params.id, message, ollamaResult.response, ollamaResult.model, ollamaResult.latency, 
          JSON.stringify({ fallback: true, containerError: result.error }));
        
        res.json({ 
          response: ollamaResult.response, 
          auditId, 
          latencyMs: ollamaResult.latency,
          model: ollamaResult.model,
          fallback: true,
          fallbackReason: result.error
        });
      }
    }
  } catch (error) {
    const latency = Date.now() - startTime;
    
    // Log failed attempt
    db.prepare(`
      INSERT INTO audit_logs (id, instance_id, direction, type, content, is_success, error_message, latency_ms)
      VALUES (?, ?, 'inbound', 'chat', ?, 0, ?, ?)
    `).run(auditId, req.params.id, message, error.message, latency);
    
    res.status(500).json({ error: error.message, auditId });
  }
});

// Orchestrator: Broadcast message to multiple instances
app.post('/api/fleet/broadcast', async (req, res) => {
  const { message, instanceIds, parallel = true } = req.body;
  
  if (!message || !instanceIds || !Array.isArray(instanceIds) || instanceIds.length === 0) {
    return res.status(400).json({ error: 'Message and instanceIds array are required' });
  }
  
  const broadcastId = uuidv4();
  const results = [];
  
  const sendToInstance = async (instanceId) => {
    const instance = db.prepare('SELECT * FROM instances WHERE id = ?').get(instanceId);
    if (!instance || instance.status !== 'running') {
      return { instanceId, success: false, error: 'Instance not running' };
    }
    
    try {
      const messages = [
        { role: 'system', content: instance.soul_content },
        { role: 'user', content: message }
      ];
      
      const result = await ollamaChat(instance.ollama_model, messages);
      
      // Log audit
      db.prepare(`
        INSERT INTO audit_logs (id, instance_id, direction, type, content, response, model, latency_ms, is_success, source, destination)
        VALUES (?, ?, 'broadcast', 'chat', ?, ?, ?, ?, 1, 'orchestrator', ?)
      `).run(uuidv4(), instanceId, message, result.response, result.model, result.latency, instance.name);
      
      return {
        instanceId,
        instanceName: instance.name,
        success: true,
        response: result.response,
        latencyMs: result.latency
      };
    } catch (error) {
      return { instanceId, instanceName: instance.name, success: false, error: error.message };
    }
  };
  
  if (parallel) {
    const promises = instanceIds.map(sendToInstance);
    results.push(...await Promise.all(promises));
  } else {
    for (const instanceId of instanceIds) {
      results.push(await sendToInstance(instanceId));
    }
  }
  
  // Log broadcast
  db.prepare(`
    INSERT INTO audit_logs (id, instance_id, direction, type, content, response, is_success, source)
    VALUES (?, ?, 'internal', 'broadcast', ?, ?, 1, 'orchestrator')
  `).run(broadcastId, null, message, JSON.stringify(results.map(r => ({ id: r.instanceId, success: r.success }))));
  
  res.json({ broadcastId, results });
});

// Ollama models endpoint
app.get('/api/fleet/models', async (req, res) => {
  try {
    const models = await getOllamaModels();
    res.json(models);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Pull model endpoint
app.post('/api/fleet/models/:name/pull', async (req, res) => {
  try {
    const result = await pullOllamaModel(req.params.name);
    res.json({ success: true, message: `Model ${req.params.name} pulled successfully` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 5001;
app.listen(PORT, async () => {
  console.log(`🚀 OpenClaw Fleet API running at http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:4200 (after starting Angular)`);
  
  // Check services
  const dockerAvailable = await isDockerAvailable();
  const ollamaAvailable = await isOllamaAvailable();
  
  console.log(`\n📊 System Status:`);
  console.log(`   Docker:  ${dockerAvailable ? '✅ Available' : '❌ Not available'}`);
  console.log(`   Ollama:  ${ollamaAvailable ? '✅ Available' : '❌ Not available'}`);
  
  if (ollamaAvailable) {
    const models = await getOllamaModels();
    console.log(`   Models:  ${models.map(m => m.name).join(', ') || 'None'}`);
  }
  
  console.log(`\n📡 API Endpoints:`);
  console.log(`   GET  /api/fleet/status        - System status`);
  console.log(`   GET  /api/fleet/instances     - List instances`);
  console.log(`   POST /api/fleet/instances     - Create instance`);
  console.log(`   POST /api/fleet/instances/:id/start  - Start instance`);
  console.log(`   POST /api/fleet/instances/:id/stop   - Stop instance`);
  console.log(`   POST /api/fleet/instances/:id/chat   - Chat with instance`);
  console.log(`   POST /api/fleet/broadcast     - Broadcast to multiple instances`);
  console.log(`   GET  /api/fleet/audit         - Get audit logs`);
  console.log(`   GET  /api/fleet/models        - List Ollama models`);
});