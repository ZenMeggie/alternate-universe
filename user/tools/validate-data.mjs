// Checks that story data is internally consistent. Run: node tools/validate-data.mjs
import { existsSync } from 'node:fs';
import { characters, getCharacter } from '../js/data/characters.js';
import { timeline, storyDates, getEvent } from '../js/data/timeline.js';
import { notes } from '../js/data/notes.js';
import { chats } from '../js/data/chats.js';
import { narrations, getNarration } from '../js/data/narrations.js';
import { gallery } from '../js/data/gallery.js';
import { tweets } from '../js/data/twitter.js';

const errors = [];
const err = (m) => errors.push(m);
const dateOf = (ts) => ts.slice(0, 10);

// unique ids
const dupes = (label, list) => {
  const seen = new Set();
  for (const x of list) {
    if (seen.has(x.id)) err(`${label}: duplicate id ${x.id}`);
    seen.add(x.id);
  }
};
dupes('characters', characters);
dupes('notes', notes);
dupes('chats', chats);
dupes('narrations', narrations);
dupes('gallery', gallery);
dupes('tweets', tweets);
const messages = chats.flatMap((c) => c.messages.map((m) => ({ ...m, chat: c })));
dupes('messages', messages);

const playable = characters.filter((c) => c.playable);
const msgIds = new Set(messages.map((m) => m.id));
const noteIds = new Set(notes.map((n) => n.id));
const photoIds = new Set(gallery.map((g) => g.id));
const tweetIds = new Set(tweets.map((t) => t.id));

for (const n of notes) {
  if (!getCharacter(n.characterId)) err(`note ${n.id}: bad character`);
  if (!storyDates.includes(dateOf(n.createdAt))) err(`note ${n.id}: date outside timeline`);
  if (n.eventId && !getEvent(n.eventId)) err(`note ${n.id}: bad event ${n.eventId}`);
}
for (const c of chats) {
  if (!getCharacter(c.characterId) || !getCharacter(c.contactId)) err(`chat ${c.id}: bad character/contact`);
  if (c.messages.length < 4 || c.messages.length > 6) err(`chat ${c.id}: has ${c.messages.length} messages (want 4-6)`);
  for (const m of c.messages) {
    if (![c.characterId, c.contactId].includes(m.senderId)) err(`message ${m.id}: sender not in chat`);
    if (!storyDates.includes(dateOf(m.timestamp))) err(`message ${m.id}: date outside timeline`);
    if (m.narrationId) {
      const nar = getNarration(m.narrationId);
      if (!nar) err(`message ${m.id}: missing narration ${m.narrationId}`);
      else if (nar.characterId !== c.characterId) err(`message ${m.id}: narration ${m.narrationId} belongs to another character`);
    }
    if (m.eventId && !getEvent(m.eventId)) err(`message ${m.id}: bad event`);
  }
}
for (const g of gallery) {
  if (!getCharacter(g.characterId)) err(`photo ${g.id}: bad character`);
  if (!storyDates.includes(g.date)) err(`photo ${g.id}: date outside timeline`);
  if (dateOf(g.timestamp) !== g.date) err(`photo ${g.id}: timestamp/date mismatch`);
  if (Math.abs(g.latitude) > 90 || Math.abs(g.longitude) > 180) err(`photo ${g.id}: invalid coordinates`);
  if (!existsSync(g.image)) err(`photo ${g.id}: missing image file ${g.image}`);
  for (const p of [g.photographerId, ...g.people]) if (!getCharacter(p)) err(`photo ${g.id}: unknown person ${p}`);
  const nar = getNarration(g.narrationId);
  if (!nar) err(`photo ${g.id}: missing narration`);
  else if (nar.characterId !== g.characterId) err(`photo ${g.id}: narration belongs to another character`);
  if (g.eventId && !getEvent(g.eventId)) err(`photo ${g.id}: bad event`);
}
for (const t of tweets) {
  if (!getCharacter(t.characterId)) err(`tweet ${t.id}: bad character`);
  if (!storyDates.includes(dateOf(t.timestamp))) err(`tweet ${t.id}: date outside timeline`);
  if (t.media && !existsSync(t.media.image)) err(`tweet ${t.id}: missing image ${t.media.image}`);
  for (const r of t.replies || []) if (!getCharacter(r.authorId)) err(`reply ${r.id}: bad author`);
  if (t.eventId && !getEvent(t.eventId)) err(`tweet ${t.id}: bad event`);
}
for (const n of narrations) {
  if (!getCharacter(n.characterId)) err(`narration ${n.id}: bad character`);
  const r = n.related || {};
  if (r.noteId && !noteIds.has(r.noteId)) err(`narration ${n.id}: bad noteId ${r.noteId}`);
  if (r.galleryId && !photoIds.has(r.galleryId)) err(`narration ${n.id}: bad galleryId ${r.galleryId}`);
  if (r.tweetId && !tweetIds.has(r.tweetId)) err(`narration ${n.id}: bad tweetId ${r.tweetId}`);
  if (r.messageId && !msgIds.has(r.messageId)) err(`narration ${n.id}: bad messageId ${r.messageId}`);
  const owner = (id, list) => list.find((x) => x.id === id)?.characterId;
  if (r.noteId && owner(r.noteId, notes) !== n.characterId) err(`narration ${n.id}: noteId belongs to another character`);
  if (r.galleryId && owner(r.galleryId, gallery) !== n.characterId) err(`narration ${n.id}: galleryId belongs to another character`);
  if (r.tweetId && owner(r.tweetId, tweets) !== n.characterId) err(`narration ${n.id}: tweetId belongs to another character`);
  if (r.messageId && messages.find((m) => m.id === r.messageId)?.chat.characterId !== n.characterId)
    err(`narration ${n.id}: messageId belongs to another character`);
}

// minimum viable content (per playable character)
for (const c of playable) {
  const count = (list, key = 'characterId') => list.filter((x) => x[key] === c.id).length;
  if (count(notes) < 2) err(`${c.id}: fewer than 2 notes`);
  if (count(chats) < 2) err(`${c.id}: fewer than 2 chats`);
  if (count(gallery) < 3) err(`${c.id}: fewer than 3 photos`);
  if (count(tweets) < 3) err(`${c.id}: fewer than 3 tweets`);
  for (const d of storyDates) {
    const has = [
      notes.some((n) => n.characterId === c.id && dateOf(n.createdAt) === d),
      gallery.some((g) => g.characterId === c.id && g.date === d),
      tweets.some((t) => t.characterId === c.id && dateOf(t.timestamp) === d),
    ];
    if (!has.every(Boolean)) err(`${c.id}: missing content on ${d} (notes/gallery/tweets)`);
  }
}
if (timeline.length < 3) err('timeline: need at least 3 dates');

// events referenced by multiple apps
for (const day of timeline) {
  for (const ev of day.events) {
    const apps = new Set();
    if (notes.some((n) => n.eventId === ev.id)) apps.add('notes');
    if (messages.some((m) => m.eventId === ev.id)) apps.add('whatsapp');
    if (gallery.some((g) => g.eventId === ev.id)) apps.add('gallery');
    if (tweets.some((t) => t.eventId === ev.id)) apps.add('twitter');
    console.log(`${ev.id.padEnd(12)} -> ${[...apps].join(', ') || '(none)'}`);
    if (apps.size < 2) err(`event ${ev.id}: referenced by fewer than 2 apps`);
  }
}

if (errors.length) {
  console.error(`\n${errors.length} problem(s):`);
  for (const e of errors) console.error(' - ' + e);
  process.exit(1);
}
console.log(`\nOK: ${characters.length} characters, ${timeline.length} dates, ${notes.length} notes, ${chats.length} chats / ${messages.length} messages, ${narrations.length} narrations, ${gallery.length} photos, ${tweets.length} tweets.`);
