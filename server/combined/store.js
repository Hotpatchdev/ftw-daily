const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// One staging Node process owns this journal and worker. Keep it in shared/,
// outside numbered releases. Never store user tokens or payment credentials.
class BookingStore {
  constructor(directory) {
    if (!directory || !path.isAbsolute(directory)) throw new Error('A durable booking store is required.');
    this.directory = directory;
    this.locks = new Map();
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  }
  key(customer, attempt) {
    if (typeof attempt !== 'string' || !/^[a-zA-Z0-9-]{20,80}$/.test(attempt))
      throw new Error('Invalid checkout reference.');
    return crypto.createHash('sha256').update(`${customer}:${attempt}`).digest('hex');
  }
  file(key) {
    if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('Invalid booking reference.');
    return path.join(this.directory, `${key}.json`);
  }
  read(key) {
    try { return JSON.parse(fs.readFileSync(this.file(key), 'utf8')); }
    catch (e) { if (e.code === 'ENOENT') return null; throw e; }
  }
  save(record) {
    const file = this.file(record.key);
    const temporary = `${file}.${process.pid}.tmp`;
    const fd = fs.openSync(temporary, 'w', 0o600);
    try { fs.writeFileSync(fd, JSON.stringify(record)); fs.fsyncSync(fd); }
    finally { fs.closeSync(fd); }
    fs.renameSync(temporary, file);
    const dir = fs.openSync(this.directory, 'r');
    try { fs.fsyncSync(dir); } finally { fs.closeSync(dir); }
  }
  records() {
    return fs.readdirSync(this.directory).filter(f => /^[a-f0-9]{64}\.json$/.test(f))
      .map(f => this.read(f.slice(0, -5)));
  }
  async lock(key, operation) {
    const previous = this.locks.get(key) || Promise.resolve();
    let release;
    const waiting = new Promise(resolve => { release = resolve; });
    this.locks.set(key, waiting);
    await previous;
    try { return await operation(); }
    finally { release(); if (this.locks.get(key) === waiting) this.locks.delete(key); }
  }
}
module.exports = { BookingStore };
