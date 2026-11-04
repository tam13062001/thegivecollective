// models/AiTodo.js — 1 document / 1 AI ToDo (cùng schema với bảng "todos" của dashboard artifact)
import mongoose from 'mongoose';

const aiTodoSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true }, // "YYYY-MM-DD-<rank>", vd 2026-11-05-1
    schema: { type: Number, default: 1 },
    date: { type: String, required: true, index: true }, // YYYY-MM-DD theo giờ Singapore
    rank: { type: Number, required: true },
    generated_at: String,
    data_as_of: String,
    generated_by: String,
    kind: { type: String, enum: ['fix', 'pause', 'scale', 'reopen', 'retry'], required: true },
    verb: String,
    level: { type: String, enum: ['Account', 'Campaign', 'Ad set', 'Ad', 'Placement', 'Audience'] },
    target: String,
    campaign: String,
    adset: String,
    why: String,
    steps: [String],
    expected_impact: String,
    confidence: { type: String, enum: ['high', 'medium', 'low'] },
    done: { type: Boolean, default: false },
    done_at: { type: String, default: null },
    done_by: { type: String, default: null },
  },
  { timestamps: true },
);
aiTodoSchema.index({ date: -1, rank: 1 });

export default mongoose.model('AiTodo', aiTodoSchema);
