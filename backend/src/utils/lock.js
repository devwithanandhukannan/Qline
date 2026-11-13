import crypto from 'node:crypto';
import { Lock } from '../models/Lock.js';

const memQueues = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Serializes async callbacks sharing the same key inside this Node process.
 * Sorted multi-key acquisition prevents deadlocks.
 */
export async function withMemoryLock(keys, fn) {
  const ordered = [...new Set(Array.isArray(keys) ? keys : [keys])].sort();
  if (!ordered.length) return fn();

  const acquire = async (idx) => {
    if (idx >= ordered.length) return fn();
    const key = ordered[idx];
    const prev = memQueues.get(key) || Promise.resolve();
    let release;
    const next = new Promise((r) => {
      release = r;
    });
    const tail = prev.then(() => next, () => next);
    memQueues.set(key, tail);

    await prev.catch(() => {});
    try {
      return await acquire(idx + 1);
    } finally {
      release();
      if (memQueues.get(key) === tail) memQueues.delete(key);
    }
  };

  return acquire(0);
}

async function acquireDbLock(key, ttlMs = 8000, timeoutMs = 5000) {
  const token = crypto.randomUUID();
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMs);
    try {
      const doc = await Lock.findOneAndUpdate(
        { _id: key, $or: [{ expiresAt: { $lte: now } }, { token }] },
        { $set: { token, expiresAt } },
        { upsert: true, returnDocument: 'after' }
      ).lean();
      if (doc?.token === token) return token;
    } catch (err) {
      if (err?.code !== 11000) throw err;
    }
    await sleep(15 + Math.floor(Math.random() * 25));
  }
  throw new Error(`Could not acquire distributed lock for ${key}`);
}

async function releaseDbLock(key, token) {
  try {
    await Lock.deleteOne({ _id: key, token });
  } catch {
    // TTL index cleans up stale lock if release fails
  }
}

/**
 * Two-tier lock: fast in-process FIFO serialization + MongoDB atomic lease
 * for multi-instance safety (works on both standalone MongoDB and Replica Sets).
 */
export async function withDistributedLock(keys, fn) {
  const ordered = [...new Set(Array.isArray(keys) ? keys : [keys])].sort();
  return withMemoryLock(ordered, async () => {
    const acquired = [];
    try {
      for (const k of ordered) {
        const token = await acquireDbLock(k);
        acquired.push([k, token]);
      }
      return await fn();
    } finally {
      for (let i = acquired.length - 1; i >= 0; i--) {
        const [k, token] = acquired[i];
        await releaseDbLock(k, token);
      }
    }
  });
}

