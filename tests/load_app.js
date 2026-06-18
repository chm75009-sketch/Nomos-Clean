'use strict';
// Full-app loader: runs the real script.js inside a tolerant browser shim so we
// can call the real functions (sectors, temperatures, photos, products…).
const fs = require('fs');
const vm = require('vm');

function makeClassList() {
  const set = new Set();
  return {
    add() { for (const a of arguments) set.add(a); },
    remove() { for (const a of arguments) set.delete(a); },
    contains(c) { return set.has(c); },
    toggle(c, f) { if (f === undefined) { set.has(c) ? set.delete(c) : set.add(c); } else { f ? set.add(c) : set.delete(c); } return set.has(c); },
    _set: set
  };
}
function makeEl(tag) {
  const el = {
    tagName: (tag || 'div').toUpperCase(), value: '', textContent: '', innerHTML: '', disabled: false, checked: false,
    style: {}, className: '', classList: makeClassList(), _attrs: {}, _children: [], _qsa: {},
    getAttribute(k) { return this._attrs[k] != null ? this._attrs[k] : null; },
    setAttribute(k, v) { this._attrs[k] = String(v); },
    removeAttribute(k) { delete this._attrs[k]; },
    appendChild(c) { this._children.push(c); return c; },
    removeChild(c) { const i = this._children.indexOf(c); if (i >= 0) this._children.splice(i, 1); return c; },
    insertBefore(c) { this._children.unshift(c); return c; },
    addEventListener() {}, removeEventListener() {}, focus() {}, blur() {}, click() {}, scrollIntoView() {},
    querySelector(sel) { const a = this.querySelectorAll(sel); return a[0] || null; },
    querySelectorAll(sel) { return this._qsa[sel] ? this._qsa[sel].slice() : []; },
    getContext() { return { fillRect() {}, drawImage() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, clearRect() {}, getImageData() { return { data: [] }; }, putImageData() {}, fillText() {}, measureText() { return { width: 0 }; }, save() {}, restore() {}, translate() {}, scale() {}, setTransform() {} }; },
    toDataURL() { return 'data:image/jpeg;base64,' + Buffer.from('x').toString('base64'); },
    getBoundingClientRect() { return { top: 0, left: 0, width: 100, height: 100, right: 100, bottom: 100 }; },
    closest() { return null; }, matches() { return false; },
    setSelectionRange() {}, select() {}, remove() {}, cloneNode() { return makeEl(this.tagName); }
  };
  Object.defineProperty(el, 'files', { value: [], writable: true });
  return el;
}

function makeDocument() {
  const registry = {};
  const doc = {
    _registry: registry,
    _auto: true,
    getElementById(id) { if (registry[id]) return registry[id]; if (this._auto) { const e = makeEl('div'); e.id = id; registry[id] = e; return e; } return null; },
    _ensure(id) { if (!registry[id]) { registry[id] = makeEl('div'); registry[id].id = id; } return registry[id]; },
    createElement(tag) { return makeEl(tag); },
    createElementNS() { return makeEl('svg'); },
    createTextNode(t) { return { textContent: t, nodeType: 3 }; },
    createDocumentFragment() { return makeEl('fragment'); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementsByClassName() { return []; },
    getElementsByTagName() { return []; },
    _handlers: {},
    addEventListener(type, fn) { (this._handlers[type] = this._handlers[type] || []).push(fn); },
    removeEventListener() {},
    _dispatch(type, ev) { (this._handlers[type] || []).forEach(function (fn) { try { fn(ev); } catch (e) {} }); },
    body: makeEl('body'), head: makeEl('head'), documentElement: makeEl('html'),
    cookie: '', title: '', readyState: 'complete',
    hidden: false, visibilityState: 'visible',
    execCommand() { return true; }
  };
  doc.body.appendChild = function (c) { this._children.push(c); return c; };
  return doc;
}

function makeStorage() {
  const m = {};
  return {
    getItem(k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
    setItem(k, v) { m[k] = String(v); },
    removeItem(k) { delete m[k]; },
    clear() { for (const k of Object.keys(m)) delete m[k]; },
    key(i) { return Object.keys(m)[i] || null; },
    get length() { return Object.keys(m).length; },
    _m: m
  };
}

function buildContext(opts) {
  opts = opts || {};
  const doc = makeDocument();
  const listeners = {};
  const win = {};
  const loc = { href: 'https://app.local/', origin: 'https://app.local', protocol: 'https:', host: 'app.local', hostname: 'app.local', pathname: '/', search: '', hash: '', reload() {}, replace() {}, assign() {} };
  const fetchMock = opts.fetch || function () { return new Promise(function () {}); }; // never resolves by default
  const ctx = {
    window: win, document: doc, navigator: { userAgent: 'node', onLine: true, language: 'fr-FR', languages: ['fr-FR'], serviceWorker: { register() { return Promise.resolve({ addEventListener() {} }); }, ready: new Promise(function () {}), addEventListener() {}, controller: null }, mediaDevices: { getUserMedia() { return Promise.reject(new Error('no media')); } }, clipboard: { writeText() { return Promise.resolve(); } }, vibrate() {}, permissions: { query() { return Promise.resolve({ state: 'granted' }); } } },
    location: loc,
    history: { pushState() {}, replaceState() {}, back() {}, forward() {}, go() {}, length: 1, state: null },
    localStorage: makeStorage(), sessionStorage: makeStorage(),
    console: { log() {}, info() {}, warn() {}, error() {}, debug() {} },
    setTimeout(fn) { return 0; }, clearTimeout() {}, setInterval() { return 0; }, clearInterval() {}, requestAnimationFrame() { return 0; }, cancelAnimationFrame() {},
    queueMicrotask(fn) { Promise.resolve().then(fn); },
    fetch: fetchMock,
    atob(s) { return Buffer.from(s, 'base64').toString('binary'); },
    btoa(s) { return Buffer.from(s, 'binary').toString('base64'); },
    TextEncoder: globalThis.TextEncoder, TextDecoder: globalThis.TextDecoder,
    MutationObserver: function () { this.observe = function () {}; this.disconnect = function () {}; this.takeRecords = function () { return []; }; },
    Blob: function (parts, opt) { this.size = (parts && parts[0] && parts[0].length) || 0; this.type = (opt && opt.type) || ''; },
    File: function () {}, FileReader: function () { this.readAsDataURL = function () { if (this.onload) this.onload({ target: { result: 'data:image/jpeg;base64,AAAA' } }); }; this.readAsText = function () { if (this.onload) this.onload({ target: { result: '' } }); }; },
    Image: function () { const self = this; setTimeout(function () { if (self.onload) self.onload(); }, 0); },
    URL: { createObjectURL() { return 'blob:x'; }, revokeObjectURL() {} },
    crypto: globalThis.crypto || { randomUUID() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); }); }, getRandomValues(a) { for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); return a; } },
    indexedDB: { open() { const req = {}; setTimeout(function () { if (req.onupgradeneeded) req.onupgradeneeded({ target: { result: { objectStoreNames: { contains() { return false; } }, createObjectStore() { return { createIndex() {} }; } } } }); if (req.onsuccess) req.onsuccess({ target: { result: makeIDB() } }); }, 0); return req; }, deleteDatabase() { return {}; } },
    alert: opts.alert || function () {}, confirm: opts.confirm || function () { return false; }, prompt: opts.prompt || function () { return null; },
    addEventListener(t, fn) { (listeners[t] = listeners[t] || []).push(fn); }, removeEventListener() {},
    dispatchEvent() { return true; },
    matchMedia() { return { matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }; },
    SpeechRecognition: undefined, webkitSpeechRecognition: undefined,
    speechSynthesis: { speak() {}, cancel() {}, getVoices() { return []; } },
    emailjs: { init() {}, send() { return Promise.resolve(); } },
    _listeners: listeners
  };
  function makeIDB() {
    return { transaction() { return { objectStore() { return { put() { return req(); }, get() { return req(); }, getAll() { return req([]); }, delete() { return req(); }, openCursor() { return req(null); }, index() { return { getAll() { return req([]); }, openCursor() { return req(null); } }; } }; }, oncomplete: null, onerror: null }; }, close() {} };
    function req(val) { const r = {}; setTimeout(function () { if (r.onsuccess) r.onsuccess({ target: { result: val } }); }, 0); return r; }
  }
  // window self-references
  win.console = ctx.console; win.queueMicrotask = ctx.queueMicrotask; win.dispatchEvent = ctx.dispatchEvent;
  win.SpeechRecognition = ctx.SpeechRecognition; win.webkitSpeechRecognition = ctx.webkitSpeechRecognition; win.speechSynthesis = ctx.speechSynthesis;
  win.sessionStorage = ctx.sessionStorage; win.cancelAnimationFrame = ctx.cancelAnimationFrame; win.File = ctx.File;
  win.window = win; win.document = doc; win.location = loc; win.navigator = ctx.navigator;
  win.localStorage = ctx.localStorage; win.sessionStorage = ctx.sessionStorage;
  win.history = ctx.history; win.fetch = ctx.fetch; win.atob = ctx.atob; win.btoa = ctx.btoa;
  win.setTimeout = ctx.setTimeout; win.clearTimeout = ctx.clearTimeout; win.setInterval = ctx.setInterval; win.clearInterval = ctx.clearInterval;
  win.addEventListener = ctx.addEventListener; win.removeEventListener = ctx.removeEventListener;
  win.crypto = ctx.crypto; win.indexedDB = ctx.indexedDB; win.matchMedia = ctx.matchMedia;
  win.alert = ctx.alert; win.confirm = ctx.confirm; win.prompt = ctx.prompt;
  win.Blob = ctx.Blob; win.FileReader = ctx.FileReader; win.Image = ctx.Image; win.URL = ctx.URL;
  win.emailjs = ctx.emailjs; win.requestAnimationFrame = ctx.requestAnimationFrame;
  win.HACCP_CONFIG = { ADMIN_PASSWORD: 'x', EMAILJS_PUBLIC_KEY: '', EMAILJS_TEMPLATE_CLIENT: '', EMAILJS_SERVICE: '', SUPABASE_URL: 'https://sb.local', SUPABASE_ANON: 'anon' };
  ctx.HACCP_CONFIG = win.HACCP_CONFIG;
  ctx.globalThis = ctx;
  return ctx;
}

function loadApp(opts) {
  const src = fs.readFileSync(require('path').join(__dirname, '..', 'script.js'), 'utf8');
  const ctx = buildContext(opts);
  vm.createContext(ctx);
  const errors = [];
  try {
    vm.runInContext(src, ctx, { filename: 'script.js', timeout: 15000 });
  } catch (e) {
    errors.push(e);
  }
  ctx._loadErrors = errors;
  ctx.document._auto = false; // strict after load: unknown ids => null (real behavior)
  return ctx;
}

module.exports = { loadApp, buildContext, makeEl, makeDocument };
