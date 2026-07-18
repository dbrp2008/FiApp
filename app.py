import os
import re
import json
import math
import time
import hmac
import secrets
from datetime import datetime, timezone, timedelta
import psycopg2
import psycopg2.extras
from psycopg2 import sql as _sql
from psycopg2 import pool as _pgpool
from flask import (Flask, render_template, request, flash,
    session, jsonify, redirect, url_for, send_from_directory, abort, g)
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
import requests
try:
    from flask_limiter import Limiter
    from flask_limiter.util import get_remote_address
    _limiter_available = True
except ImportError:
    _limiter_available = False
try:
    from authlib.integrations.flask_client import OAuth
    _authlib_available = True
except ImportError:
    _authlib_available = False


_rates_cache: dict = {}
_rates_ts: dict = {}
RATES_TTL = 3600

# In-memory only (per-Gunicorn-worker, like _rates_cache above) — light-touch cache so
# repeat (income, status) lookups against the same income/status don't re-hit
# api.taxapi.net every time. No DB tier: tax results are cheap to recompute and this
# dependency is staying as-is rather than being unified into a local calculator.
_tax_cache: dict = {}
TAX_TTL = 3600

# Row/column/subscription limits — enforced server-side (via _within_limits) and client-side.
MAX_SUBS = 100
MAX_ROWS = 20
MAX_COLS = 12

# Expenses tracker's per-month budget-panel income/tax figures (data.income in
# _within_limits) — bounds-checked so a forged /api/save/expenses payload can't stuff
# the JSONB blob with oversized numbers or an unbounded number of month keys.
MAX_INCOME_MONTHS = 600
MAX_INCOME_VALUE = 1_000_000_000

# rowsByMonth/colsByMonth are dicts keyed by month — _within_limits bounded each array's
# length but not how many month keys could exist, nor the cells dict size or string
# lengths within the blob. 600 months = 50 years, matching MAX_INCOME_MONTHS's precedent.
# MAX_CELLS is set to comfortably exceed the legitimate worst case (600 months *
# MAX_ROWS * MAX_COLS = 144,000) while still bounding a forged payload.
MAX_TRACKED_MONTHS = MAX_INCOME_MONTHS
MAX_CELLS = 200_000
MAX_LABEL_LEN = 200

# Sync conflict detection (W3): how many revisions to retain per (user, tracker).
_REVISION_KEEP = 20

# Maps each tracker's API name to its JSONB blob column and version-counter column.
# Used by _save_tracker_versioned/_load_tracker_versioned to build identifier-safe SQL.
_TRACKER_COLUMNS = {
    'expenses': ('expenses_data', 'expenses_version'),
    'subs':     ('subs_data',     'subs_version'),
    'income':   ('income_data',   'income_version'),
}

app = Flask(__name__, template_folder='templates')
app.secret_key = os.environ.get("SECRET_KEY")
if not app.secret_key:
    raise RuntimeError("SECRET_KEY environment variable is required")
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = os.environ.get('COOKIE_INSECURE') != '1' and not app.debug
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=1)
app.config['MAX_CONTENT_LENGTH'] = 1_000_000  # 1 MB — prevents oversized save payloads
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 31_536_000  # 1 year — every /static/ asset is
# loaded with ?v=ASSET_V (bumped each deploy), so the URL changes when the file changes;
# a long cache is therefore safe and lets repeat visits skip re-downloading (~219 KiB).

# Cache-busting stamp appended to asset URLs as ?v=ASSET_V. Recomputed at startup from the
# newest static/template file mtime, so each deploy yields a new value and browsers fetch the
# updated JS/CSS instead of serving a stale cached copy (replaces hand-maintained ?v= dates).
def _compute_asset_version():
    latest = 0.0
    for _base in (app.static_folder, os.path.join(app.root_path, app.template_folder or 'templates')):
        if not _base:
            continue
        for _dp, _dirs, _fns in os.walk(_base):
            for _fn in _fns:
                try:
                    latest = max(latest, os.path.getmtime(os.path.join(_dp, _fn)))
                except OSError:
                    pass
    return str(int(latest)) if latest else 'dev'
ASSET_V = _compute_asset_version()
app.jinja_env.globals['ASSET_V'] = ASSET_V

EXCHANGE_API_KEY = os.environ.get("EXCHANGE_API_KEY")
if not EXCHANGE_API_KEY:
    app.logger.warning(
        "EXCHANGE_API_KEY is not set — live exchange-rate fetches will fail "
        "(cached/DB rates still work).")

# Currency codes are ISO-4217 three-letter uppercase. Validating before building
# the upstream URL prevents control-char/path injection into the exchange API call.
_CCY_RE = re.compile(r'^[A-Z]{3}$')

# ── Theme Studio: custom-theme validation ──────────────────────────────────
# Theme token values are written straight into style.setProperty on the client, so they
# must be validated to a strict colour/length/shadow grammar. The charset gate is the real
# security floor: with no ':' '/' ';' '}' or quotes possible, url()/expression() payloads
# and CSS property breakout cannot be expressed regardless of the type regexes.
MAX_CUSTOM_THEMES = 10
MAX_THEMES_JSON = 32768
_THEME_NAME_RE = re.compile(r'^[^\x00-\x1f]{1,24}$')
_THEME_ID_RE = re.compile(r'^ct_[a-z0-9]{8}$')
_TOK_HEX = r'#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?'
_TOK_RGBA = r'rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|1\.0|0?\.\d{1,4})\s*)?\)'
_THEME_COLOR_RE = re.compile(r'^(?:' + _TOK_HEX + r'|' + _TOK_RGBA + r')$')
_THEME_LEN_RE = re.compile(r'^\d{1,2}px$')
_SHADOW_LAYER = r'-?\d{1,3}(?:px)?\s+-?\d{1,3}(?:px)?\s+\d{1,3}(?:px)?(?:\s+-?\d{1,3}(?:px)?)?\s+(?:' + _TOK_HEX + r'|' + _TOK_RGBA + r')'
_THEME_SHADOW_RE = re.compile(r'^' + _SHADOW_LAYER + r'(?:\s*,\s*' + _SHADOW_LAYER + r'){0,2}$')
_THEME_CHARSET_RE = re.compile(r'^[#0-9a-zA-Z().,%\s-]{1,120}$')
# token -> type. Must mirror FIAPP_CUSTOM_TOKENS in static/js/theme-core.js.
_THEME_TOKEN_TYPES = {
    '--accent': 'color', '--accent-strong': 'color', '--link': 'color', '--link-text': 'color',
    '--bg': 'color', '--panel-bg': 'color', '--panel-border': 'color', '--hover-bg': 'color',
    '--input-focus': 'color', '--total-bg': 'color', '--total-fg': 'color', '--total-soft': 'color',
    '--th-bg': 'color', '--th-fg': 'color', '--row-header-bg': 'color', '--row-header-fg': 'color',
    '--secondary-bg': 'color', '--secondary-fg': 'color', '--secondary-hover': 'color',
    '--result-bg': 'color', '--grad-from': 'color', '--grad-to': 'color',
    '--glow-1': 'color', '--glow-2': 'color', '--glass-bg': 'color', '--glass-border': 'color',
    '--glass-blur': 'length', '--shell-rail-bg': 'color',
    '--elev-hero': 'shadow', '--elev-cta': 'shadow',
    '--fg': 'color', '--muted': 'color', '--input-bg': 'color', '--input-border': 'color',
    '--overlay': 'color', '--shadow': 'shadow', '--shadow-soft': 'shadow',
    '--tooltip-bg': 'color', '--tooltip-fg': 'color',
    '--error-bg': 'color', '--error-fg': 'color', '--error-border': 'color',
    '--success-bg': 'color', '--success-fg': 'color', '--success-border': 'color',
    '--result-border': 'color',
    '--elev-1': 'shadow', '--elev-2': 'shadow', '--elev-3': 'shadow',
    '--tabbar-bg': 'color', '--track-bg': 'color',
}
# The full set a theme's `tokens` must contain, per mode (light omits the dark-only extras).
_LIGHT_ONLY = {'--accent', '--accent-strong', '--link', '--link-text', '--bg', '--panel-bg',
    '--panel-border', '--hover-bg', '--input-focus', '--total-bg', '--total-fg', '--total-soft',
    '--th-bg', '--th-fg', '--row-header-bg', '--row-header-fg', '--secondary-bg', '--secondary-fg',
    '--secondary-hover', '--result-bg', '--grad-from', '--grad-to', '--glow-1', '--glow-2',
    '--glass-bg', '--glass-border', '--glass-blur', '--shell-rail-bg', '--elev-hero', '--elev-cta'}
_DARK_EXTRA = {'--fg', '--muted', '--input-bg', '--input-border', '--overlay', '--shadow',
    '--shadow-soft', '--tooltip-bg', '--tooltip-fg', '--error-bg', '--error-fg', '--error-border',
    '--success-bg', '--success-fg', '--success-border', '--result-border', '--elev-1', '--elev-2',
    '--elev-3', '--tabbar-bg', '--track-bg'}
_REQUIRED_LIGHT = _LIGHT_ONLY
_REQUIRED_DARK = _LIGHT_ONLY | _DARK_EXTRA
_PRESET_NAMES = {'ocean', 'forest', 'sunset', 'midnight', 'rose', 'purple', 'indigo'}


def _valid_token_value(ttype, val):
    if not isinstance(val, str) or not _THEME_CHARSET_RE.match(val):
        return False
    if ttype == 'color':
        return bool(_THEME_COLOR_RE.match(val))
    if ttype == 'length':
        return bool(_THEME_LEN_RE.match(val))
    if ttype == 'shadow':
        return bool(_THEME_SHADOW_RE.match(val))
    return False


def _validate_custom_themes(raw):
    """Return a normalized {v:1, themes:[...]} envelope, or raise ValueError."""
    if isinstance(raw, list):            # tolerate a bare list; wrap it
        raw = {'v': 1, 'themes': raw}
    if not isinstance(raw, dict) or not isinstance(raw.get('themes'), list):
        raise ValueError("themes_custom must be an object with a themes array")
    themes = raw['themes']
    if len(themes) > MAX_CUSTOM_THEMES:
        raise ValueError("too many custom themes")
    seen_ids, out = set(), []
    for t in themes:
        if not isinstance(t, dict):
            raise ValueError("theme must be an object")
        tid = t.get('id')
        if not isinstance(tid, str) or not _THEME_ID_RE.match(tid) or tid in seen_ids:
            raise ValueError("invalid or duplicate theme id")
        seen_ids.add(tid)
        name = t.get('name')
        if not isinstance(name, str) or not _THEME_NAME_RE.match(name.strip()) or not name.strip():
            raise ValueError("invalid theme name")
        mode = t.get('mode')
        if mode not in ('light', 'dark'):
            raise ValueError("invalid theme mode")
        preset = t.get('preset')
        if preset is not None and preset not in _PRESET_NAMES:
            raise ValueError("invalid preset flag")
        seeds = t.get('seeds')
        if not isinstance(seeds, dict) or set(seeds.keys()) != {'accent', 'gradFrom', 'gradTo', 'tint'} \
                or not all(_THEME_COLOR_RE.match(v) if isinstance(v, str) else False for v in seeds.values()):
            raise ValueError("invalid seeds")
        for key in ('overrides', 'tokens'):
            d = t.get(key)
            if not isinstance(d, dict):
                raise ValueError("invalid " + key)
            for tk, tv in d.items():
                if tk not in _THEME_TOKEN_TYPES or not _valid_token_value(_THEME_TOKEN_TYPES[tk], tv):
                    raise ValueError("invalid token in " + key)
        required = _REQUIRED_DARK if mode == 'dark' else _REQUIRED_LIGHT
        if not required.issubset(set(t['tokens'].keys())):
            raise ValueError("tokens incomplete for mode")
        out.append({'id': tid, 'name': name.strip(), 'mode': mode, 'preset': preset,
                    'seeds': {k: seeds[k] for k in ('accent', 'gradFrom', 'gradTo', 'tint')},
                    'overrides': dict(t['overrides']), 'tokens': dict(t['tokens'])})
    envelope = {'v': 1, 'themes': out}
    if len(json.dumps(envelope)) > MAX_THEMES_JSON:
        raise ValueError("themes_custom too large")
    return envelope


def _theme_is_dark(theme_value, themes_env):
    """Resolve whether a stored theme value renders on a dark base (for pre-paint FOUC)."""
    if theme_value == 'dark':
        return True
    if theme_value == 'midnight':          # legacy dark theme, pre-migration
        return True
    if isinstance(theme_value, str) and theme_value.startswith('custom:'):
        tid = theme_value.split(':', 1)[1]
        for t in (themes_env or {}).get('themes', []):
            if t.get('id') == tid:
                return t.get('mode') == 'dark'
    return False


if _limiter_available:
    # default_limits is a global per-IP backstop so every route — including the data API
    # and any route without an explicit @_rl — has a ceiling against single-source floods.
    # (Real volumetric DDoS is an infra-layer concern; this only bounds app-level abuse.)
    _ratelimit_storage = os.environ.get("RATELIMIT_STORAGE_URI", "memory://")
    limiter = Limiter(get_remote_address, app=app,
        default_limits=["600 per hour", "120 per minute"],
        storage_uri=_ratelimit_storage,
        storage_options={"socket_connect_timeout": 2},
        # If the storage backend (e.g. Redis) is unreachable, fail OPEN — serve the
        # request rather than 500 every route. Limits lapse during the outage; that's
        # the right trade for availability on a personal-finance app.
        swallow_errors=True)
    # memory:// keeps counters per-process, so on multi-worker Gunicorn the effective
    # limit is ~N× looser than configured. Surface that in prod so a deploy without a
    # shared store (Redis) is visible rather than silently weakened.
    if not app.debug and _ratelimit_storage.startswith("memory://"):
        app.logger.warning(
            "RATELIMIT_STORAGE_URI is memory:// — per-worker limits only; "
            "set it to your Redis URL for limits that hold across all workers.")

    @limiter.request_filter
    def _limiter_exempt_infra():
        # Don't count static assets, the CSS route, or the health check against any limit:
        # one page load pulls many static files and Render polls /ping, so leaving these in
        # would exhaust a per-IP minute budget on legitimate traffic.
        return request.endpoint in ('static', 'serve_css', 'ping')

    def _rl(*limits, **kwargs):
        """Apply rate limits only when Flask-Limiter is available."""
        return limiter.limit("; ".join(limits), **kwargs)
else:
    app.logger.warning(
        "Flask-Limiter is NOT installed — rate limiting is DISABLED. "
        "Install Flask-Limiter before deploying to production.")
    class _NoopDecorator:
        def __call__(self, f): return f
    def _rl(*limits, **kwargs):
        return _NoopDecorator()

# ── Google Sign-In (OpenID Connect) ──────────────────────────────────────────
# Optional and gracefully degrading, mirroring the Flask-Limiter pattern above:
# enabled only when Authlib is importable AND both client credentials are present.
# Otherwise the app runs exactly as before (password auth only; the Google button is
# hidden via the `google_enabled` template flag). Server-side Authorization-Code + OIDC
# is redirect-based, so the strict CSP stays untouched (no Google JS SDK). Authlib does
# discovery, PKCE, nonce and id_token validation — we don't hand-roll any of it.
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET")
_google_enabled = bool(_authlib_available and GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)
oauth = None
if _google_enabled:
    oauth = OAuth(app)
    oauth.register(
        name="google",
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        # Discovery doc is fetched lazily on first use and cached — no network at import.
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile", "code_challenge_method": "S256"},
    )
elif _authlib_available:
    app.logger.warning(
        "Google sign-in disabled — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable.")
else:
    app.logger.info("Authlib not installed — Google sign-in disabled (password auth unaffected).")

# Native (Capacitor) sign-in posts a Google-issued id_token to /auth/google/native; the
# server verifies it against Google's JWKS. This reuses Authlib's JOSE + requests (both
# already dependencies) rather than adding google-auth. The web redirect flow is untouched;
# Authlib still validates its own id_token inside authorize_access_token().
_google_jwks_cache = {'keys': None, 'ts': 0}
_GOOGLE_JWKS_TTL = 3600  # seconds; Google rotates signing keys periodically

def _google_jwks(force=False):
    from authlib.jose import JsonWebKey
    now = time.time()
    if force or not _google_jwks_cache['keys'] or (now - _google_jwks_cache['ts']) > _GOOGLE_JWKS_TTL:
        meta = oauth.google.load_server_metadata()  # discovery doc, cached by Authlib
        jwks = requests.get(meta['jwks_uri'], timeout=5).json()
        _google_jwks_cache['keys'] = JsonWebKey.import_key_set(jwks)
        _google_jwks_cache['ts'] = now
    return _google_jwks_cache['keys']

def _google_verify_id_token(raw):
    """Verify a native-issued Google id_token. Returns (sub, email) or raises.
    aud must equal our Web client id (the native plugin is configured with it as
    serverClientId); iss/exp are enforced; email must be present and verified."""
    from authlib.jose import jwt as _jose_jwt
    from authlib.jose.errors import JoseError
    claims_options = {
        'iss': {'essential': True, 'values': ['https://accounts.google.com', 'accounts.google.com']},
        'aud': {'essential': True, 'value': GOOGLE_CLIENT_ID},
    }
    claims = None
    for attempt in (0, 1):  # refetch keys once on a signature miss (key rotation)
        try:
            claims = _jose_jwt.decode(raw, _google_jwks(force=(attempt == 1)),
                                      claims_options=claims_options)
            break
        except JoseError:
            if attempt == 1:
                raise ValueError("id_token signature/decode failed")
    claims.validate()  # exp/nbf/iat + the essential iss/aud above
    sub = claims.get('sub')
    email = (claims.get('email') or '').strip().lower()
    if not sub or not email or not claims.get('email_verified'):
        raise ValueError("id_token missing a verified email")
    return sub, email

@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({"error": "Too many attempts. Please wait before trying again."}), 429

@app.errorhandler(404)
def not_found(e):
    if request.path.startswith('/api/'):
        return jsonify({"error": "Not found"}), 404
    return render_template('404.html', **_ctx()), 404

@app.errorhandler(500)
def server_error(e):
    if request.path.startswith('/api/'):
        return jsonify({"error": "Server error"}), 500
    # _ctx() may itself raise if the session/DB is in a bad state — guard against that.
    try:
        ctx = _ctx()
    except Exception:
        ctx = {}
    return render_template('500.html', **ctx), 500

@app.errorhandler(503)
def service_unavailable(e):
    if request.path.startswith('/api/'):
        return jsonify({"error": "Service temporarily unavailable"}), 503
    try:
        ctx = _ctx()
    except Exception:
        ctx = {}
    return render_template('500.html', **ctx), 503

@app.before_request
def set_csp_nonce():
    g.csp_nonce = secrets.token_urlsafe(16)

@app.context_processor
def inject_csp_nonce():
    return {"csp_nonce": getattr(g, 'csp_nonce', '')}

@app.after_request
def set_security_headers(resp):
    resp.headers['X-Content-Type-Options'] = 'nosniff'
    resp.headers['X-Frame-Options'] = 'SAMEORIGIN'
    resp.headers['Referrer-Policy'] = 'no-referrer'
    # Defense-in-depth capability + cross-origin isolation. Microphone is deliberately
    # NOT restricted here (voice input uses it; features left unnamed keep their default
    # self allowance). Google sign-in is a full-page redirect, so COOP: same-origin is safe.
    resp.headers['Permissions-Policy'] = 'geolocation=(), camera=(), payment=(), usb=()'
    resp.headers['Cross-Origin-Opener-Policy'] = 'same-origin'
    resp.headers['Cross-Origin-Resource-Policy'] = 'same-origin'
    nonce = getattr(g, 'csp_nonce', '')
    resp.headers['Content-Security-Policy'] = (
        "default-src 'self'; "
        f"script-src 'self' 'nonce-{nonce}'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; "
        "font-src 'self' data:; "
        "connect-src 'self'; "
        "worker-src 'self'; "
        "manifest-src 'self'; "
        "base-uri 'self'; "
        "form-action 'self'; "
        "frame-ancestors 'self'; "
        "object-src 'none'"
    )
    if not app.debug:
        resp.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    # Authenticated HTML documents embed the CSRF token + identity metadata (username, and
    # on /account the email + Google linkage). Forbid the browser HTTP cache / bfcache from
    # retaining them so a shared profile can't surface a prior user's page after logout.
    # (The service-worker cache stores pages explicitly and is purged separately on logout.)
    if session.get('user_id') and resp.mimetype == 'text/html':
        resp.headers['Cache-Control'] = 'no-store'
    return resp


_db_pool = None

def init_pool():
    global _db_pool
    _db_pool = _pgpool.ThreadedConnectionPool(
        2, 10, os.environ["DATABASE_URL"],
        keepalives=1, keepalives_idle=30, keepalives_interval=5, keepalives_count=3
    )

def get_db():
    for _ in range(2):
        try:
            conn = _db_pool.getconn()
        except _pgpool.PoolError:
            abort(503, "Database connection pool exhausted")
        if conn.closed:
            try:
                _db_pool.putconn(conn, close=True)
            except Exception:
                pass
            continue
        try:
            # Probe the connection to detect stale SSL sessions before the caller uses it.
            # conn.closed only catches explicitly-closed connections; a server-side SSL drop
            # won't be detected until the first execute() otherwise.
            conn.cursor().execute('SELECT 1')
            conn.rollback()  # clean up the implicit transaction started by the probe
        except psycopg2.OperationalError:
            try:
                _db_pool.putconn(conn, close=True)
            except Exception:
                pass
            continue
        return conn
    abort(503, "Database connection unavailable")

def release_db(conn):
    if conn and _db_pool:
        _db_pool.putconn(conn)

def init_db():
    conn = get_db()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS users (
                        id SERIAL PRIMARY KEY,
                        username TEXT UNIQUE NOT NULL,
                        password_hash TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT NOW()
                    );
                    CREATE TABLE IF NOT EXISTS user_data (
                        user_id INTEGER REFERENCES users(id) PRIMARY KEY,
                        expenses_data JSONB,
                        subs_data JSONB,
                        updated_at TIMESTAMP DEFAULT NOW()
                    );
                    -- Incremental column additions: each ALTER is idempotent (IF NOT EXISTS).
                    -- When adding a new tracker, append a new ALTER here rather than
                    -- modifying existing ones. This pattern works for small schemas;
                    -- migrate to a versioned migration tool (e.g. Alembic) if the schema grows.
                    ALTER TABLE user_data ADD COLUMN IF NOT EXISTS income_data JSONB;
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'light';
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS personality TEXT DEFAULT 'balanced';
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS analytics_currency TEXT DEFAULT 'USD';
                    -- Theme Studio: the user's saved custom themes (a {v,themes:[...]} envelope).
                    -- theme may now be 'light' | 'dark' | 'custom:<id>' referencing this list.
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS themes_custom JSONB DEFAULT '[]'::jsonb;
                    -- Google Sign-In (OIDC): email + the stable Google subject id. Identity is
                    -- keyed on google_sub (never reused); email is for display + uniqueness only.
                    -- password_hash becomes nullable — Google-only accounts have no password
                    -- (DROP NOT NULL is a no-op if already nullable, so it's safe to re-run).
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT;
                    ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
                    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub
                        ON users(google_sub) WHERE google_sub IS NOT NULL;
                    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
                        ON users(email) WHERE email IS NOT NULL;
                    CREATE TABLE IF NOT EXISTS exchange_rates (
                        base TEXT PRIMARY KEY,
                        rates JSONB NOT NULL,
                        fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    );
                    -- Optimistic-concurrency version counters: bumped on every successful save;
                    -- a save whose base_version no longer matches is rejected with 409 (see W3).
                    ALTER TABLE user_data ADD COLUMN IF NOT EXISTS expenses_version INTEGER NOT NULL DEFAULT 0;
                    ALTER TABLE user_data ADD COLUMN IF NOT EXISTS subs_version INTEGER NOT NULL DEFAULT 0;
                    ALTER TABLE user_data ADD COLUMN IF NOT EXISTS income_version INTEGER NOT NULL DEFAULT 0;
                    -- Revision history: one row per successful save, pruned to the most recent
                    -- _REVISION_KEEP per (user, tracker). Powers the account-page "restore a
                    -- previous version" safety net. No ON DELETE CASCADE — delete_account()
                    -- removes these rows explicitly, mirroring how it handles user_data.
                    CREATE TABLE IF NOT EXISTS data_revisions (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER NOT NULL REFERENCES users(id),
                        tracker TEXT NOT NULL,
                        version INTEGER NOT NULL,
                        blob JSONB NOT NULL,
                        saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    );
                    CREATE INDEX IF NOT EXISTS idx_data_revisions_lookup
                        ON data_revisions(user_id, tracker, version DESC);
                    -- Phase 5: native push for subscription-renewal reminders.
                    -- push_enabled is a per-user gate; device_tokens holds one row per
                    -- device (token is globally unique); push_sent dedups the daily scan.
                    ALTER TABLE users ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN NOT NULL DEFAULT FALSE;
                    CREATE TABLE IF NOT EXISTS device_tokens (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER NOT NULL REFERENCES users(id),
                        token TEXT NOT NULL UNIQUE,
                        platform TEXT,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    );
                    CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id);
                    CREATE TABLE IF NOT EXISTS push_sent (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER NOT NULL REFERENCES users(id),
                        dedup_key TEXT NOT NULL UNIQUE,
                        sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    );
                """)
    finally:
        release_db(conn)

# Guard against import-time DB connections in test/REPL contexts.
if os.environ.get('DATABASE_URL'):
    with app.app_context():
        init_pool()
        init_db()


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({"error": "Not logged in"}), 401
        return f(*args, **kwargs)
    return decorated

def csrf_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('X-CSRF-Token', '')
        if not token or not hmac.compare_digest(token, session.get('csrf_token') or ''):
            return jsonify({"error": "Invalid CSRF token"}), 403
        return f(*args, **kwargs)
    return decorated

def _new_csrf():
    """Generate and store a fresh CSRF token in the session."""
    token = secrets.token_hex(32)
    session['csrf_token'] = token
    return token

def _ctx():
    """Return Jinja2 template context with current user info."""
    return {
        "current_user": session.get('username'),
        "current_user_id": session.get('user_id'),
        # Auto-generate a token for sessions that pre-date CSRF being added.
        "csrf_token": session.get('csrf_token') or _new_csrf(),
        "theme": session.get('theme', 'light'),
        # Pre-paint base luminance for a custom/dark theme so a fresh device does not flash
        # the wrong background. Cached in session at login/save; the simple cases resolve
        # without it so no per-render DB read is needed.
        "theme_dark": session.get('theme_dark', _theme_is_dark(session.get('theme', 'light'), None)),
        "personality": session.get('personality', 'balanced'),
        "analytics_currency": session.get('analytics_currency', 'USD'),
        "google_enabled": _google_enabled,
    }

# Constant-time guard: comparing against a real hash when the user is absent
# keeps the "no such user" path as slow as the "wrong password" path.
_DUMMY_PWHASH = generate_password_hash('timing-equalizer')

def _within_limits(data):
    """Server-side mirror of the client MAX_ROWS/MAX_COLS caps."""
    rows = data.get('rows')
    if not isinstance(rows, list) or len(rows) > MAX_ROWS:
        return False
    cols = data.get('cols')
    if cols is not None and (not isinstance(cols, list) or len(cols) > MAX_COLS):
        return False
    rows_by_month = data.get('rowsByMonth') or {}
    cols_by_month = data.get('colsByMonth') or {}
    if len(rows_by_month) > MAX_TRACKED_MONTHS or len(cols_by_month) > MAX_TRACKED_MONTHS:
        return False
    for arr in rows_by_month.values():
        if isinstance(arr, list) and len(arr) > MAX_ROWS:
            return False
        for row in (arr or []):
            if isinstance(row, dict) and isinstance(row.get('label'), str) and len(row['label']) > MAX_LABEL_LEN:
                return False
    for arr in cols_by_month.values():
        if isinstance(arr, list) and len(arr) > MAX_COLS:
            return False
        for col in (arr or []):
            if isinstance(col, dict) and isinstance(col.get('label'), str) and len(col['label']) > MAX_LABEL_LEN:
                return False
    cells = data.get('cells')
    if cells is not None:
        if not isinstance(cells, dict) or len(cells) > MAX_CELLS:
            return False
        for val in cells.values():
            if isinstance(val, str) and len(val) > MAX_LABEL_LEN:
                return False
    income = data.get('income')
    if income is not None:
        if not isinstance(income, dict) or len(income) > MAX_INCOME_MONTHS:
            return False
        for entry in income.values():
            if not isinstance(entry, dict):
                return False
            for field in ('gross', 'tax'):
                val = entry.get(field)
                if val in ('', None):
                    continue
                try:
                    num = float(val)
                except (TypeError, ValueError):
                    return False
                if not math.isfinite(num) or num < 0 or num > MAX_INCOME_VALUE:
                    return False
    return True


@app.route('/styles.css')
def serve_css():
    resp = send_from_directory('templates', 'styles.css', mimetype='text/css')
    resp.cache_control.max_age = 31_536_000   # 1 year — always requested with ?v=ASSET_V
    resp.cache_control.public = True
    resp.cache_control.immutable = True
    return resp


# --- PWA: manifest + service worker --------------------------------------------------
# Both are served from the app root (not /static/) so the service-worker scope can
# cover the whole origin. ASSET_V is injected into the SW as its cache version, so each
# deploy yields a byte-different SW that the browser updates to and which purges the
# previous deploy's caches. See static/js/sw.js for the caching strategy.
try:
    with open(os.path.join(app.static_folder, 'js', 'sw.js'), encoding='utf-8') as _swf:
        _SW_SRC = _swf.read()
except OSError:
    _SW_SRC = ''
    app.logger.warning("static/js/sw.js missing - PWA offline support disabled.")

@app.route('/sw.js')
def service_worker():
    body = 'self.__SW_VERSION=%s;\n%s' % (json.dumps(ASSET_V), _SW_SRC)
    resp = app.response_class(body, mimetype='application/javascript')
    resp.headers['Cache-Control'] = 'no-cache'        # always re-check for a new SW
    resp.headers['Service-Worker-Allowed'] = '/'      # allow root scope from this path
    return resp

@app.route('/manifest.webmanifest')
def web_manifest():
    resp = jsonify({
        "name": "FiApp - Personal Finance",
        "short_name": "FiApp",
        "description": "Track income, expenses, subscriptions and savings.",
        "start_url": "/",
        "scope": "/",
        "display": "standalone",
        "background_color": "#ffffff",
        "theme_color": "#7c3aed",
        "icons": [
            {"src": "/static/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
            {"src": "/static/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
            {"src": "/static/icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"},
        ],
    })
    resp.mimetype = 'application/manifest+json'
    return resp

@app.route('/ping')
def ping():
    return {"status": "functioning!!!"}, 200

@app.route('/')
def home():
    return render_template('index.html', **_ctx())

@app.route('/login', methods=['GET'])
def login_page():
    if 'user_id' in session:
        return redirect(url_for('home'))
    # When ?finish=google, a Google sign-in is mid-way: surface the verified email so the
    # completion panel can show it read-only while the user picks a username.
    return render_template('login.html',
        pending_google_email=session.get('pending_google_email'), **_ctx())

@app.route('/expenses')
def expenses():
    return render_template('expenses.html', **_ctx())

@app.route('/subscriptions')
def subscriptions_page():
    return render_template('subscriptions.html', **_ctx())

@app.route('/analytics')
def analytics():
    return render_template('analytics.html', **_ctx())

@app.route('/income')
def income():
    return render_template('income.html', **_ctx())

@app.route('/account')
def account():
    if 'user_id' not in session:
        return redirect(url_for('login_page'))
    # Surface the auth-method state so the page can show Connect/Change/Disconnect Google,
    # "Set a password", and the right (password vs typed-username) confirm for rename/delete.
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT password_hash, email, google_sub FROM users WHERE id=%s",
                        (session['user_id'],))
            row = cur.fetchone()
    finally:
        release_db(conn)
    has_password = bool(row and row[0])
    google_email = row[1] if (row and row[2]) else None
    return render_template('account.html',
        has_password=has_password, google_email=google_email, **_ctx())

@app.route('/currency', methods=['GET', 'POST'])
@_rl("20 per minute", "200 per hour", methods=["POST"])
def currency():
    if request.method == 'POST':
        currency_i = request.form.get('currency_i', '').upper()
        currency_o = request.form.get('currency_o', '').upper()
        currency_a_raw = request.form.get('currency_a')

        if not _CCY_RE.match(currency_i) or not _CCY_RE.match(currency_o):
            flash('Invalid currency code.', 'error')
            return render_template('currency.html', currency_i=currency_i,
                currency_o=currency_o, currency_a=currency_a_raw or '', **_ctx())
        if not currency_a_raw:
            flash('Please enter a valid number for amount.', 'error')
            return render_template('currency.html', currency_i=currency_i,
                currency_o=currency_o, currency_a='', **_ctx())
        try:
            currency_a = float(currency_a_raw)
            if currency_a < 0:
                flash('Amount cannot be negative.', 'error')
                return render_template('currency.html', currency_i=currency_i,
                    currency_o=currency_o, currency_a=currency_a_raw, **_ctx())

            converted_amount = round(convert(currency_i, currency_a, currency_o), 2)
            flash('Currency converted successfully.', 'success')
            return render_template('currency.html', result=True,
                converted=converted_amount, currency_i=currency_i,
                currency_o=currency_o, currency_a=currency_a_raw, **_ctx())
        except ValueError:
            flash('Please enter a valid number for amount.', 'error')
            return render_template('currency.html', currency_i=currency_i,
                currency_o=currency_o, currency_a=currency_a_raw, **_ctx())
        except KeyError:
            flash('Invalid currency code.', 'error')
            return render_template('currency.html', currency_i=currency_i,
                currency_o=currency_o, currency_a=currency_a_raw, **_ctx())
        except requests.exceptions.RequestException:
            flash("Please check your 'from currency' input. If it is correct, "
                "there has been a problem connecting to the exchange rate API.", 'error')
            return render_template('currency.html', currency_i=currency_i,
                currency_o=currency_o, currency_a=currency_a_raw, **_ctx())

    return render_template('currency.html', currency_i='', currency_o='', currency_a='', **_ctx())

@app.route('/interest', methods=['GET', 'POST'])
@_rl("20 per minute", "200 per hour", methods=["POST"])
def interest():
    if request.method == 'POST':
        interest_type = request.form.get('type')
        try:
            principal = float(request.form.get('principal'))
            rate = float(request.form.get('rate'))
            years = float(request.form.get('years'))   # was 'time' — renamed to avoid shadowing the time module
            if principal < 0 or rate < 0 or years < 0:
                flash('No negative values allowed.', 'error')
                return render_template('interest.html', **_ctx())

            if interest_type == 'simple':
                si = simple_interest(principal, rate, years)
                amt = si + principal
                flash('Simple interest calculated successfully.', 'success')
                result = {'description': 'Simple Interest Result', 'interest': si, 'total': amt}
                return render_template('interest.html', result=result, **_ctx())

            elif interest_type == 'compound':
                periods = float(request.form.get('periods', 1))
                if periods <= 0:
                    flash('Compounding periods must be positive.', 'error')
                    return render_template('interest.html', **_ctx())
                amt = compound_interest(principal, rate, years, periods)
                interest_amt = amt - principal
                flash('Compound interest calculated successfully.', 'success')
                result = {'description': 'Compound Interest Result',
                    'interest': interest_amt, 'total': amt}
                return render_template('interest.html', result=result, **_ctx())

            elif interest_type == 'continuous':
                amt = round(principal * math.exp((rate / 100) * years), 2)
                interest_amt = round(amt - principal, 2)
                flash('Continuous interest calculated successfully.', 'success')
                result = {'description': 'Continuous Compounding Result',
                    'interest': interest_amt, 'total': amt}
                return render_template('interest.html', result=result, **_ctx())

            else:
                flash('Invalid interest type selected.', 'error')
                return render_template('interest.html', **_ctx())

        except ValueError:
            flash('Please enter valid numeric inputs.', 'error')
            return render_template('interest.html', **_ctx())

    return render_template('interest.html', **_ctx())

@app.route('/tax', methods=['GET', 'POST'])
@_rl("20 per minute", "200 per hour", methods=["POST"])
def tax():
    if request.method == 'POST':
        income = request.form.get('income', '').strip()
        status = request.form.get('status', '')
        display_status = status
        if status == 'head of household':
            status = 'hoh'
            display_status = 'Head of Household'
        elif status == 'single':
            display_status = 'Single'
        elif status == 'married':
            display_status = 'Married'
        else:
            flash('Please select a valid filing status.', 'error')
            return render_template('tax.html', income=income, status='', **_ctx())

        try:
            income_float = float(income)
            if not math.isfinite(income_float) or income_float < 0:
                flash('Income cannot be negative.', 'error')
                return render_template('tax.html', income=income, status=status, **_ctx())

            tax_amount = fetch_tax(income_float, status)
            flash('Tax calculated successfully.', 'success')
            result = {'income': income_float, 'status': display_status, 'tax': tax_amount}
            return render_template('tax.html', result=result, income=income, status=status, **_ctx())

        except ValueError:
            flash('Please enter a valid number for income.', 'error')
            return render_template('tax.html', income=income, status=status, **_ctx())
        except requests.exceptions.JSONDecodeError:
            flash('Invalid response from tax API.', 'error')
            return render_template('tax.html', income=income, status=status, **_ctx())
        except requests.exceptions.RequestException:
            flash('Problem connecting to tax API.', 'error')
            return render_template('tax.html', income=income, status=status, **_ctx())
        except Exception:
            flash('Please enter valid input.', 'error')
            return render_template('tax.html', income=income, status=status, **_ctx())

    return render_template('tax.html', **_ctx())


@app.route('/auth/register', methods=['POST'])
@_rl("5 per minute", "20 per hour")
def register():
    data = request.get_json()
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400
    if len(username) < 3:
        return jsonify({"error": "Username must be at least 3 characters"}), 400
    if not re.match(r'^[a-zA-Z0-9_.\-]+$', username):
        return jsonify({"error": "Username may only contain letters, numbers, _, . or -"}), 400
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400
    if len(password) > 128:
        return jsonify({"error": "Password must be at most 128 characters"}), 400
    if not re.search(r'[A-Z]', password):
        return jsonify({"error": "Password must contain at least one uppercase letter"}), 400
    if not re.search(r'[0-9]', password):
        return jsonify({"error": "Password must contain at least one number"}), 400
    conn = get_db()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO users (username, password_hash) VALUES (%s, %s) RETURNING id",
                    (username, generate_password_hash(password))
                )
                user_id = cur.fetchone()[0]
                cur.execute("INSERT INTO user_data (user_id) VALUES (%s)", (user_id,))
        session.clear()  # drop any pre-auth session state (fixation hardening)
        session.permanent = True
        session['user_id'] = user_id
        session['username'] = username
        session['theme'] = 'light'
        session['personality'] = 'balanced'
        session['analytics_currency'] = 'USD'
        return jsonify({"ok": True, "username": username, "csrf_token": _new_csrf()})
    except psycopg2.errors.UniqueViolation:
        return jsonify({"error": "Username already taken"}), 409
    finally:
        release_db(conn)

@app.route('/auth/login', methods=['POST'])
@_rl("10 per minute", "50 per hour")
def auth_login():
    data = request.get_json()
    username = (data.get('username') or '').strip()
    password = data.get('password') or ''
    conn = get_db()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id, password_hash, theme, personality, analytics_currency, themes_custom FROM users WHERE username=%s", (username,))
                row = cur.fetchone()
        if not row:
            check_password_hash(_DUMMY_PWHASH, password)  # equalize timing
            return jsonify({"error": "Invalid username or password"}), 401
        if not row[1]:
            # Google-only account: there's no password to check. Calling
            # check_password_hash(None, ...) would raise (AttributeError, not the
            # ValueError it guards against) and surface as a generic client-side
            # "Network error" — name the real reason instead.
            return jsonify({"error": "This account signs in with Google - there's no password set. Use \"Continue with Google\" below."}), 401
        if not check_password_hash(row[1], password):
            return jsonify({"error": "Invalid username or password"}), 401
        session.clear()  # drop any pre-auth session state (fixation hardening)
        session.permanent = True
        session['user_id'] = row[0]
        session['username'] = username
        session['theme'] = row[2] or 'light'
        session['theme_dark'] = _theme_is_dark(row[2] or 'light', row[5] if isinstance(row[5], dict) else None)
        session['personality'] = row[3] or 'balanced'
        session['analytics_currency'] = row[4] or 'USD'
        return jsonify({"ok": True, "username": username, "csrf_token": _new_csrf()})
    finally:
        release_db(conn)

@app.route('/auth/logout', methods=['POST'])
@csrf_required
def auth_logout():
    # session.clear() is sufficient for Flask's signed-cookie sessions.
    # If migrating to server-side sessions, add explicit token invalidation here.
    session.clear()
    return jsonify({"ok": True})

@app.route('/auth/me')
def auth_me():
    if 'user_id' not in session:
        return jsonify({"user": None}), 200
    # Verify the user still exists — handles the case where an account was deleted
    # but the signed cookie is still valid in the browser.
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE id=%s", (session['user_id'],))
            row = cur.fetchone()
    finally:
        release_db(conn)
    if not row:
        session.clear()
        return jsonify({"user": None}), 401
    return jsonify({"username": session['username'], "id": session['user_id']})


# ── Google Sign-In (OIDC) routes ─────────────────────────────────────────────
# All Google auth funnels through one callback; the in-flight intent is held in
# session['google_flow'] ('login' = sign-in/register, 'link' = connect/change).
# state, nonce, PKCE and id_token signature/claim validation are all performed
# inside Authlib's authorize_redirect / authorize_access_token — not hand-rolled.
# A Google change/disconnect requires a fresh password step-up (see google_stepup);
# password-less (Google-only) users must Set a password first to manage the link.
_STEPUP_TTL = 600  # seconds a password step-up authorizes a Google change/disconnect

def _establish_session(user_id, username, theme=None, personality=None, analytics_currency=None):
    """Fixation-hardened login (mirrors register/login): fresh session + CSRF."""
    session.clear()
    session.permanent = True
    session['user_id'] = user_id
    session['username'] = username
    session['theme'] = theme or 'light'
    # Resolve dark-base once at session start (one small read only for a custom theme).
    session['theme_dark'] = _theme_is_dark(theme or 'light', _current_themes_env()
                                           if isinstance(theme, str) and theme.startswith('custom:') else None)
    session['personality'] = personality or 'balanced'
    session['analytics_currency'] = analytics_currency or 'USD'
    _new_csrf()

def _stepup_fresh():
    return (time.time() - session.get('change_authorized_at', 0)) <= _STEPUP_TTL

def _delete_authorized_fresh():
    return (time.time() - session.get('delete_authorized_at', 0)) <= _STEPUP_TTL

def _google_redirect_uri():
    # Force https in prod so the redirect_uri matches the Google-registered URI even
    # behind Render's TLS-terminating proxy (no ProxyFix needed for just this).
    return url_for('google_callback', _external=True,
                   _scheme=('http' if app.debug else 'https'))

@app.route('/auth/google/login')
@_rl("20 per minute", "200 per hour")
def google_login():
    if not _google_enabled:
        return redirect(url_for('login_page'))
    session['google_flow'] = 'login'
    return oauth.google.authorize_redirect(_google_redirect_uri())

@app.route('/auth/google/link')
@_rl("20 per minute", "200 per hour")
def google_link():
    # GET (browser nav), so redirect rather than JSON on the not-logged-in path.
    if 'user_id' not in session:
        return redirect(url_for('login_page'))
    if not _google_enabled:
        return redirect(url_for('account'))
    # Connecting or changing the Google binding is sensitive — require a fresh password
    # step-up first. Password-less users can't step up, so they must Set a password before
    # managing Google (keeps every change password-confirmed; no second OAuth round-trip).
    if not _stepup_fresh():
        return redirect(url_for('account', google='stepup'))
    session['google_flow'] = 'link'
    return oauth.google.authorize_redirect(_google_redirect_uri())

@app.route('/auth/google/confirm_delete')
@_rl("10 per minute", "50 per hour")
def google_confirm_delete():
    # Password-less accounts have no password to confirm a delete with; re-proving
    # control of the same Google identity that's on file is the equivalent step-up.
    if 'user_id' not in session:
        return redirect(url_for('login_page'))
    if not _google_enabled:
        return redirect(url_for('account'))
    session['google_flow'] = 'delete_confirm'
    return oauth.google.authorize_redirect(_google_redirect_uri())

@app.route('/auth/google/callback')
@_rl("20 per minute", "200 per hour")
def google_callback():
    flow = session.pop('google_flow', None)
    if not _google_enabled or not flow:
        return redirect(url_for('login_page'))
    try:
        token = oauth.google.authorize_access_token()  # validates state+PKCE+id_token(nonce)
    except Exception:
        app.logger.exception("Google OAuth callback failed")
        return redirect(url_for('login_page', google='error'))
    info = token.get('userinfo') or {}
    sub = info.get('sub')
    email = (info.get('email') or '').strip().lower()
    if not sub or not email or not info.get('email_verified'):
        return redirect(url_for('login_page', google='unverified'))
    if flow == 'link':
        return _google_apply_link(sub, email)
    if flow == 'delete_confirm':
        return _google_apply_delete_confirm(sub)
    return _google_apply_login(sub, email)

def _google_apply_login(sub, email):
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, username, theme, personality, analytics_currency FROM users WHERE google_sub=%s", (sub,))
            row = cur.fetchone()
        if row:  # returning Google user → straight in
            _establish_session(row[0], row[1], row[2], row[3], row[4])
            return redirect(url_for('home'))
        # New Google identity. If the email already belongs to an account, that account
        # must use "Connect Google" from settings — don't silently fork a second account.
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM users WHERE email=%s", (email,))
            taken = cur.fetchone()
        if taken:
            return redirect(url_for('login_page', google='email_taken'))
        session['pending_google_sub'] = sub
        session['pending_google_email'] = email
        return redirect(url_for('login_page', finish='google'))
    finally:
        release_db(conn)

def _google_apply_link(sub, email):
    if not _stepup_fresh():  # re-check at the authoritative mutation point
        return redirect(url_for('account', google='stepup'))
    user_id = session['user_id']
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE google_sub=%s AND id<>%s", (sub, user_id))
            if cur.fetchone():
                return redirect(url_for('account', google='in_use'))
            cur.execute("SELECT id FROM users WHERE email=%s AND id<>%s", (email, user_id))
            if cur.fetchone():
                return redirect(url_for('account', google='email_in_use'))
        try:
            with conn:
                with conn.cursor() as cur:
                    cur.execute("UPDATE users SET google_sub=%s, email=%s WHERE id=%s", (sub, email, user_id))
        except psycopg2.errors.UniqueViolation:
            # Pre-check above passed, but a concurrent request claimed the same
            # google_sub/email between the SELECT and this UPDATE - surface it as
            # the same "in use" outcome instead of a raw 500.
            return redirect(url_for('account', google='in_use'))
        session.pop('change_authorized_at', None)  # one-time use
        return redirect(url_for('account', google='linked'))
    finally:
        release_db(conn)

def _google_apply_delete_confirm(sub):
    if 'user_id' not in session:
        return redirect(url_for('login_page'))
    user_id = session['user_id']
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT google_sub FROM users WHERE id=%s", (user_id,))
            row = cur.fetchone()
        if not row or row[0] != sub:
            return redirect(url_for('account', google='delete_mismatch'))
        session['delete_authorized_at'] = time.time()
        return redirect(url_for('account', google='delete_confirmed'))
    finally:
        release_db(conn)

@app.route('/auth/google/complete', methods=['POST'])
@csrf_required
@_rl("10 per minute", "50 per hour")
def google_complete():
    """New Google user picks a username; creates the account (password_hash NULL)."""
    sub = session.get('pending_google_sub')
    email = session.get('pending_google_email')
    if not sub or not email:
        return jsonify({"error": "No pending Google sign-up. Please start again."}), 400
    data = request.get_json(silent=True) or {}
    username = (data.get('username') or '').strip()
    if not username:
        return jsonify({"error": "Username is required"}), 400
    if len(username) < 3:
        return jsonify({"error": "Username must be at least 3 characters"}), 400
    if not re.match(r'^[a-zA-Z0-9_.\-]+$', username):
        return jsonify({"error": "Username may only contain letters, numbers, _, . or -"}), 400
    conn = get_db()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO users (username, google_sub, email) VALUES (%s, %s, %s) RETURNING id",
                    (username, sub, email))
                user_id = cur.fetchone()[0]
                cur.execute("INSERT INTO user_data (user_id) VALUES (%s)", (user_id,))
        session.pop('pending_google_sub', None)
        session.pop('pending_google_email', None)
        _establish_session(user_id, username)
        return jsonify({"ok": True, "username": username, "csrf_token": session['csrf_token']})
    except psycopg2.errors.UniqueViolation:
        return jsonify({"error": "Username already taken"}), 409
    finally:
        release_db(conn)

@app.route('/auth/google/native', methods=['POST'])
@_rl("20 per minute", "200 per hour")
def google_native():
    """Native (Capacitor) sign-in: JSON mirror of _google_apply_login. The posted
    id_token is the credential (a CSRF token can't be forged into a valid one), so this
    entry point is rate-limited but not @csrf_required, like GET /auth/google/login."""
    if not _google_enabled:
        return jsonify({"error": "Google sign-in is not available."}), 400
    data = request.get_json(silent=True) or {}
    raw = data.get('id_token') or ''
    if not raw:
        return jsonify({"error": "Missing id_token"}), 400
    try:
        sub, email = _google_verify_id_token(raw)
    except Exception:
        app.logger.exception("Native Google id_token verification failed")
        return jsonify({"error": "Could not verify Google sign-in."}), 401
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, username, theme, personality, analytics_currency FROM users WHERE google_sub=%s", (sub,))
            row = cur.fetchone()
        if row:  # returning Google user → straight in
            _establish_session(row[0], row[1], row[2], row[3], row[4])
            return jsonify({"ok": True, "username": row[1], "csrf_token": session['csrf_token']})
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM users WHERE email=%s", (email,))
            taken = cur.fetchone()
        if taken:  # existing password account owns this email → must Connect from settings
            return jsonify({"error": "email_taken"}), 409
        # New identity: stash it and let the webview open the existing username-completion UI.
        session['pending_google_sub'] = sub
        session['pending_google_email'] = email
        return jsonify({"finish": "google"})
    finally:
        release_db(conn)

@app.route('/auth/google/native_link', methods=['POST'])
@login_required
@csrf_required
@_rl("20 per minute", "200 per hour")
def google_native_link():
    """Native account-page "Connect/Change Google": JSON mirror of _google_apply_link,
    behind the same fresh password step-up. Error strings match account.html's notice map."""
    if not _google_enabled:
        return jsonify({"error": "error"}), 400
    if not _stepup_fresh():
        return jsonify({"error": "stepup"}), 403
    data = request.get_json(silent=True) or {}
    raw = data.get('id_token') or ''
    if not raw:
        return jsonify({"error": "error"}), 400
    try:
        sub, email = _google_verify_id_token(raw)
    except Exception:
        app.logger.exception("Native Google link id_token verification failed")
        return jsonify({"error": "error"}), 401
    user_id = session['user_id']
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE google_sub=%s AND id<>%s", (sub, user_id))
            if cur.fetchone():
                return jsonify({"error": "in_use"}), 409
            cur.execute("SELECT id FROM users WHERE email=%s AND id<>%s", (email, user_id))
            if cur.fetchone():
                return jsonify({"error": "email_in_use"}), 409
        try:
            with conn:
                with conn.cursor() as cur:
                    cur.execute("UPDATE users SET google_sub=%s, email=%s WHERE id=%s", (sub, email, user_id))
        except psycopg2.errors.UniqueViolation:
            # Pre-check above passed, but a concurrent request claimed the same
            # google_sub/email between the SELECT and this UPDATE.
            return jsonify({"error": "in_use"}), 409
        session.pop('change_authorized_at', None)  # one-time use
        return jsonify({"ok": True})
    finally:
        release_db(conn)

@app.route('/auth/google/stepup', methods=['POST'])
@login_required
@csrf_required
@_rl("10 per minute", "50 per hour")
def google_stepup():
    """Re-confirm current identity (password) before a Google change/disconnect."""
    data = request.get_json(silent=True) or {}
    password = data.get('password') or ''
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT password_hash FROM users WHERE id=%s", (session['user_id'],))
            row = cur.fetchone()
    finally:
        release_db(conn)
    if not row or not row[0]:
        return jsonify({"error": "Set a password first to manage your Google connection"}), 400
    if not check_password_hash(row[0], password):
        return jsonify({"error": "Incorrect password"}), 403
    session['change_authorized_at'] = time.time()
    return jsonify({"ok": True})

@app.route('/auth/google/disconnect', methods=['POST'])
@login_required
@csrf_required
@_rl("5 per minute")
def google_disconnect():
    if not _stepup_fresh():
        return jsonify({"error": "Confirm your password first"}), 403
    user_id = session['user_id']
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT password_hash, google_sub FROM users WHERE id=%s", (user_id,))
            row = cur.fetchone()
        if not row or not row[1]:
            return jsonify({"error": "No Google account connected"}), 400
        if not row[0]:  # no password → disconnecting would lock them out
            return jsonify({"error": "Set a password before disconnecting Google"}), 400
        with conn:
            with conn.cursor() as cur:
                cur.execute("UPDATE users SET google_sub=NULL, email=NULL WHERE id=%s", (user_id,))
        session.pop('change_authorized_at', None)
        return jsonify({"ok": True})
    finally:
        release_db(conn)


@app.route('/auth/delete_account', methods=['POST'])
@login_required
@csrf_required
@_rl("3 per minute")
def delete_account():
    data = request.get_json(silent=True) or {}
    user_id = session['user_id']
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT password_hash FROM users WHERE id=%s", (user_id,))
            row = cur.fetchone()
        if not row:
            return jsonify({"error": "Account not found"}), 404
        if row[0]:  # has a password → confirm with it
            if not check_password_hash(row[0], data.get('password') or ''):
                return jsonify({"error": "Incorrect password"}), 403
        else:       # Google-only (no password) → must have just re-confirmed via Google
            if not _delete_authorized_fresh():
                return jsonify({"error": "Please confirm with Google first"}), 403
        with conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM data_revisions WHERE user_id=%s", (user_id,))
                cur.execute("DELETE FROM device_tokens WHERE user_id=%s", (user_id,))
                cur.execute("DELETE FROM push_sent WHERE user_id=%s", (user_id,))
                cur.execute("DELETE FROM user_data WHERE user_id=%s", (user_id,))
                cur.execute("DELETE FROM users WHERE id=%s", (user_id,))
        session.clear()
        return jsonify({"ok": True})
    finally:
        release_db(conn)

@app.route('/auth/change_username', methods=['POST'])
@login_required
@csrf_required
@_rl("5 per minute")
def change_username():
    data = request.get_json(silent=True) or {}
    new_username = (data.get('new_username') or '').strip()
    if not new_username:
        return jsonify({"error": "New username is required"}), 400
    if len(new_username) < 3:
        return jsonify({"error": "Username must be at least 3 characters"}), 400
    if not re.match(r'^[a-zA-Z0-9_.\-]+$', new_username):
        return jsonify({"error": "Username may only contain letters, numbers, _, . or -"}), 400
    user_id = session['user_id']
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT password_hash FROM users WHERE id=%s", (user_id,))
            row = cur.fetchone()
        if not row:
            return jsonify({"error": "Account not found"}), 404
        if row[0]:  # has a password → confirm with it
            if not check_password_hash(row[0], data.get('password') or ''):
                return jsonify({"error": "Incorrect password"}), 403
        else:       # Google-only → confirm by typing the current username
            if (data.get('confirm_username') or '').strip() != session.get('username'):
                return jsonify({"error": "Type your current username to confirm"}), 403
        with conn:
            with conn.cursor() as cur:
                cur.execute("UPDATE users SET username=%s WHERE id=%s", (new_username, user_id))
        session['username'] = new_username
        return jsonify({"ok": True, "username": new_username})
    except psycopg2.errors.UniqueViolation:
        return jsonify({"error": "Username already taken"}), 409
    finally:
        release_db(conn)

@app.route('/auth/change_password', methods=['POST'])
@login_required
@csrf_required
@_rl("5 per minute")
def change_password():
    data = request.get_json(silent=True) or {}
    new_password = data.get('new_password') or ''
    if not new_password:
        return jsonify({"error": "New password is required"}), 400
    if len(new_password) < 8:
        return jsonify({"error": "New password must be at least 8 characters"}), 400
    if len(new_password) > 128:
        return jsonify({"error": "New password must be at most 128 characters"}), 400
    if not re.search(r'[A-Z]', new_password):
        return jsonify({"error": "New password must contain at least one uppercase letter"}), 400
    if not re.search(r'[0-9]', new_password):
        return jsonify({"error": "New password must contain at least one number"}), 400
    user_id = session['user_id']
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT password_hash FROM users WHERE id=%s", (user_id,))
            row = cur.fetchone()
        if not row:
            return jsonify({"error": "Account not found"}), 404
        if row[0]:  # changing an existing password → verify the current one
            current_password = data.get('current_password') or ''
            if not current_password:
                return jsonify({"error": "Current password is required"}), 400
            if not check_password_hash(row[0], current_password):
                return jsonify({"error": "Incorrect current password"}), 403
        # else: first-time set for a Google-only user — no current password to verify
        with conn:
            with conn.cursor() as cur:
                cur.execute("UPDATE users SET password_hash=%s WHERE id=%s",
                    (generate_password_hash(new_password), user_id))
        return jsonify({"ok": True})
    finally:
        release_db(conn)


def _load_tracker_versioned(tracker):
    """Shared GET /api/load/<tracker> body: returns (data, version) for the current user."""
    data_col, ver_col = _TRACKER_COLUMNS[tracker]
    query = _sql.SQL("SELECT {data}, {ver} FROM user_data WHERE user_id=%s").format(
        data=_sql.Identifier(data_col), ver=_sql.Identifier(ver_col))
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(query, (session['user_id'],))
            row = cur.fetchone()
        data = row[0] if row and row[0] else None
        version = row[1] if row and row[1] is not None else 0
        return data, version
    finally:
        release_db(conn)


def _save_tracker_versioned(tracker, data, base_version, force=False):
    """
    Shared optimistic-concurrency POST /api/save/<tracker> body.

    Locks the user's row, then either:
      - base_version matches the stored version (or force=True): writes the
        new blob, bumps the version, records a data_revisions row, and prunes
        old revisions beyond _REVISION_KEEP; or
      - base_version is stale: returns 409 with the server's current data and
        version so the client can merge and retry.

    Returns (status_code, response_dict).
    """
    data_col, ver_col = _TRACKER_COLUMNS[tracker]
    select_q = _sql.SQL("SELECT {data}, {ver} FROM user_data WHERE user_id=%s FOR UPDATE").format(
        data=_sql.Identifier(data_col), ver=_sql.Identifier(ver_col))
    upsert_q = _sql.SQL("""
        INSERT INTO user_data (user_id, {data}, {ver}, updated_at)
        VALUES (%s, %s, %s, NOW())
        ON CONFLICT (user_id) DO UPDATE
        SET {data} = EXCLUDED.{data}, {ver} = EXCLUDED.{ver}, updated_at = NOW()
    """).format(data=_sql.Identifier(data_col), ver=_sql.Identifier(ver_col))

    conn = get_db()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(select_q, (session['user_id'],))
                row = cur.fetchone()
                current_data = row[0] if row else None
                current_version = row[1] if row and row[1] is not None else 0

                if not force and base_version != current_version:
                    return 409, {
                        "error": "conflict",
                        "server_data": current_data,
                        "server_version": current_version,
                    }

                new_version = current_version + 1
                cur.execute(upsert_q, (session['user_id'], json.dumps(data), new_version))
                cur.execute(
                    "INSERT INTO data_revisions (user_id, tracker, version, blob) VALUES (%s, %s, %s, %s)",
                    (session['user_id'], tracker, new_version, json.dumps(data))
                )
                cur.execute("""
                    DELETE FROM data_revisions WHERE user_id=%s AND tracker=%s AND id NOT IN (
                        SELECT id FROM data_revisions WHERE user_id=%s AND tracker=%s
                        ORDER BY version DESC LIMIT %s
                    )
                """, (session['user_id'], tracker, session['user_id'], tracker, _REVISION_KEEP))
        return 200, {"ok": True, "version": new_version}
    finally:
        release_db(conn)


def _parse_save_body(body):
    """Pulls (data, base_version, force) out of a {data, base_version, force} POST body."""
    data = body.get('data')
    base_version = body.get('base_version')
    if not isinstance(base_version, int):
        base_version = 0
    return data, base_version, bool(body.get('force'))


@app.route('/api/save/expenses', methods=['POST'])
@login_required
@csrf_required
@_rl("60 per minute")
def save_expenses():
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return jsonify({"error": "Invalid data format"}), 400
    data, base_version, force = _parse_save_body(body)
    if not isinstance(data, dict) or 'rows' not in data:
        return jsonify({"error": "Missing required field: rows"}), 400
    if not _within_limits(data):
        return jsonify({"error": "Row/column limit exceeded"}), 400
    status, resp = _save_tracker_versioned('expenses', data, base_version, force=force)
    return jsonify(resp), status

@app.route('/api/load/expenses')
@login_required
def load_expenses():
    data, version = _load_tracker_versioned('expenses')
    return jsonify({"ok": True, "data": data, "version": version})

@app.route('/api/save/subs', methods=['POST'])
@login_required
@csrf_required
@_rl("60 per minute")
def save_subs():
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return jsonify({"error": "Invalid data format"}), 400
    data, base_version, force = _parse_save_body(body)
    if not isinstance(data, dict) or 'rows' not in data:
        return jsonify({"error": "Missing required field: rows"}), 400
    if not isinstance(data.get('rows'), list) or len(data['rows']) > MAX_SUBS:
        return jsonify({"error": f"Subscription limit ({MAX_SUBS}) exceeded"}), 400
    cols = data.get('cols')
    if cols is not None and (not isinstance(cols, list) or len(cols) > MAX_COLS):
        return jsonify({"error": "Column limit exceeded"}), 400
    status, resp = _save_tracker_versioned('subs', data, base_version, force=force)
    return jsonify(resp), status

@app.route('/api/load/subs')
@login_required
def load_subs():
    data, version = _load_tracker_versioned('subs')
    return jsonify({"ok": True, "data": data, "version": version})

@app.route('/api/save/income', methods=['POST'])
@login_required
@csrf_required
@_rl("60 per minute")
def save_income():
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return jsonify({"error": "Invalid data format"}), 400
    data, base_version, force = _parse_save_body(body)
    if not isinstance(data, dict) or 'rows' not in data:
        return jsonify({"error": "Missing required field: rows"}), 400
    if not _within_limits(data):
        return jsonify({"error": "Row/column limit exceeded"}), 400
    status, resp = _save_tracker_versioned('income', data, base_version, force=force)
    return jsonify(resp), status

@app.route('/api/load/income')
@login_required
def load_income():
    data, version = _load_tracker_versioned('income')
    return jsonify({"ok": True, "data": data, "version": version})

@app.route('/api/revisions/<tracker>')
@login_required
def list_revisions(tracker):
    """List recent revisions for one of the user's trackers (metadata only, no blobs)."""
    if tracker not in _TRACKER_COLUMNS:
        return jsonify({"error": "Unknown tracker"}), 404
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT version, saved_at FROM data_revisions
                WHERE user_id=%s AND tracker=%s
                ORDER BY version DESC LIMIT %s
            """, (session['user_id'], tracker, _REVISION_KEEP))
            rows = cur.fetchall()
        revisions = [
            {"version": r[0], "saved_at": r[1].strftime('%Y-%m-%dT%H:%M:%SZ')}
            for r in rows
        ]
        return jsonify({"ok": True, "revisions": revisions})
    finally:
        release_db(conn)

@app.route('/api/revisions/<tracker>/restore', methods=['POST'])
@login_required
@csrf_required
@_rl("10 per minute")
def restore_revision(tracker):
    """Restore one of the user's trackers to a prior revision (force-saved as a new version)."""
    if tracker not in _TRACKER_COLUMNS:
        return jsonify({"error": "Unknown tracker"}), 404
    body = request.get_json(silent=True)
    if not isinstance(body, dict) or not isinstance(body.get('version'), int):
        return jsonify({"error": "Missing required field: version"}), 400
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT blob FROM data_revisions WHERE user_id=%s AND tracker=%s AND version=%s",
                (session['user_id'], tracker, body['version'])
            )
            row = cur.fetchone()
    finally:
        release_db(conn)
    if not row:
        return jsonify({"error": "Revision not found"}), 404
    status, resp = _save_tracker_versioned(tracker, row[0], base_version=0, force=True)
    return jsonify(resp), status


@app.route('/api/exchange')
@login_required
def api_exchange():
    base = (request.args.get('base') or request.args.get('from', 'USD')).upper()
    to_currency = request.args.get('to', '').upper()
    force = request.args.get('force', '0') == '1'
    if not _CCY_RE.match(base):
        return jsonify({"error": "Invalid base currency"}), 400
    if to_currency and not _CCY_RE.match(to_currency):
        return jsonify({"error": "Invalid target currency"}), 400
    try:
        rates, fetched_at = fetch(base, force=force)
        fetched_str = fetched_at.strftime('%Y-%m-%dT%H:%M:%SZ')
        if to_currency:
            rate = rates.get(to_currency)
            if rate is None:
                return jsonify({"error": f"Unknown currency: {to_currency}"}), 400
            return jsonify({"rate": rate, "from": base, "to": to_currency, "fetched_at": fetched_str})
        return jsonify({"rates": rates, "base": base, "from": base, "fetched_at": fetched_str})
    except requests.exceptions.RequestException:
        app.logger.exception("Exchange rate fetch failed (base=%s)", base)
        return jsonify({"error": "Exchange rate service unavailable"}), 502


def simple_interest(principal, rate, years):
    return round(principal * (rate / 100) * years, 2)

def compound_interest(principal, rate, years, periods):
    return round(principal * ((1 + (rate / 100) / periods) ** (years * periods)), 2)

def fetch_tax(income, status):
    # income is a validated finite float — :g renders 50000.0 as 50000
    key = (status, f"{income:g}")
    cached = _tax_cache.get(key)
    if cached and time.time() - cached[1] < TAX_TTL:
        return cached[0]

    url = f"https://api.taxapi.net/income/{status}/{income:g}"
    response = requests.get(url, timeout=8)
    response.raise_for_status()
    tax_amount = round(response.json(), 2)
    _tax_cache[key] = (tax_amount, time.time())
    return tax_amount

def fetch(currency_i: str, force: bool = False) -> tuple:
    """Return (rates_dict, fetched_at_utc). Three-tier: memory → DB → API.
    Note: _rates_cache is module-level and therefore per-Gunicorn worker.
    The '1-hour TTL in-memory' applies per-worker, not globally across all workers.
    The DB cache (7-day TTL) is the actual cross-worker dedup layer."""
    now = time.time()
    key = currency_i.upper()

    if not force and key in _rates_cache and now - _rates_ts.get(key, 0) < RATES_TTL:
        return _rates_cache[key], datetime.fromtimestamp(_rates_ts[key], tz=timezone.utc)

    if not force:
        try:
            conn = get_db()
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT rates, fetched_at FROM exchange_rates WHERE base=%s AND fetched_at > NOW() - INTERVAL '7 days'",
                        (key,)
                    )
                    row = cur.fetchone()
                if row:
                    rates, fetched_at = row
                    _rates_cache[key] = rates
                    _rates_ts[key] = fetched_at.timestamp()
                    return rates, fetched_at
            finally:
                release_db(conn)
        except Exception:
            # Degrade to the live API below — a DB hiccup here shouldn't fail the
            # request, but it should be visible in logs rather than silently identical
            # to a normal cache miss.
            app.logger.exception("Exchange rate DB cache read failed (base=%s)", key)

    url = f"https://v6.exchangerate-api.com/v6/{EXCHANGE_API_KEY}/latest/{key}"
    response = requests.get(url, timeout=8)
    response.raise_for_status()
    data = response.json()
    rates = data["conversion_rates"]
    fetched_at = datetime.now(tz=timezone.utc)

    _rates_cache[key] = rates
    _rates_ts[key] = fetched_at.timestamp()

    try:
        conn = get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO exchange_rates (base, rates, fetched_at)
                       VALUES (%s, %s, %s)
                       ON CONFLICT (base) DO UPDATE SET rates=EXCLUDED.rates, fetched_at=EXCLUDED.fetched_at""",
                    (key, psycopg2.extras.Json(rates), fetched_at)
                )
            conn.commit()
        finally:
            release_db(conn)
    except Exception:
        # The fresh rates are already cached in-memory above, so the request still
        # succeeds — but a failure to persist the cross-worker DB cache is worth knowing
        # about (it means every worker will re-hit the upstream API independently).
        app.logger.exception("Exchange rate DB cache write failed (base=%s)", key)

    return rates, fetched_at

@app.route('/api/prefs', methods=['GET'])
@login_required
@_rl("60 per minute")
def get_prefs():
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT theme, personality, analytics_currency, themes_custom, push_enabled FROM users WHERE id=%s",
                        (session['user_id'],))
            row = cur.fetchone()
    finally:
        release_db(conn)
    if not row:
        return jsonify({"error": "not found"}), 404
    theme, personality, analytics_currency, themes_custom, push_enabled = row
    if not isinstance(themes_custom, dict):
        themes_custom = {'v': 1, 'themes': themes_custom if isinstance(themes_custom, list) else []}
    return jsonify({
        "theme": theme, "personality": personality, "analytics_currency": analytics_currency,
        "themes_custom": themes_custom, "theme_dark": _theme_is_dark(theme, themes_custom),
        "push_enabled": bool(push_enabled),
    })


@app.route('/api/prefs', methods=['PATCH'])
@login_required
@csrf_required
@_rl("30 per minute")
def save_prefs():
    data = request.get_json(silent=True) or {}
    set_clauses, params = [], []
    theme_env = None      # parsed themes_custom, if provided this request

    if 'themes_custom' in data:
        try:
            theme_env = _validate_custom_themes(data.get('themes_custom'))
        except ValueError as e:
            return jsonify({"error": "Invalid themes: " + str(e)}), 400
        set_clauses.append("themes_custom=%s"); params.append(json.dumps(theme_env))

    if 'theme' in data:
        theme = (data.get('theme') or '').strip()
        ok = theme in ('light', 'dark')
        if not ok and theme.startswith('custom:'):
            # The referenced id must exist in the list being saved this request, or the
            # list already stored server-side.
            tid = theme.split(':', 1)[1]
            ids = None
            if theme_env is not None:
                ids = {t['id'] for t in theme_env['themes']}
            else:
                conn0 = get_db()
                try:
                    with conn0.cursor() as cur0:
                        cur0.execute("SELECT themes_custom FROM users WHERE id=%s", (session['user_id'],))
                        r0 = cur0.fetchone()
                    stored = (r0[0] if r0 else None) or {}
                    if isinstance(stored, list):
                        stored = {'themes': stored}
                    ids = {t.get('id') for t in stored.get('themes', [])}
                finally:
                    release_db(conn0)
            ok = tid in (ids or set())
        if not ok:
            return jsonify({"error": "Invalid theme"}), 400
        set_clauses.append("theme=%s"); params.append(theme)

    if 'personality' in data:
        personality = (data.get('personality') or '').strip()
        if personality not in {'playful', 'balanced', 'quiet'}:
            return jsonify({"error": "Invalid personality"}), 400
        set_clauses.append("personality=%s"); params.append(personality)

    if 'analytics_currency' in data:
        analytics_currency = (data.get('analytics_currency') or '').strip().upper()
        if not _CCY_RE.match(analytics_currency):
            return jsonify({"error": "Invalid currency"}), 400
        set_clauses.append("analytics_currency=%s"); params.append(analytics_currency)

    if not set_clauses:
        return jsonify({"error": "No valid fields to update"}), 400

    conn = get_db()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(f"UPDATE users SET {', '.join(set_clauses)} WHERE id=%s", (*params, session['user_id']))
        if 'theme' in data:
            session['theme'] = theme
            # theme_dark drives the pre-paint base luminance on the next render.
            session['theme_dark'] = _theme_is_dark(theme, theme_env if theme_env is not None else _current_themes_env())
        if 'personality' in data: session['personality'] = personality
        if 'analytics_currency' in data: session['analytics_currency'] = analytics_currency
        return jsonify({"ok": True})
    finally:
        release_db(conn)


def _current_themes_env():
    """Fetch the stored themes_custom envelope for the logged-in user (for theme_dark)."""
    conn = get_db()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT themes_custom FROM users WHERE id=%s", (session['user_id'],))
            r = cur.fetchone()
        env = (r[0] if r else None) or {}
        return env if isinstance(env, dict) else {'themes': env if isinstance(env, list) else []}
    finally:
        release_db(conn)

# ── Phase 5: subscription-renewal push reminders ────────────────────────────
# Two-stage reminders (a heads-up ~7 days out, a final nudge the day before) fire
# from a daily scan; push_sent dedups so each stage sends once per renewal. The
# date math is a faithful port of upcomingRenewals() in subscriptions.js, so the
# push and the in-app 7-day renewal alert always agree.
_PUSH_EARLY_DAYS = 7
_PUSH_FINAL_DAYS = 1
_PUSH_HORIZON_DAYS = 7
_BILLING_INTERVAL_DAYS = {
    'Yearly': 365.25, 'Quarterly': 91.3125, 'Weekly': 7.0, 'Bi-Weekly': 14.0,
    # 'Monthly' is same-day-of-month (handled below). 'Semi-Annual' is intentionally
    # not handled here, matching upcomingRenewals() so both reminders stay in sync.
}
_PUSH_TOKEN_RE = re.compile(r'^[A-Za-z0-9_:.\-]{20,4096}$')


def _js_ymd(year, month, day):
    """A date for (year, 1-based month, day) reproducing JS new Date() overflow:
    day past the month's end rolls into the next month (setDate/setMonth semantics)."""
    year += (month - 1) // 12
    month = (month - 1) % 12 + 1
    return (datetime(year, month, 1) + timedelta(days=day - 1)).date()


def _sub_next_renewal(start, billing, today):
    """Next renewal date, matching upcomingRenewals(): Monthly = same day-of-month
    this month or next; interval billings = start advanced by whole intervals until
    after today. Returns a date, or None for billings with no fixed interval."""
    if billing == 'Monthly':
        d = _js_ymd(today.year, today.month, start.day)
        if d < today:
            d = _js_ymd(today.year, today.month + 1, start.day)
        return d
    days = _BILLING_INTERVAL_DAYS.get(billing)
    if not days:
        return None
    # Mirror the JS millisecond loop (fractional intervals drift by hours) with a
    # datetime, then take the calendar day, to stay faithful to the in-app alert.
    nxt = datetime(start.year, start.month, start.day)
    today_dt = datetime(today.year, today.month, today.day)
    while nxt <= today_dt:
        nxt += timedelta(days=days)
    return nxt.date()


def _due_reminders(subs_blob, today):
    """Pure scanner: given a subscriptions state blob and today's date, return the
    reminders due now as dicts {row_id, name, billing, renewal, days_until, stage}.
    No DB and no dedup - the caller handles those."""
    out = []
    if not isinstance(subs_blob, dict):
        return out
    cols = subs_blob.get('cols') or []
    rows = subs_blob.get('rows') or []
    cells = subs_blob.get('cells') or {}
    if not (isinstance(cols, list) and isinstance(rows, list) and isinstance(cells, dict)):
        return out

    def col_by(ctype):
        for c in cols:
            if isinstance(c, dict) and c.get('ctype') == ctype:
                return c
        return None

    start_col, billing_col = col_by('date'), col_by('billing')
    status_col, name_col = col_by('status'), col_by('text')
    if not start_col or not billing_col:
        return out

    def cell(row, col):
        if not col:
            return ''
        return cells.get(str(row.get('id')) + '|' + str(col.get('id')), '') or ''

    for row in rows:
        if not isinstance(row, dict):
            continue
        if (cell(row, status_col) or 'Active') == 'Cancelled':
            continue
        start_str = cell(row, start_col)
        if not start_str:
            continue
        try:
            start = datetime.strptime(str(start_str)[:10], '%Y-%m-%d').date()
        except (ValueError, TypeError):
            continue
        billing = cell(row, billing_col) or 'Monthly'
        if start > today + timedelta(days=_PUSH_HORIZON_DAYS):
            continue  # hasn't started yet (matches the start>horizon guard)
        nxt = _sub_next_renewal(start, billing, today)
        if not nxt:
            continue
        days_until = (nxt - today).days
        if days_until < 0 or days_until > _PUSH_HORIZON_DAYS:
            continue
        out.append({
            'row_id': str(row.get('id')),
            'name': (cell(row, name_col) or 'A subscription').strip() or 'A subscription',
            'billing': billing,
            'renewal': nxt,
            'days_until': days_until,
            'stage': 'final' if days_until <= _PUSH_FINAL_DAYS else 'early',
        })
    return out


# FCM sender - optional dependency, so the whole scan pipeline is testable without
# Firebase credentials (owner-provisioned in Phase 5). Absent creds -> log + no-op.
try:
    import firebase_admin as _firebase_admin
    from firebase_admin import credentials as _fb_credentials, messaging as _fb_messaging
    _FIREBASE_AVAILABLE = True
except Exception:
    _FIREBASE_AVAILABLE = False
_FIREBASE_APP = None


def _init_firebase():
    global _FIREBASE_APP
    if _FIREBASE_APP is not None or not _FIREBASE_AVAILABLE:
        return _FIREBASE_APP
    cred_json = os.environ.get('FIREBASE_CREDENTIALS')
    if not cred_json:
        return None
    try:
        cred = _fb_credentials.Certificate(json.loads(cred_json))
        _FIREBASE_APP = _firebase_admin.initialize_app(cred)
    except Exception:
        _FIREBASE_APP = None
    return _FIREBASE_APP


def _prune_token(token):
    conn = get_db()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM device_tokens WHERE token=%s", (token,))
    finally:
        release_db(conn)


def _send_push(tokens, title, body, data=None):
    """Send a notification to device tokens; returns the count sent. Stubbed (logs
    and returns the token count) when Firebase isn't configured, so the scan is fully
    exercisable without FCM. Dead tokens are pruned so we stop retrying them."""
    if not tokens:
        return 0
    fb = _init_firebase()
    if not fb:
        # Counts only - title/body carry the user's own subscription name, which has no
        # reason to sit in server logs just because FCM isn't configured yet.
        app.logger.info("[push stub] would send to %d device(s)", len(tokens))
        return len(tokens)
    sent = 0
    for tok in tokens:
        try:
            _fb_messaging.send(_fb_messaging.Message(
                token=tok,
                notification=_fb_messaging.Notification(title=title, body=body),
                data={k: str(v) for k, v in (data or {}).items()},
            ))
            sent += 1
        except Exception:
            try:
                _prune_token(tok)
            except Exception:
                pass
    return sent


@app.route('/api/push/register', methods=['POST'])
@login_required
@csrf_required
@_rl("20 per minute", "200 per hour")
def push_register():
    data = request.get_json(silent=True) or {}
    token = (data.get('token') or '').strip()
    platform = (data.get('platform') or '').strip()[:20]
    if not _PUSH_TOKEN_RE.match(token):
        return jsonify(ok=False, error='invalid_token'), 400
    uid = session['user_id']
    conn = get_db()
    try:
        with conn:
            with conn.cursor() as cur:
                # A token is device-unique. Re-registering as the SAME user (e.g. a refreshed
                # FCM token, or re-enabling the toggle) re-homes it harmlessly. Re-registering
                # as a DIFFERENT user is refused rather than silently reassigning the row -
                # without this, anyone who obtained another user's token (leaked, not secret
                # in the UI, but not something this app exposes either) could redirect that
                # victim's reminders to themselves and go silent on their own. Legitimate
                # device handoff (a different person logs into FiApp on the same physical
                # device) still works: unregistering first (toggle off, or logout - see
                # push_unregister) frees the token for the next user to claim.
                cur.execute("SELECT user_id FROM device_tokens WHERE token=%s", (token,))
                existing = cur.fetchone()
                if existing and existing[0] != uid:
                    return jsonify(ok=False, error='token_bound_to_another_user'), 409
                cur.execute(
                    "INSERT INTO device_tokens (user_id, token, platform) VALUES (%s,%s,%s) "
                    "ON CONFLICT (token) DO UPDATE SET user_id=EXCLUDED.user_id, platform=EXCLUDED.platform",
                    (uid, token, platform or None))
                cur.execute("UPDATE users SET push_enabled=TRUE WHERE id=%s", (uid,))
    finally:
        release_db(conn)
    return jsonify(ok=True)


@app.route('/api/push/unregister', methods=['POST'])
@login_required
@csrf_required
@_rl("20 per minute", "200 per hour")
def push_unregister():
    data = request.get_json(silent=True) or {}
    token = (data.get('token') or '').strip()
    uid = session['user_id']
    conn = get_db()
    try:
        with conn:
            with conn.cursor() as cur:
                if token:
                    cur.execute("DELETE FROM device_tokens WHERE user_id=%s AND token=%s", (uid, token))
                else:
                    cur.execute("DELETE FROM device_tokens WHERE user_id=%s", (uid,))
                # Only clear the per-user gate once no devices remain registered.
                cur.execute("SELECT 1 FROM device_tokens WHERE user_id=%s LIMIT 1", (uid,))
                if not cur.fetchone():
                    cur.execute("UPDATE users SET push_enabled=FALSE WHERE id=%s", (uid,))
    finally:
        release_db(conn)
    return jsonify(ok=True)


@app.route('/internal/run-renewal-scan', methods=['POST'])
@_rl("10 per minute")
def run_renewal_scan():
    """Daily renewal scan, driven by a Render Cron Job. Guarded by a shared secret
    (PUSH_SCAN_SECRET) rather than a user session - it is a server-to-server trigger."""
    secret = os.environ.get('PUSH_SCAN_SECRET')
    provided = request.headers.get('X-Scan-Secret', '')
    if not secret or not hmac.compare_digest(secret, provided):
        return jsonify(ok=False, error='forbidden'), 403
    today = datetime.now(timezone.utc).date()
    users_scanned = reminders_sent = 0
    conn = get_db()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT u.id, ud.subs_data
                    FROM users u JOIN user_data ud ON ud.user_id = u.id
                    WHERE u.push_enabled = TRUE AND ud.subs_data IS NOT NULL
                      AND EXISTS (SELECT 1 FROM device_tokens dt WHERE dt.user_id = u.id)
                """)
                for uid, subs_blob in cur.fetchall():
                    users_scanned += 1
                    fresh = []
                    for r in _due_reminders(subs_blob, today):
                        key = "%s|%s|%s|%s" % (uid, r['row_id'], r['renewal'].isoformat(), r['stage'])
                        cur.execute(
                            "INSERT INTO push_sent (user_id, dedup_key) VALUES (%s,%s) "
                            "ON CONFLICT (dedup_key) DO NOTHING RETURNING id", (uid, key))
                        if cur.fetchone():
                            fresh.append(r)
                    if not fresh:
                        continue
                    cur.execute("SELECT token FROM device_tokens WHERE user_id=%s", (uid,))
                    tokens = [t[0] for t in cur.fetchall()]
                    for r in fresh:
                        if r['days_until'] <= 0:
                            when = 'today'
                        elif r['days_until'] == 1:
                            when = 'tomorrow'
                        else:
                            when = 'in %d days' % r['days_until']
                        reminders_sent += _send_push(
                            tokens, 'Upcoming renewal', '%s renews %s.' % (r['name'], when),
                            {'route': '/subscriptions'})
    finally:
        release_db(conn)
    return jsonify(ok=True, users_scanned=users_scanned, reminders_sent=reminders_sent)


def convert(currency_i, currency_a, currency_o):
    rates, _ = fetch(currency_i)
    return currency_a * rates[currency_o]


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
