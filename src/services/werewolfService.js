// werewolfService.js
// Complete Werewolf game engine for TitanBot
// Supports: Villager, Werewolf, Seer, Doctor, Hunter, Witch, Cupid, Guard

import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { logger } from '../utils/logger.js';

// ─── Constants ──────────────────────────────────────────────────────────────

export const GamePhase = {
  LOBBY: 'LOBBY',
  NIGHT_FIRST: 'NIGHT_FIRST',
  NIGHT: 'NIGHT',
  DAY: 'DAY',
  HUNTER_SHOT: 'HUNTER_SHOT',
  ENDED: 'ENDED',
};

export const Role = {
  VILLAGER: 'villager',
  WEREWOLF: 'werewolf',
  SEER: 'seer',
  DOCTOR: 'doctor',
  HUNTER: 'hunter',
  WITCH: 'witch',
  CUPID: 'cupid',
  GUARD: 'guard',
};

export const RoleInfo = {
  [Role.VILLAGER]: {
    name: 'Villager',
    emoji: '🧑‍🌾',
    team: 'village',
    description: 'You are an ordinary villager. Find and eliminate all werewolves!',
    nightAction: false,
  },
  [Role.WEREWOLF]: {
    name: 'Werewolf',
    emoji: '🐺',
    team: 'werewolf',
    description: 'You are a werewolf! Each night, choose one villager to eliminate. Win by equalling or outnumbering the villagers.',
    nightAction: true,
  },
  [Role.SEER]: {
    name: 'Seer',
    emoji: '🔮',
    team: 'village',
    description: 'You can peer into someone\'s soul each night and learn their role. Use this power to guide the village.',
    nightAction: true,
  },
  [Role.DOCTOR]: {
    name: 'Doctor',
    emoji: '🩺',
    team: 'village',
    description: 'Each night you can protect one player from being killed. You cannot protect the same player two nights in a row.',
    nightAction: true,
  },
  [Role.HUNTER]: {
    name: 'Hunter',
    emoji: '🏹',
    team: 'village',
    description: 'When you die (day or night), you may immediately shoot and kill one other player. Use it wisely!',
    nightAction: false,
  },
  [Role.WITCH]: {
    name: 'Witch',
    emoji: '🧙',
    team: 'village',
    description: 'You have two potions: one to **heal** the werewolf\'s victim tonight, and one to **poison** any player. Each can only be used once per game.',
    nightAction: true,
  },
  [Role.CUPID]: {
    name: 'Cupid',
    emoji: '💘',
    team: 'village',
    description: 'On the **first night only**, you link two players as lovers. If one lover dies, the other dies of heartbreak too. Lovers win if they are the last two alive.',
    nightAction: true,
  },
  [Role.GUARD]: {
    name: 'Guard',
    emoji: '🛡️',
    team: 'village',
    description: 'Each night you can protect one player. Unlike the doctor you cannot protect yourself, and you cannot protect the same player twice in a row.',
    nightAction: true,
  },
};

const PHASE_DURATIONS = {
  DAY_VOTE: 3 * 60 * 1000,
  NIGHT_ACTION: 2 * 60 * 1000,
  HUNTER_SHOT: 60 * 1000,
};

const MIN_PLAYERS = 4;
const MAX_PLAYERS = 20;

function getRoleList(playerCount) {
  if (playerCount <= 5) {
    return [Role.WEREWOLF, Role.SEER, ...Array(playerCount - 2).fill(Role.VILLAGER)];
  } else if (playerCount <= 7) {
    return [Role.WEREWOLF, Role.SEER, Role.DOCTOR, ...Array(playerCount - 3).fill(Role.VILLAGER)];
  } else if (playerCount <= 9) {
    return [Role.WEREWOLF, Role.WEREWOLF, Role.SEER, Role.DOCTOR, Role.HUNTER, ...Array(playerCount - 5).fill(Role.VILLAGER)];
  } else if (playerCount <= 12) {
    return [Role.WEREWOLF, Role.WEREWOLF, Role.SEER, Role.DOCTOR, Role.HUNTER, Role.WITCH, ...Array(playerCount - 6).fill(Role.VILLAGER)];
  } else {
    return [Role.WEREWOLF, Role.WEREWOLF, Role.WEREWOLF, Role.SEER, Role.DOCTOR, Role.HUNTER, Role.WITCH, Role.CUPID, Role.GUARD, ...Array(playerCount - 9).fill(Role.VILLAGER)];
  }
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const games = new Map();

const STALE_GAME_TTL = 2 * 60 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [guildId, state] of games) {
    if (state.phase === GamePhase.ENDED) { games.delete(guildId); continue; }
    if (now - state.createdAt > STALE_GAME_TTL) {
      clearPhaseTimer(state);
      games.delete(guildId);
      logger.warn(`[Werewolf] Stale game removed for guild ${guildId}`);
    }
  }
}, 30 * 60 * 1000).unref();

export function getGame(guildId) {
  return games.get(guildId) || null;
}

export function hasGame(guildId) {
  return games.has(guildId);
}

function createPlayerState(userId, username) {
  return {
    userId,
    username,
    role: null,
    alive: true,
    protected: false,
    lastProtectedBy: null,
    witchHealUsed: false,
    witchKillUsed: false,
    isLover: false,
    loverId: null,
    nightAction: null,
    vote: null,
  };
}

export function createGame(guildId, channelId, creatorId, creatorUsername, minPlayers = MIN_PLAYERS) {
  if (games.has(guildId)) {
    return { success: false, reason: 'A game is already running in this server.' };
  }
  const clampedMin = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, minPlayers));
  const state = {
    guildId,
    channelId,
    creatorId,
    phase: GamePhase.LOBBY,
    day: 0,
    players: new Map(),
    nightKillTarget: null,
    witchHealUsed: false,
    witchPoisonTarget: null,
    lovers: null,
    hunterPending: null,
    minPlayers: clampedMin,
    phaseTimer: null,
    createdAt: Date.now(),
  };
  state.players.set(creatorId, createPlayerState(creatorId, creatorUsername));
  games.set(guildId, state);
  return { success: true, state };
}

export function joinGame(guildId, userId, username) {
  const state = games.get(guildId);
  if (!state) return { success: false, reason: 'No game lobby found. Use `/werewolf create` to start one.' };
  if (state.phase !== GamePhase.LOBBY) return { success: false, reason: 'The game has already started — you cannot join now.' };
  if (state.players.has(userId)) return { success: false, reason: 'You have already joined this game.' };
  if (state.players.size >= MAX_PLAYERS) return { success: false, reason: `The game is full (max ${MAX_PLAYERS} players).` };
  state.players.set(userId, createPlayerState(userId, username));
  return { success: true, count: state.players.size };
}

export function leaveGame(guildId, userId) {
  const state = games.get(guildId);
  if (!state) return { success: false, reason: 'No active game found.' };
  if (state.phase !== GamePhase.LOBBY) return { success: false, reason: 'You cannot leave once the game has started.' };
  if (!state.players.has(userId)) return { success: false, reason: 'You are not in this game.' };
  if (userId === state.creatorId && state.players.size === 1) {
    games.delete(guildId);
    return { success: true, dissolved: true };
  }
  if (userId === state.creatorId) {
    const newCreator = [...state.players.keys()].find(id => id !== userId);
    state.creatorId = newCreator;
  }
  state.players.delete(userId);
  return { success: true, count: state.players.size };
}

export function kickFromGame(guildId, requesterId, targetId) {
  const state = games.get(guildId);
  if (!state) return { success: false, reason: 'No active game found.' };
  if (state.phase !== GamePhase.LOBBY) return { success: false, reason: 'Cannot kick players after the game has started.' };
  if (requesterId !== state.creatorId) return { success: false, reason: 'Only the game creator can kick players.' };
  if (targetId === requesterId) return { success: false, reason: 'You cannot kick yourself.' };
  if (!state.players.has(targetId)) return { success: false, reason: 'That player is not in this game.' };
  state.players.delete(targetId);
  return { success: true, count: state.players.size };
}

export function cancelGame(guildId, userId, isAdmin = false) {
  const state = games.get(guildId);
  if (!state) return { success: false, reason: 'No active game found.' };
  if (userId !== state.creatorId && !isAdmin) return { success: false, reason: 'Only the game creator or a server administrator can cancel the game.' };
  clearPhaseTimer(state);
  games.delete(guildId);
  return { success: true };
}

export function startGame(guildId, userId) {
  const state = games.get(guildId);
  if (!state) return { success: false, reason: 'No game lobby found.' };
  if (state.phase !== GamePhase.LOBBY) return { success: false, reason: 'The game has already started.' };
  if (userId !== state.creatorId) return { success: false, reason: 'Only the game creator can start the game.' };
  if (state.players.size < state.minPlayers) {
    return { success: false, reason: `Need at least **${state.minPlayers}** players to start. Currently **${state.players.size}** joined.` };
  }
  const roleList = shuffle(getRoleList(state.players.size));
  let i = 0;
  for (const player of state.players.values()) {
    player.role = roleList[i++];
  }
  const hasCupid = [...state.players.values()].some(p => p.role === Role.CUPID);
  state.phase = hasCupid ? GamePhase.NIGHT_FIRST : GamePhase.NIGHT;
  state.day = 1;
  return { success: true, state, hasCupid };
}

function clearPhaseTimer(state) {
  if (state.phaseTimer) {
    clearTimeout(state.phaseTimer);
    state.phaseTimer = null;
  }
}

export function setPhaseTimer(guildId, callback, duration) {
  const state = games.get(guildId);
  if (!state) return;
  clearPhaseTimer(state);
  state.phaseTimer = setTimeout(() => {
    state.phaseTimer = null;
    callback();
  }, duration);
}

export function getNightDuration() { return PHASE_DURATIONS.NIGHT_ACTION; }
export function getDayDuration() { return PHASE_DURATIONS.DAY_VOTE; }
export function getHunterDuration() { return PHASE_DURATIONS.HUNTER_SHOT; }

export function submitNightAction(guildId, userId, action, targetId = null) {
  const state = games.get(guildId);
  if (!state) return { success: false, reason: 'No active game.' };
  if (state.phase !== GamePhase.NIGHT && state.phase !== GamePhase.NIGHT_FIRST) {
    return { success: false, reason: 'Night actions can only be submitted at night.' };
  }
  const player = state.players.get(userId);
  if (!player) return { success: false, reason: 'You are not in this game.' };
  if (!player.alive) return { success: false, reason: 'Dead players cannot take actions.' };
  const roleInfo = RoleInfo[player.role];
  if (!roleInfo.nightAction) return { success: false, reason: 'Your role has no night action.' };

  switch (player.role) {
    case Role.WEREWOLF: {
      if (action !== 'kill') return { success: false, reason: 'Werewolves can only use the `kill` action.' };
      const target = state.players.get(targetId);
      if (!target) return { success: false, reason: 'Target player not found.' };
      if (!target.alive) return { success: false, reason: 'That player is already dead.' };
      if (target.role === Role.WEREWOLF) return { success: false, reason: 'You cannot kill another werewolf.' };
      break;
    }
    case Role.SEER: {
      if (action !== 'see') return { success: false, reason: 'Seers can only use the `see` action.' };
      const target = state.players.get(targetId);
      if (!target) return { success: false, reason: 'Target player not found.' };
      if (!target.alive) return { success: false, reason: 'That player is already dead.' };
      if (targetId === userId) return { success: false, reason: 'You cannot investigate yourself.' };
      break;
    }
    case Role.DOCTOR: {
      if (action !== 'heal') return { success: false, reason: 'Doctors can only use the `heal` action.' };
      const target = state.players.get(targetId);
      if (!target) return { success: false, reason: 'Target player not found.' };
      if (!target.alive) return { success: false, reason: 'That player is already dead.' };
      if (targetId === player.lastProtectedBy) return { success: false, reason: 'You cannot protect the same player two nights in a row.' };
      break;
    }
    case Role.GUARD: {
      if (action !== 'guard') return { success: false, reason: 'Guards can only use the `guard` action.' };
      const target = state.players.get(targetId);
      if (!target) return { success: false, reason: 'Target player not found.' };
      if (!target.alive) return { success: false, reason: 'That player is already dead.' };
      if (targetId === userId) return { success: false, reason: 'You cannot guard yourself.' };
      if (targetId === player.lastProtectedBy) return { success: false, reason: 'You cannot guard the same player two nights in a row.' };
      break;
    }
    case Role.WITCH: {
      if (action !== 'heal' && action !== 'poison' && action !== 'skip') {
        return { success: false, reason: 'Witches can use `heal`, `poison`, or `skip`.' };
      }
      if (action === 'heal') {
        if (state.witchHealUsed) return { success: false, reason: 'You have already used your healing potion.' };
        if (!state.nightKillTarget) return { success: false, reason: 'No one was targeted tonight — nothing to heal.' };
      }
      if (action === 'poison') {
        if (player.witchKillUsed) return { success: false, reason: 'You have already used your poison potion.' };
        const target = state.players.get(targetId);
        if (!target) return { success: false, reason: 'Target player not found.' };
        if (!target.alive) return { success: false, reason: 'That player is already dead.' };
      }
      break;
    }
    case Role.CUPID: {
      if (state.phase !== GamePhase.NIGHT_FIRST) return { success: false, reason: 'Cupid can only link lovers on the first night.' };
      if (action !== 'link') return { success: false, reason: 'Cupid can only use the `link` action.' };
      if (!targetId || !targetId.includes(',')) return { success: false, reason: 'Provide two player IDs separated by a comma.' };
      const [id1, id2] = targetId.split(',');
      if (id1 === id2) return { success: false, reason: 'You cannot link the same player to themselves.' };
      const p1 = state.players.get(id1);
      const p2 = state.players.get(id2);
      if (!p1 || !p2) return { success: false, reason: 'One or both target players not found.' };
      break;
    }
    default:
      return { success: false, reason: 'Your role has no valid action.' };
  }

  player.nightAction = { action, targetId };
  return { success: true };
}

export function resolveNight(guildId) {
  const state = games.get(guildId);
  if (!state) return null;

  const events = [];
  const alivePlayers = [...state.players.values()].filter(p => p.alive);

  if (state.phase === GamePhase.NIGHT_FIRST) {
    const cupid = alivePlayers.find(p => p.role === Role.CUPID);
    if (cupid?.nightAction?.action === 'link') {
      const [id1, id2] = cupid.nightAction.targetId.split(',');
      const p1 = state.players.get(id1);
      const p2 = state.players.get(id2);
      if (p1 && p2) {
        p1.isLover = true; p1.loverId = id2;
        p2.isLover = true; p2.loverId = id1;
        state.lovers = [id1, id2];
        events.push({ type: 'cupid_linked', ids: [id1, id2], names: [p1.username, p2.username] });
      }
    }
  }

  const seer = alivePlayers.find(p => p.role === Role.SEER);
  if (seer?.nightAction?.action === 'see') {
    const target = state.players.get(seer.nightAction.targetId);
    if (target) {
      events.push({ type: 'seer_result', seerId: seer.userId, targetName: target.username, targetRole: target.role });
    }
  }

  const wolves = alivePlayers.filter(p => p.role === Role.WEREWOLF);
  const wolfVotes = new Map();
  for (const wolf of wolves) {
    if (wolf.nightAction?.action === 'kill') {
      const t = wolf.nightAction.targetId;
      wolfVotes.set(t, (wolfVotes.get(t) || 0) + 1);
    }
  }
  let wolfTarget = null;
  if (wolfVotes.size > 0) {
    wolfTarget = [...wolfVotes.entries()].sort((a, b) => b[1] - a[1])[0][0];
    state.nightKillTarget = wolfTarget;
  }

  const doctor = alivePlayers.find(p => p.role === Role.DOCTOR);
  if (doctor?.nightAction?.action === 'heal') {
    const saved = doctor.nightAction.targetId;
    const savedPlayer = state.players.get(saved);
    if (savedPlayer) { savedPlayer.protected = true; doctor.lastProtectedBy = saved; }
  }

  const guard = alivePlayers.find(p => p.role === Role.GUARD);
  if (guard?.nightAction?.action === 'guard') {
    const saved = guard.nightAction.targetId;
    const savedPlayer = state.players.get(saved);
    if (savedPlayer) { savedPlayer.protected = true; guard.lastProtectedBy = saved; }
  }

  const witch = alivePlayers.find(p => p.role === Role.WITCH);
  if (witch?.nightAction) {
    if (witch.nightAction.action === 'heal' && !state.witchHealUsed && state.nightKillTarget) {
      const saved = state.players.get(state.nightKillTarget);
      if (saved) { saved.protected = true; state.witchHealUsed = true; }
    }
    if (witch.nightAction.action === 'poison' && !witch.witchKillUsed) {
      const poisoned = state.players.get(witch.nightAction.targetId);
      if (poisoned && poisoned.alive) {
        witch.witchKillUsed = true;
        state.witchPoisonTarget = witch.nightAction.targetId;
      }
    }
  }

  const killed = [];

  if (wolfTarget) {
    const victim = state.players.get(wolfTarget);
    if (victim && victim.alive && !victim.protected) {
      victim.alive = false;
      killed.push({ userId: victim.userId, username: victim.username, cause: 'wolves' });
    } else if (victim?.protected) {
      events.push({ type: 'protected', targetName: victim.username });
    }
    if (victim) victim.protected = false;
  }

  if (state.witchPoisonTarget) {
    const victim = state.players.get(state.witchPoisonTarget);
    if (victim && victim.alive) {
      victim.alive = false;
      killed.push({ userId: victim.userId, username: victim.username, cause: 'poison' });
    }
    state.witchPoisonTarget = null;
  }

  for (const dead of killed) {
    const deadPlayer = state.players.get(dead.userId);
    if (deadPlayer?.isLover && deadPlayer.loverId) {
      const lover = state.players.get(deadPlayer.loverId);
      if (lover && lover.alive) {
        lover.alive = false;
        killed.push({ userId: lover.userId, username: lover.username, cause: 'heartbreak' });
      }
    }
  }

  state.nightKillTarget = null;
  for (const player of state.players.values()) {
    player.nightAction = null;
    player.protected = false;
  }

  const hunterDead = killed.find(k => state.players.get(k.userId)?.role === Role.HUNTER);
  return { events, killed, hunterDead: hunterDead?.userId || null };
}

export function castVote(guildId, voterId, targetId) {
  const state = games.get(guildId);
  if (!state) return { success: false, reason: 'No active game.' };
  if (state.phase !== GamePhase.DAY) return { success: false, reason: 'Voting only happens during the day.' };
  const voter = state.players.get(voterId);
  if (!voter) return { success: false, reason: 'You are not in this game.' };
  if (!voter.alive) return { success: false, reason: 'Dead players cannot vote.' };
  if (targetId === 'skip') { voter.vote = 'skip'; return { success: true, skipped: true }; }
  const target = state.players.get(targetId);
  if (!target) return { success: false, reason: 'Target player not found.' };
  if (!target.alive) return { success: false, reason: 'That player is already dead.' };
  if (targetId === voterId) return { success: false, reason: 'You cannot vote for yourself.' };
  voter.vote = targetId;
  return { success: true };
}

export function getVoteStatus(guildId) {
  const state = games.get(guildId);
  if (!state) return null;
  const alivePlayers = [...state.players.values()].filter(p => p.alive);
  const votes = new Map();
  let skipCount = 0;
  for (const player of alivePlayers) {
    if (!player.vote) continue;
    if (player.vote === 'skip') { skipCount++; } else {
      votes.set(player.vote, (votes.get(player.vote) || 0) + 1);
    }
  }
  const votedCount = alivePlayers.filter(p => p.vote).length;
  return { votes, skipCount, votedCount, total: alivePlayers.length };
}

export function resolveDay(guildId) {
  const state = games.get(guildId);
  if (!state) return null;
  const alivePlayers = [...state.players.values()].filter(p => p.alive);
  const votes = new Map();
  let skipCount = 0;
  for (const player of alivePlayers) {
    if (!player.vote) continue;
    if (player.vote === 'skip') { skipCount++; continue; }
    votes.set(player.vote, (votes.get(player.vote) || 0) + 1);
  }
  for (const player of alivePlayers) { player.vote = null; }
  if (votes.size === 0) return { eliminated: null, tie: false, noVotes: true };
  const sorted = [...votes.entries()].sort((a, b) => b[1] - a[1]);
  const topVotes = sorted[0][1];
  const tied = sorted.filter(e => e[1] === topVotes);
  if (tied.length > 1) return { eliminated: null, tie: true };
  const eliminatedId = sorted[0][0];
  const eliminated = state.players.get(eliminatedId);
  if (!eliminated) return { eliminated: null, tie: false };
  eliminated.alive = false;
  const loversKilled = [];
  if (eliminated.isLover && eliminated.loverId) {
    const lover = state.players.get(eliminated.loverId);
    if (lover && lover.alive) {
      lover.alive = false;
      loversKilled.push({ userId: lover.userId, username: lover.username });
    }
  }
  const isHunter = eliminated.role === Role.HUNTER;
  return { eliminated: { userId: eliminatedId, username: eliminated.username, role: eliminated.role }, tie: false, loversKilled, isHunter };
}

export function hunterShoot(guildId, hunterId, targetId) {
  const state = games.get(guildId);
  if (!state) return { success: false, reason: 'No active game.' };
  if (state.hunterPending !== hunterId) return { success: false, reason: 'You do not have a pending hunter shot.' };
  const target = state.players.get(targetId);
  if (!target) return { success: false, reason: 'Target not found.' };
  if (!target.alive) return { success: false, reason: 'That player is already dead.' };
  target.alive = false;
  state.hunterPending = null;
  const loversKilled = [];
  if (target.isLover && target.loverId) {
    const lover = state.players.get(target.loverId);
    if (lover && lover.alive) {
      lover.alive = false;
      loversKilled.push({ userId: lover.userId, username: lover.username });
    }
  }
  return { success: true, killed: { userId: targetId, username: target.username, role: target.role }, loversKilled };
}

export function checkWinCondition(guildId) {
  const state = games.get(guildId);
  if (!state) return null;
  const alive = [...state.players.values()].filter(p => p.alive);
  const wolves = alive.filter(p => p.role === Role.WEREWOLF);
  const villagers = alive.filter(p => p.role !== Role.WEREWOLF);

  // Lovers win — checked first (highest priority)
  if (state.lovers && alive.length === 2) {
    const [l1, l2] = state.lovers;
    if (state.players.get(l1)?.alive && state.players.get(l2)?.alive) {
      const l1p = state.players.get(l1);
      const l2p = state.players.get(l2);
      return { winner: 'lovers', reason: `The lovers **${l1p.username}** and **${l2p.username}** outlasted everyone and win together!`, survivors: alive };
    }
  }
  if (wolves.length === 0) {
    return { winner: 'village', reason: 'All werewolves have been eliminated! The village is safe!', survivors: alive };
  }
  if (wolves.length >= villagers.length) {
    return { winner: 'werewolf', reason: 'The werewolves now control the village... darkness falls.', survivors: alive };
  }
  return null;
}

export function transitionToDay(guildId) {
  const state = games.get(guildId);
  if (!state) return false;
  state.phase = GamePhase.DAY;
  state.day++;
  return true;
}

export function transitionToNight(guildId) {
  const state = games.get(guildId);
  if (!state) return false;
  state.phase = GamePhase.NIGHT;
  return true;
}

export function setHunterPending(guildId, hunterId) {
  const state = games.get(guildId);
  if (!state) return;
  state.hunterPending = hunterId;
  state.phase = GamePhase.HUNTER_SHOT;
}

export function endGame(guildId) {
  const state = games.get(guildId);
  if (state) { clearPhaseTimer(state); state.phase = GamePhase.ENDED; games.delete(guildId); }
}

export function buildStatusEmbed(state) {
  const alive = [...state.players.values()].filter(p => p.alive);
  const dead = [...state.players.values()].filter(p => !p.alive);
  const aliveList = alive.map(p => `<@${p.userId}>`).join(' ') || '_Nobody_';
  const deadList = dead.map(p => `~~<@${p.userId}>~~ (${RoleInfo[p.role].emoji})`).join('\n') || '_Nobody yet_';
  const phaseNames = {
    [GamePhase.LOBBY]: 'Waiting for Players',
    [GamePhase.NIGHT_FIRST]: 'Night 1 (Special Night)',
    [GamePhase.NIGHT]: `Night ${state.day}`,
    [GamePhase.DAY]: `Day ${state.day} — Voting`,
    [GamePhase.HUNTER_SHOT]: 'Hunter\'s Revenge',
    [GamePhase.ENDED]: 'Game Over',
  };
  return new EmbedBuilder()
    .setTitle('🐺 Werewolf — Game Status')
    .setColor(state.phase === GamePhase.DAY ? 0xfbbf24 : 0x1e1b4b)
    .addFields(
      { name: '📍 Phase', value: phaseNames[state.phase] || state.phase, inline: true },
      { name: '👥 Players Alive', value: `${alive.length}/${state.players.size}`, inline: true },
      { name: '\u200b', value: '\u200b', inline: true },
      { name: '🟢 Alive', value: aliveList },
      { name: '💀 Dead', value: deadList },
    )
    .setFooter({ text: `Game created by ${state.players.get(state.creatorId)?.username || 'Unknown'}` });
}

export function buildPlayerListEmbed(state) {
  const playerList = [...state.players.values()].map((p, i) => `${i + 1}. <@${p.userId}>`).join('\n');
  return new EmbedBuilder()
    .setTitle('🐺 Werewolf — Lobby')
    .setColor(0x5865f2)
    .setDescription(`**${state.players.size}** player(s) have joined.\n\n${playerList}`)
    .setFooter({ text: `Min players: ${state.minPlayers} | Max: ${MAX_PLAYERS}` });
}

export function buildRolesEmbed() {
  const embed = new EmbedBuilder()
    .setTitle('🐺 Werewolf — Role Guide')
    .setColor(0x7c3aed)
    .setDescription('Learn about every role in the game:');
  for (const [role, info] of Object.entries(RoleInfo)) {
    embed.addFields({ name: `${info.emoji} ${info.name} (${info.team === 'village' ? '🏘️ Village' : '🐺 Werewolf'})`, value: info.description });
  }
  return embed;
}

export function buildNightStartEmbed(state, phase) {
  const isFirstNight = phase === GamePhase.NIGHT_FIRST;
  return new EmbedBuilder()
    .setTitle(isFirstNight ? '🌑 Night Falls (First Night)' : `🌑 Night ${state.day} Falls`)
    .setColor(0x1e1b4b)
    .setDescription(isFirstNight
      ? 'The first night begins. **Cupid** links two lovers. The **Seer** gazes into the darkness. The **Werewolves** prowl...\n\nUse `/werewolf action` to submit your night action.'
      : `Night ${state.day} has fallen. The village sleeps while hidden forces stir.\n\nUse \`/werewolf action\` to submit your night action.`)
    .addFields({ name: '⏰ Time Limit', value: 'You have **2 minutes** to submit your action.' })
    .setFooter({ text: 'Night actions are secret — only you can see what you chose.' });
}

export function buildDayStartEmbed(state, nightReport) {
  const embed = new EmbedBuilder()
    .setTitle(`☀️ Day ${state.day} — Dawn Breaks`)
    .setColor(0xfbbf24)
    .setFooter({ text: 'Vote wisely — a wrong elimination could doom the village.' });
  let description = '';
  if (nightReport.killed.length === 0) {
    description = '**A miracle!** Nobody was killed last night.\n\n';
  } else {
    description = '**Last night\'s casualties:**\n';
    for (const victim of nightReport.killed) {
      const roleInfo = RoleInfo[state.players.get(victim.userId)?.role] || {};
      const causeEmoji = victim.cause === 'wolves' ? '🐺' : victim.cause === 'poison' ? '☠️' : '💔';
      description += `${causeEmoji} **${victim.username}** — **${roleInfo.name || 'Unknown'}** ${roleInfo.emoji || ''}\n`;
    }
    description += '\n';
  }
  description += '**Vote to eliminate a suspect!**\nUse `/werewolf vote @player` — most votes loses.\n\nYou have **3 minutes**.';
  embed.setDescription(description);
  return embed;
}

export function buildVoteEmbed(state) {
  const { votes, skipCount, votedCount, total } = getVoteStatus(state.guildId);
  let voteDesc = '';
  for (const [targetId, count] of [...votes.entries()].sort((a, b) => b[1] - a[1])) {
    const target = state.players.get(targetId);
    const bar = '▓'.repeat(count) + '░'.repeat(total - count);
    voteDesc += `**${target?.username}**: ${count} vote(s) [${bar}]\n`;
  }
  if (skipCount > 0) voteDesc += `**Skip**: ${skipCount} vote(s)\n`;
  return new EmbedBuilder()
    .setTitle(`☀️ Day ${state.day} — Vote Tally`)
    .setColor(0xfbbf24)
    .setDescription(voteDesc || '_No votes cast yet_')
    .setFooter({ text: `${votedCount}/${total} players have voted` });
}

export { MIN_PLAYERS, MAX_PLAYERS, PHASE_DURATIONS };
