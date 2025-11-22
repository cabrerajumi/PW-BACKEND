const Stream = require('../models/stream');
const StreamParticipant = require('../models/streamParticipant');
const User = require('../models/user');
const Message = require('../models/message');
const sequelize = require('../db');

// Award points to participants in active streams periodically.
// Configurable via env vars
// points worker for participants
const POINTS_PER_MINUTE = Number(process.env.POINTS_PER_MINUTE) || 1;
const INTERVAL_MS = Number(process.env.POINTS_INTERVAL_MS) || 60 * 1000;
// streamer leveling (every N seconds) and points per tick
const STREAMER_INTERVAL_MS = Number(process.env.STREAMER_INTERVAL_MS) || 20 * 1000; // default 20s
const STREAMER_POINTS_PER_TICK = Number(process.env.STREAMER_POINTS_PER_TICK) || 1;
// How recent the streamer's heartbeat must be to consider them "online" (ms)
const HEARTBEAT_TIMEOUT_MS = Number(process.env.HEARTBEAT_TIMEOUT_MS) || 30 * 1000;

let timer = null;
let streamerTimer = null;

async function tickOnce() {
  try {
    // Fetch active streams
    const active = await Stream.findAll({ where: { is_active: true } });
    if (!active || active.length === 0) return;

    for (const s of active) {
      try {
        const participants = await StreamParticipant.findAll({ where: { stream_id: s.id, left_at: null } });
        if (!participants || participants.length === 0) continue;
        // Update each participant
        for (const p of participants) {
          // increment seconds and points
          p.accumulated_seconds = (p.accumulated_seconds || 0) + Math.round(INTERVAL_MS / 1000);
          p.puntos = (p.puntos || 0) + POINTS_PER_MINUTE;
          // apply level-up rule using LevelSetting when available
          let leveled = false;
          try {
            const LevelSetting = require('../models/levelSetting');
            const getThreshold = async (lvl) => {
              const row = await LevelSetting.findOne({ where: { level: lvl } });
              return row ? row.points_required : (lvl * 100);
            };
            while (true) {
              const threshold = await getThreshold(p.level || 1);
              if (p.puntos >= threshold) {
                p.puntos = p.puntos - threshold;
                p.level = (p.level || 1) + 1;
                leveled = true;
                continue;
              }
              break;
            }
          } catch (e) {
            while (p.puntos >= ((p.level || 1) * 100)) {
              p.puntos = p.puntos - ((p.level || 1) * 100);
              p.level = (p.level || 1) + 1;
              leveled = true;
            }
          }
          try {
            await p.save();
            // If leveled, create a chat message announcing it
            if (leveled) {
              try {
                const u = p.user_id ? await User.findByPk(p.user_id) : null;
                const name = u ? (u.nombre || u.correo || `usuario ${u.id}`) : `Usuario ${p.user_id}`;
                const texto = `${name} ha subido al nivel ${p.level}! 🎉`;
                await Message.create({ stream_id: s.id, user_id: null, author: 'Sistema', text: texto });
              } catch (e) {
                console.warn('failed creating level-up message', e && e.message);
              }
            }
          } catch (e) { console.warn('failed saving participant', e && e.message); }
        }
      } catch (e) {
        console.warn('Error updating participants for stream', s.id, e && e.message);
      }
    }
  } catch (err) {
    console.error('streamPointsWorker tick error', err && err.message);
  }
}

function start() {
  if (timer) return; // already running
  // Run immediate tick, then schedule interval
  tickOnce().catch(() => {});
  timer = setInterval(() => { tickOnce().catch(() => {}); }, INTERVAL_MS);
  // start streamer ticker
  if (!streamerTimer) {
    const tickStreamer = async () => {
      try {
        const active = await Stream.findAll({ where: { is_active: true } });
        if (!active || active.length === 0) return;
        for (const s of active) {
          try {
            if (!s.streamer_id) continue;
            const u = await User.findByPk(s.streamer_id);
            if (!u) continue;
            // only award streamer progression if they have a recent heartbeat
            if (!s.last_heartbeat || (Date.now() - new Date(s.last_heartbeat).getTime()) > HEARTBEAT_TIMEOUT_MS) {
              // skip this streamer — no recent heartbeat
              continue;
            }
            // For streamers we increment the level every tick (guaranteed level-up per interval)
            try {
              u.nivel = (u.nivel || 1) + 1;
              await u.save();
              // announce level-up
              try {
                const name = u.nombre || u.correo || `Streamer ${u.id}`;
                const texto = `${name} ha subido al nivel ${u.nivel}! 🎉`;
                await Message.create({ stream_id: s.id, user_id: null, author: 'Sistema', text: texto });
              } catch (e) { console.warn('failed creating streamer level-up message', e && e.message); }
            } catch (e) {
              console.warn('Error updating streamer level', e && e.message);
            }
          } catch (e) { console.warn('Error updating streamer for stream', s.id, e && e.message); }
        }
      } catch (e) { console.error('streamer tick error', e && e.message); }
    };
    // immediate and scheduled
    tickStreamer().catch(() => {});
    streamerTimer = setInterval(() => tickStreamer().catch(() => {}), STREAMER_INTERVAL_MS);
  }
  console.log('streamPointsWorker started: intervalMs=', INTERVAL_MS, 'pointsPerMinute=', POINTS_PER_MINUTE);
}

function stop() {
  if (timer) { clearInterval(timer); timer = null; }
  if (streamerTimer) { clearInterval(streamerTimer); streamerTimer = null; }
}

module.exports = { start, stop };
