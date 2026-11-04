require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 4000;
if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
  console.error('DATABASE_URL and JWT_SECRET are required.');
  process.exit(1);
}
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
});
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_ORIGIN ? process.env.CLIENT_ORIGIN.split(',').map(s => s.trim()) : true
}));
app.use(express.json({ limit: '30kb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }));

const hashToken = value => crypto.createHash('sha256').update(value).digest('hex');
const makeCode = () => crypto.randomBytes(5).toString('hex');
const makeToken = () => crypto.randomBytes(32).toString('base64url');
const dateOnly = value => /^\d{4}-\d{2}-\d{2}$/.test(value);
const dbDate = value => typeof value === 'string' ? value.slice(0,10) : value.toISOString().slice(0,10);
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function participantAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  try {
    const data = jwt.verify(token, process.env.JWT_SECRET);
    if (data.role !== 'participant') throw new Error('role');
    req.user = data;
    next();
  } catch {
    res.status(401).json({ error: '로그인이 필요합니다.' });
  }
}
function adminAuth(req, res, next) {
  (async () => {
    const room = await pool.query('SELECT id, admin_token_hash FROM rooms WHERE code=$1', [req.params.code]);
    const token = req.params.token;
    if (!room.rowCount || !token || hashToken(token) !== room.rows[0].admin_token_hash) {
      return res.status(401).json({ error: '관리자 링크가 올바르지 않습니다.' });
    }
    req.roomId = room.rows[0].id;
    next();
  })().catch(next);
}
async function getRoom(code) {
  const result = await pool.query('SELECT * FROM rooms WHERE code=$1', [code]);
  return result.rows[0];
}

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.post('/api/rooms', asyncRoute(async (req, res) => {
  const { title, startDate, endDate } = req.body || {};
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 120 ||
      !dateOnly(startDate) || !dateOnly(endDate) || endDate < startDate) {
    return res.status(400).json({ error: '모임명과 올바른 시작일·종료일을 입력해 주세요.' });
  }
  const code = makeCode();
  const adminToken = makeToken();
  await pool.query(
    'INSERT INTO rooms(code,title,start_date,end_date,admin_token_hash) VALUES($1,$2,$3,$4,$5)',
    [code, title.trim(), startDate, endDate, hashToken(adminToken)]
  );
  res.status(201).json({ code, title: title.trim(), participantUrl: `/r/${code}`, adminUrl: `/r/${code}/admin/${adminToken}` });
}));

app.get('/api/rooms/:code', asyncRoute(async (req, res) => {
  const room = await getRoom(req.params.code);
  if (!room) return res.status(404).json({ error: '모임을 찾을 수 없습니다.' });
  const counts = await pool.query(
    `SELECT COUNT(DISTINCT p.id)::int AS participants,
      COUNT(DISTINCT p.id) FILTER (WHERE EXISTS (SELECT 1 FROM unavailable_dates u WHERE u.participant_id=p.id))::int AS responded
     FROM participants p WHERE p.room_id=$1`, [room.id]
  );
  res.json({
    code: room.code, title: room.title,
    startDate: dbDate(room.start_date),
    endDate: dbDate(room.end_date),
    participantCount: counts.rows[0].participants,
    respondedCount: counts.rows[0].responded
  });
}));

app.post('/api/auth/:code', asyncRoute(async (req, res) => {
  const room = await getRoom(req.params.code);
  if (!room) return res.status(404).json({ error: '모임을 찾을 수 없습니다.' });
  const { name, password } = req.body || {};
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 40 ||
      typeof password !== 'string' || password.length < 4 || password.length > 100) {
    return res.status(400).json({ error: '이름을 입력하고 비밀번호는 4자 이상 입력해 주세요.' });
  }
  const cleanName = name.trim();
  let participant = (await pool.query('SELECT * FROM participants WHERE room_id=$1 AND name=$2', [room.id, cleanName])).rows[0];
  if (participant) {
    const ok = await bcrypt.compare(password, participant.password_hash);
    if (!ok) return res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
  } else {
    const passwordHash = await bcrypt.hash(password, 12);
    try {
      const inserted = await pool.query(
        'INSERT INTO participants(room_id,name,password_hash) VALUES($1,$2,$3) RETURNING id,name',
        [room.id, cleanName, passwordHash]
      );
      participant = inserted.rows[0];
    } catch (e) {
      if (e.code === '23505') return res.status(409).json({ error: '이미 등록된 이름입니다. 기존 비밀번호로 로그인해 주세요.' });
      throw e;
    }
  }
  const token = jwt.sign({ role: 'participant', participantId: participant.id, roomId: room.id, name: participant.name }, process.env.JWT_SECRET, { expiresIn: '30d' });
  const dates = await pool.query('SELECT unavailable_date FROM unavailable_dates WHERE participant_id=$1 ORDER BY unavailable_date', [participant.id]);
  res.json({ token, name: participant.name, unavailableDates: dates.rows.map(r => dbDate(r.unavailable_date)) });
}));

app.get('/api/me', participantAuth, asyncRoute(async (req, res) => {
  const participant = await pool.query('SELECT id,name FROM participants WHERE id=$1 AND room_id=$2', [req.user.participantId, req.user.roomId]);
  if (!participant.rowCount) return res.status(401).json({ error: '참여자 정보를 찾을 수 없습니다.' });
  const dates = await pool.query('SELECT unavailable_date FROM unavailable_dates WHERE participant_id=$1 ORDER BY unavailable_date', [req.user.participantId]);
  res.json({ name: participant.rows[0].name, unavailableDates: dates.rows.map(r => dbDate(r.unavailable_date)) });
}));

app.put('/api/me/dates', participantAuth, asyncRoute(async (req, res) => {
  const dates = req.body && req.body.dates;
  if (!Array.isArray(dates) || dates.length > 100) return res.status(400).json({ error: '날짜 목록이 올바르지 않습니다.' });
  const roomResult = await pool.query('SELECT start_date,end_date FROM rooms WHERE id=$1', [req.user.roomId]);
  if (!roomResult.rowCount) return res.status(404).json({ error: '모임을 찾을 수 없습니다.' });
  const start = dbDate(roomResult.rows[0].start_date);
  const end = dbDate(roomResult.rows[0].end_date);
  if (dates.some(d => !dateOnly(d) || d < start || d > end)) return res.status(400).json({ error: '모임 기간 안의 날짜만 선택할 수 있습니다.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM unavailable_dates WHERE participant_id=$1', [req.user.participantId]);
    for (const d of [...new Set(dates)]) {
      await client.query('INSERT INTO unavailable_dates(participant_id,unavailable_date) VALUES($1,$2)', [req.user.participantId,d]);
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK'); throw e;
  } finally { client.release(); }
}));

app.get('/api/rooms/:code/availability', asyncRoute(async (req, res) => {
  const room = await getRoom(req.params.code);
  if (!room) return res.status(404).json({ error: '모임을 찾을 수 없습니다.' });
  const result = await pool.query(
    `SELECT u.unavailable_date, p.name
     FROM unavailable_dates u JOIN participants p ON p.id=u.participant_id
     WHERE p.room_id=$1 ORDER BY u.unavailable_date,p.name`, [room.id]
  );
  const grouped = {};
  for (const row of result.rows) {
    const d = dbDate(row.unavailable_date);
    (grouped[d] ||= []).push(row.name);
  }
  const total = await pool.query('SELECT COUNT(*)::int AS n FROM participants WHERE room_id=$1', [room.id]);
  res.json({ totalParticipants: total.rows[0].n, unavailableByDate: grouped });
}));

app.get('/api/admin/:code/:token', adminAuth, asyncRoute(async (req, res) => {
  const room = await getRoom(req.params.code);
  const people = await pool.query(
    `SELECT p.id,p.name,COUNT(u.unavailable_date)::int AS marked_count
     FROM participants p LEFT JOIN unavailable_dates u ON u.participant_id=p.id
     WHERE p.room_id=$1 GROUP BY p.id ORDER BY p.name`, [req.roomId]
  );
  const dates = await pool.query(
    `SELECT u.unavailable_date,p.name FROM unavailable_dates u
     JOIN participants p ON p.id=u.participant_id WHERE p.room_id=$1
     ORDER BY u.unavailable_date,p.name`, [req.roomId]
  );
  const grouped = {};
  for (const row of dates.rows) {
    const d = dbDate(row.unavailable_date);
    (grouped[d] ||= []).push(row.name);
  }
  res.json({
    room: { code: room.code, title: room.title, startDate: dbDate(room.start_date), endDate: dbDate(room.end_date) },
    participants: people.rows, unavailableByDate: grouped
  });
}));

app.delete('/api/admin/:code/:token/participants/:id', adminAuth, asyncRoute(async (req, res) => {
  await pool.query('DELETE FROM participants WHERE id=$1 AND room_id=$2', [req.params.id, req.roomId]);
  res.json({ ok: true });
}));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' });
});
app.listen(PORT, () => console.log(`API listening on ${PORT}`));
