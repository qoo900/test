// 방(room)별 JSON 파일 저장소. 외부 DB 없이 data/<room>.json 에 저장합니다.
// 80~100명 규모에서는 충분하며, 규모가 커지면 이 모듈만 DB 구현으로 교체하면 됩니다.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DEFAULT_SETTINGS, sanitizeRoom } from '../public/js/data/catalog.js';
import { SAMPLE_ITEMS } from '../public/js/data/sample-data.js';

export class Store {
  constructor(dir) {
    this.dir = dir;
    this.rooms = new Map();
    this.timers = new Map();
    fs.mkdirSync(dir, { recursive: true });
  }

  file(room) { return path.join(this.dir, `${room}.json`); }

  get(roomName) {
    const room = sanitizeRoom(roomName);
    if (this.rooms.has(room)) return this.rooms.get(room);
    let data;
    try {
      data = JSON.parse(fs.readFileSync(this.file(room), 'utf8'));
    } catch {
      data = {
        room,
        settings: { ...DEFAULT_SETTINGS },
        items: SAMPLE_ITEMS.map((s) => ({
          id: newId(), room, status: 'visible', anonymous: false, ...s,
        })),
      };
      this.rooms.set(room, data);
      this.save(room);
    }
    data.settings = { ...DEFAULT_SETTINGS, ...data.settings };
    this.rooms.set(room, data);
    return data;
  }

  // 쓰기 폭주를 막기 위해 300ms 디바운스 + 임시파일 rename(원자적 저장)
  save(room) {
    clearTimeout(this.timers.get(room));
    this.timers.set(room, setTimeout(() => this.flush(room), 300));
  }

  flush(room) {
    const data = this.rooms.get(room);
    if (!data) return;
    const tmp = this.file(room) + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
    fs.renameSync(tmp, this.file(room));
  }

  flushAll() { for (const room of this.rooms.keys()) this.flush(room); }
}

export function newId() {
  return Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
}
