// controllers/aiTodoController.js
import { listTodos, generateAndSaveTodos, setTodoDone } from '../services/aiTodoService.js';

const authorized = (req) => {
  if (!process.env.CRON_SECRET) return true;
  return req.headers['authorization'] === `Bearer ${process.env.CRON_SECRET}` || req.query.key === process.env.CRON_SECRET;
};

// GET /api/v1/ads-boosting/todos?limit=300
export async function getTodos(req, res) {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(await listTodos(req.query.limit));
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// PATCH /api/v1/ads-boosting/todos/:id   body { done: true|false, done_by: "Tâm" }
export async function patchTodo(req, res) {
  if (typeof req.body?.done !== 'boolean') return res.status(400).json({ success: false, message: 'done must be true or false' });
  try {
    const row = await setTodoDone(req.params.id, req.body.done, req.body.done_by);
    if (!row) return res.status(404).json({ success: false, message: 'ToDo not found' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// GET  /api/v1/cron/ai-todo                    (Vercel cron, Authorization: Bearer CRON_SECRET)
// POST /api/v1/ads-boosting/todos/generate     (?date=YYYY-MM-DD&force=1&dry=1)
export async function runTodos(req, res) {
  if (!authorized(req)) return res.status(401).json({ success: false, message: 'Unauthorized' });
  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || '') ? req.query.date : undefined;
  try {
    const out = await generateAndSaveTodos({ date, force: req.query.force === '1', dryRun: req.query.dry === '1' });
    res.json({ success: true, ...out });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}
