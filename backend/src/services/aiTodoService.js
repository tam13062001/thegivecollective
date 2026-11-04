// services/aiTodoService.js — đọc dữ liệu ads trong MongoDB, chạy rule engine, lưu AI ToDo.
import AdsDaily from '../models/AdsDaily.js';
import AdsBreakdown from '../models/AdsBreakdown.js';
import AiTodo from '../models/AiTodo.js';
import { getAdsSyncState } from './adsSyncService.js';
import { summarize, generateTodos, todaySGT } from './aiTodoEngine.js';

const HIDE = { _id: 0, __v: 0, key: 0, createdAt: 0, updatedAt: 0 };
const PUBLIC = { _id: 0, __v: 0, createdAt: 0, updatedAt: 0 };

export const listTodos = (limit = 300) =>
  AiTodo.find({}, PUBLIC).sort({ date: -1, rank: 1 }).limit(Math.min(Number(limit) || 300, 1000)).lean();

/**
 * Sinh ToDo cho ngày `date` (mặc định hôm nay giờ SGT) và lưu vào DB.
 * - Ngày đó đã có ToDo -> bỏ qua (trừ khi force=true: xoá ToDo CHƯA tick của ngày đó rồi sinh lại).
 * - dryRun=true -> chỉ trả kết quả, không ghi.
 */
export async function generateAndSaveTodos({ date = todaySGT(), force = false, dryRun = false } = {}) {
  const [utd, breakdowns, state] = await Promise.all([
    AdsDaily.find({}, HIDE).lean(),
    AdsBreakdown.find({}, HIDE).lean(),
    getAdsSyncState(),
  ]);
  if (!utd.length) return { status: 'skip', reason: 'no ad data in DB', todos: [] };

  if (force && !dryRun) await AiTodo.deleteMany({ date, done: false });
  const existing = await AiTodo.find({}, { _id: 0, date: 1, kind: 1, verb: 1, target: 1, done: 1, done_at: 1 }).lean();

  const summary = summarize(utd, breakdowns, state?.taken || '');
  const out = generateTodos(summary, existing, date);
  if (out.status !== 'ok' || dryRun) return out;

  const docs = out.todos.map((t) => ({ id: `${t.date}-${t.rank}`, ...t }));
  try {
    await AiTodo.insertMany(docs, { ordered: false });
  } catch (e) {
    if (e.code !== 11000) throw e; // 11000 = trùng id: lần chạy khác đã ghi trước, coi như xong
  }
  console.log('[AI-TODO]', date, out.reason, docs.map((d) => `${d.kind}:${d.target}`));
  return out;
}

/** Tick / bỏ tick. Chỉ cho đổi done, done_at, done_by. */
export async function setTodoDone(id, done, doneBy) {
  const on = Boolean(done);
  const by = on ? String(doneBy || '').trim().slice(0, 80) || null : null;
  return AiTodo.findOneAndUpdate(
    { id },
    { $set: { done: on, done_at: on ? new Date().toISOString() : null, done_by: by } },
    { new: true, projection: PUBLIC },
  ).lean();
}
