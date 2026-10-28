// Read-only queries over the story data. Every app gets its content through here, so filtering by
// active character and story date lives in exactly one place and one character can never see another's data.

import { getCharacter } from './data/characters.js';
import { getDay, getEvent } from './data/timeline.js';
import { notes } from './data/notes.js';
import { chats } from './data/chats.js';
import { gallery } from './data/gallery.js';
import { tweets } from './data/twitter.js';
import { dateKey, truncate } from './utils.js';

export const isGroup = (chat) => chat.type === 'group';

/** The "other side" of a chat: a character for 1:1 chats, a group descriptor (name, avatar, members) for groups. */
function contactOf(chat) {
  if (!isGroup(chat)) return getCharacter(chat.contactId);
  return {
    id: chat.id,
    isGroup: true,
    name: chat.name,
    avatar: chat.avatar || null,
    description: chat.description || '',
    members: (chat.participants || []).map(getCharacter).filter(Boolean),
  };
}

const inScope = (date, state) => (state.scope === 'upto' ? date <= state.activeStoryDate : date === state.activeStoryDate);

export const notesFor = (state) =>
  notes
    .filter((n) => n.characterId === state.activeCharacterId && inScope(dateKey(n.createdAt), state))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

export const galleryFor = (state) =>
  gallery
    .filter((g) => g.characterId === state.activeCharacterId && inScope(g.date, state))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

/** Every photo of the active character, any date (used for the dimmed map markers). */
export const allPhotosOf = (characterId) => gallery.filter((g) => g.characterId === characterId);

export const postsFor = (state) =>
  tweets
    .filter((t) => t.characterId === state.activeCharacterId && inScope(dateKey(t.timestamp), state))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

/** Chats are cumulative: a conversation shows everything sent up to (and including) the selected day. */
export const chatsFor = (state) =>
  chats
    .filter((c) => c.characterId === state.activeCharacterId)
    .map((chat) => {
      const visible = chat.messages.filter((m) => dateKey(m.timestamp) <= state.activeStoryDate);
      return { ...chat, messages: visible, last: visible[visible.length - 1] || null, contact: contactOf(chat) };
    })
    .filter((chat) => chat.messages.length > 0)
    .sort((a, b) => b.last.timestamp.localeCompare(a.last.timestamp));

/** What happened on exactly the selected day, for the home screen badges. */
export function countsFor(state) {
  const day = state.activeStoryDate;
  const id = state.activeCharacterId;
  return {
    notes: notes.filter((n) => n.characterId === id && dateKey(n.createdAt) === day).length,
    whatsapp: chats.filter((c) => c.characterId === id).reduce((sum, c) => sum + c.messages.filter((m) => dateKey(m.timestamp) === day).length, 0),
    gallery: gallery.filter((g) => g.characterId === id && g.date === day).length,
    twitter: tweets.filter((t) => t.characterId === id && dateKey(t.timestamp) === day).length,
  };
}

export const dayInfo = (date) => getDay(date);

/** Resolves content by type so a narration chip or event link can jump to it in the right app. */
export function findContent(type, id) {
  if (type === 'note') {
    const item = notes.find((n) => n.id === id);
    return item && { type, id, app: 'notes', characterId: item.characterId, date: dateKey(item.createdAt), item };
  }
  if (type === 'photo') {
    const item = gallery.find((g) => g.id === id);
    return item && { type, id, app: 'gallery', characterId: item.characterId, date: item.date, item };
  }
  if (type === 'tweet') {
    const item = tweets.find((t) => t.id === id);
    return item && { type, id, app: 'twitter', characterId: item.characterId, date: dateKey(item.timestamp), item };
  }
  if (type === 'message') {
    for (const chat of chats) {
      const item = chat.messages.find((m) => m.id === id);
      if (item) return { type, id, app: 'whatsapp', characterId: chat.characterId, date: dateKey(item.timestamp), item, chat };
    }
  }
  return null;
}

const TYPE_LABEL = { note: 'Note', message: 'Message', photo: 'Photo', tweet: 'Post' };

/** A short, human label for a piece of content ("Note · Barelang plan"). */
export function describeContent(found) {
  const { type, item, chat } = found;
  let text = '';
  if (type === 'note') text = item.title;
  if (type === 'photo') text = item.caption || item.locationName;
  if (type === 'tweet') text = truncate(item.text, 34);
  if (type === 'message') {
    const who = isGroup(chat) ? chat.name : getCharacter(chat.contactId)?.name.split(' ')[0] || 'Chat';
    text = `${who}: ${item.text ? truncate(item.text, 26) : 'Sticker'}`;
  }
  return { label: `${TYPE_LABEL[type]} · ${text}`, short: TYPE_LABEL[type] };
}

/** Everything the given character has about a story event, across all four apps. */
export function eventLinks(eventId, characterId, exclude = null) {
  if (!eventId) return [];
  const out = [];
  const push = (type, item, chat) => {
    if (exclude && exclude.type === type && exclude.id === item.id) return;
    const found = findContent(type, item.id);
    out.push({ ...found, ...describeContent(found), chat });
  };
  notes.filter((n) => n.characterId === characterId && n.eventId === eventId).forEach((n) => push('note', n));
  chats
    .filter((c) => c.characterId === characterId)
    .forEach((c) => c.messages.filter((m) => m.eventId === eventId).forEach((m) => push('message', m, c)));
  gallery.filter((g) => g.characterId === characterId && g.eventId === eventId).forEach((g) => push('photo', g));
  tweets.filter((t) => t.characterId === characterId && t.eventId === eventId).forEach((t) => push('tweet', t));
  return out;
}

export { getEvent, getCharacter };