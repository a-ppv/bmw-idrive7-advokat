'use strict';
/**
 * Send the app's log to the upload endpoint (azure/ at the repository's owner, README there). One press sends
 * the previous log (<id>.log.1) and the current one (<id>.log), each as its own request; the endpoint is
 * app.json "config.logUpload" { url, token }. Needs the internet: app.json "internet" (the Store's uplink).
 *
 * The endpoint takes MAX_BYTES per request; a longer file is cut to its last MAX_BYTES (the end of a log is
 * what matters) and the status line says so. The status says what happened and why:
 * Sent / No internet / Timed out / Rejected / Too large / Server error. Nothing is sent but on a press.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

const MAX_BYTES = 19 * 1024 * 1024;          // the endpoint refuses more than 20 MB a request
const TIMEOUT_MS = 30000;
const NO_NET = ['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ENETUNREACH', 'EHOSTUNREACH', 'ENETDOWN', 'ECONNRESET'];

/** The last MAX_BYTES of a file as a Buffer ({ buf, cut }), or null when it is missing or empty. */
function readTail(file) {
    let fd;
    try {
        fd = fs.openSync(file, 'r');
        const size = fs.fstatSync(fd).size;
        if (!size) return null;
        const len = Math.min(size, MAX_BYTES);
        const buf = Buffer.alloc(len);
        let got = 0;
        while (got < len) {
            const n = fs.readSync(fd, buf, got, len - got, size - len + got);
            if (n <= 0) break;
            got += n;
        }
        return { buf: buf.slice(0, got), cut: size > len };
    } catch (e) {
        return null;
    } finally {
        if (fd !== undefined) try { fs.closeSync(fd); } catch (e) { /* closed */ }
    }
}

/** POST one body: resolves { status } or rejects { code } ('TIMEOUT', or the socket's error code). */
function post(cfg, device, body) {
    return new Promise((resolve, reject) => {
        const u = new URL(cfg.url);
        const req = https.request({
            method: 'POST', hostname: u.hostname, port: u.port || 443, path: u.pathname + u.search,
            headers: { 'x-token': cfg.token, 'x-device': device, 'content-type': 'application/octet-stream', 'content-length': body.length },
        }, (res) => {
            res.resume();
            res.on('end', () => resolve({ status: res.statusCode }));
        });
        req.setTimeout(TIMEOUT_MS, () => { req.abort(); reject({ code: 'TIMEOUT' }); });
        req.on('error', (e) => reject({ code: e.code || 'ERROR', message: e.message }));
        req.end(body);
    });
}

/** The words for a failed request, from its HTTP status or socket error. */
function failText(status, code) {
    if (status === 401) return 'Rejected · wrong token';
    if (status === 413) return 'Too large for the server';
    if (status >= 500) return 'Server error (HTTP ' + status + ')';
    if (status) return 'Not sent (HTTP ' + status + ')';
    if (code === 'TIMEOUT') return 'Timed out';
    if (NO_NET.indexOf(code) >= 0) return 'No internet';
    return 'Not sent (' + code + ')';
}

class LogSender {
    /** ctx: { spec, dataDir, log }; request: the POST (tests hand in their own). */
    constructor(ctx, request) {
        this.ctx = ctx;
        this.post = request || post;
        this.state = 'idle';                 // idle | sending | done
        this.ok = false;
        this.text = '';
    }

    view() { return { state: this.state, ok: this.ok, text: this.text }; }

    /** One press: the previous log, then the current one. Never two at once. */
    async send() {
        if (this.state === 'sending') return this.view();
        const { spec, dataDir, log } = this.ctx;
        const cfg = (spec.config || {}).logUpload;
        const finish = (ok, text) => { this.state = 'done'; this.ok = ok; this.text = text; log.info('log upload: ' + text); return this.view(); };
        if (!cfg || !cfg.url || !cfg.token) return finish(false, 'Upload is not set up');
        const base = path.join(dataDir, spec.id + '.log');
        const files = [[base + '.1', 'prev'], [base, 'cur']].map(([f, tag]) => ({ tag, tail: readTail(f) })).filter((x) => x.tail);
        if (!files.length) return finish(false, 'No log to send');
        this.state = 'sending';
        this.ok = false;
        this.text = 'Sending…';
        let bytes = 0, cut = false;
        for (const f of files) {
            log.info('log upload: ' + f.tag + ' ' + f.tail.buf.length + ' bytes' + (f.tail.cut ? ' (cut to the last ' + MAX_BYTES + ')' : ''));
            let r;
            try {
                r = await this.post(cfg, 'v' + spec.version + '-' + f.tag, f.tail.buf);
            } catch (e) {
                if (e && e.message) log.info('log upload: ' + e.message);      // the detail stays in the log, not on the screen
                return finish(false, failText(0, e && e.code));
            }
            if (r.status !== 201) return finish(false, failText(r.status));
            bytes += f.tail.buf.length;
            cut = cut || f.tail.cut;
        }
        const mb = bytes / (1024 * 1024);
        return finish(true, 'Sent ' + files.length + (files.length > 1 ? ' files · ' : ' file · ') + (mb >= 0.1 ? mb.toFixed(1) + ' MB' : bytes + ' bytes') +
            (cut ? ' · older lines cut' : ''));
    }
}

module.exports = { LogSender, readTail, failText, MAX_BYTES };
