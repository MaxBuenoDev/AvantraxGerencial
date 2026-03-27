
        import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

        const qs = new URLSearchParams(window.location.search);
        const TV_MODE = qs.has('tv');
        const STANDALONE_MODE = qs.has('standalone');

        if (!TV_MODE && !STANDALONE_MODE) {
            window.location.replace('tv.html');
        }

        const TopInfoVisibility = {
            storageKey: 'AVANTRAX_TOP_INFO_HIDDEN',
            hidden: false,

            init() {
                this.hidden = this.readPersisted();
                this.apply(this.hidden, { persist: false });
                window.addEventListener('storage', (e) => {
                    if (e.key !== this.storageKey) return;
                    this.apply(e.newValue === '1', { persist: false });
                });
            },

            readPersisted() {
                try { return localStorage.getItem(this.storageKey) === '1'; } catch (_) { return false; }
            },

            apply(hidden, { persist = true } = {}) {
                this.hidden = Boolean(hidden);
                document.body.classList.toggle('top-info-hidden', this.hidden);
                if (persist) {
                    try { localStorage.setItem(this.storageKey, this.hidden ? '1' : '0'); } catch (_) {}
                }
                return this.hidden;
            },

            toggle() {
                return this.apply(!this.hidden);
            },
        };

        const WeatherGadget = {
            _timer: 0,
            _inflight: null,
            refreshMs: 10 * 60 * 1000,

            getConfig() {
                const city = (localStorage.getItem('AVANTRAX_WEATHER_CITY') || 'Gravataí - RS').trim() || 'Gravataí - RS';
                const lat  = Number(localStorage.getItem('AVANTRAX_WEATHER_LAT') || -29.9443);
                const lon  = Number(localStorage.getItem('AVANTRAX_WEATHER_LON') || -50.9928);
                return { city, lat, lon };
            },

            codeInfo(code) {
                const c = Number(code);
                if (c === 0) return { t: 'Ensolarado', icon: 'sun' };
                if (c === 1) return { t: 'Predom. Sol', icon: 'sun-cloud' };
                if (c === 2) return { t: 'Parcial Nublado', icon: 'sun-cloud' };
                if (c === 3) return { t: 'Nublado', icon: 'cloud' };
                if (c === 45 || c === 48) return { t: 'Neblina', icon: 'fog' };
                if ([51,53,55,56,57].includes(c)) return { t: 'Garoa', icon: 'rain' };
                if ([61,63,65,66,67,80,81,82].includes(c)) return { t: 'Chuva', icon: 'rain' };
                if ([71,73,75,77,85,86].includes(c)) return { t: 'Neve', icon: 'snow' };
                if ([95,96,99].includes(c)) return { t: 'Tempestade', icon: 'storm' };
                return { t: 'Tempo', icon: 'cloud' };
            },

            iconSvg(kind, size = 64) {
                const stroke = 'rgba(234,247,255,.9)';
                const fillC  = 'rgba(0,191,255,.25)';
                const sunC   = 'rgba(255,192,74,.95)';
                const cloudC = 'rgba(234,247,255,.22)';
                const rainC  = 'rgba(0,191,255,.75)';
                const s = size;
                const common = `width="${s}" height="${s}" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"`;

                if (kind === 'sun') {
                    return `<svg ${common}>
                      <circle cx="32" cy="32" r="10" fill="${sunC}" opacity=".95"/>
                      <g stroke="${sunC}" stroke-width="3" stroke-linecap="round" opacity=".9">
                        <path d="M32 6v8"/><path d="M32 50v8"/><path d="M6 32h8"/><path d="M50 32h8"/>
                        <path d="M13 13l6 6"/><path d="M45 45l6 6"/><path d="M51 13l-6 6"/><path d="M19 45l-6 6"/>
                      </g>
                    </svg>`;
                }
                if (kind === 'sun-cloud') {
                    return `<svg ${common}>
                      <circle cx="24" cy="24" r="8" fill="${sunC}" opacity=".95"/>
                      <g stroke="${sunC}" stroke-width="2.5" stroke-linecap="round" opacity=".8">
                        <path d="M24 8v6"/><path d="M24 34v6"/><path d="M8 24h6"/><path d="M34 24h6"/>
                        <path d="M12 12l4 4"/><path d="M32 32l4 4"/><path d="M36 12l-4 4"/>
                      </g>
                      <path d="M20 44c-6.2 0-11.2-4.4-11.2-9.8 0-4.5 3.3-8.3 7.9-9.4 1.6-5.2 6.6-9 12.6-9 6.9 0 12.5 4.8 13.3 11.1 5.4.6 9.6 4.8 9.6 9.9 0 5.6-5 10.2-11.2 10.2H20z"
                        fill="${cloudC}" stroke="${stroke}" stroke-opacity=".45"/>
                    </svg>`;
                }
                if (kind === 'cloud') {
                    return `<svg ${common}>
                      <path d="M18 46c-7 0-12.7-5-12.7-11.2 0-5 3.6-9.2 8.6-10.4C15.7 18.7 21.3 14 28 14c7.8 0 14.1 5.4 15 12.5C49.1 27.2 54 32 54 37.7 54 43.9 48.3 49 41.3 49H18z"
                        fill="${cloudC}" stroke="${stroke}" stroke-opacity=".45"/>
                    </svg>`;
                }
                if (kind === 'fog') {
                    return `<svg ${common}>
                      <path d="M18 38c-6.4 0-11.6-4.6-11.6-10.3 0-4.6 3.3-8.5 8-9.6C16.2 13.4 21.6 10 28 10c7.5 0 13.6 5.2 14.4 12 5.2.6 9.2 4.6 9.2 9.5 0 5.7-5.2 10.4-11.6 10.4H18z"
                        fill="${cloudC}" stroke="${stroke}" stroke-opacity=".45"/>
                      <g stroke="${stroke}" stroke-opacity=".45" stroke-linecap="round" stroke-width="3">
                        <path d="M16 46h32"/><path d="M12 54h40"/>
                      </g>
                    </svg>`;
                }
                if (kind === 'rain') {
                    return `<svg ${common}>
                      <path d="M18 36c-6.4 0-11.6-4.6-11.6-10.3 0-4.6 3.3-8.5 8-9.6C16.2 11.4 21.6 8 28 8c7.5 0 13.6 5.2 14.4 12 5.2.6 9.2 4.6 9.2 9.5 0 5.7-5.2 10.4-11.6 10.4H18z"
                        fill="${cloudC}" stroke="${stroke}" stroke-opacity=".45"/>
                      <g stroke="${rainC}" stroke-linecap="round" stroke-width="3">
                        <path d="M22 42l-3 8"/><path d="M34 42l-3 8"/><path d="M46 42l-3 8"/>
                      </g>
                    </svg>`;
                }
                if (kind === 'storm') {
                    return `<svg ${common}>
                      <path d="M18 36c-6.4 0-11.6-4.6-11.6-10.3 0-4.6 3.3-8.5 8-9.6C16.2 11.4 21.6 8 28 8c7.5 0 13.6 5.2 14.4 12 5.2.6 9.2 4.6 9.2 9.5 0 5.7-5.2 10.4-11.6 10.4H18z"
                        fill="${cloudC}" stroke="${stroke}" stroke-opacity=".45"/>
                      <path d="M30 40l-6 10h6l-3 10 12-14h-7l6-6h-8z" fill="${sunC}" opacity=".95"/>
                      <g stroke="${rainC}" stroke-linecap="round" stroke-width="3" opacity=".85">
                        <path d="M44 42l-3 8"/>
                      </g>
                    </svg>`;
                }
                if (kind === 'snow') {
                    return `<svg ${common}>
                      <path d="M18 36c-6.4 0-11.6-4.6-11.6-10.3 0-4.6 3.3-8.5 8-9.6C16.2 11.4 21.6 8 28 8c7.5 0 13.6 5.2 14.4 12 5.2.6 9.2 4.6 9.2 9.5 0 5.7-5.2 10.4-11.6 10.4H18z"
                        fill="${cloudC}" stroke="${stroke}" stroke-opacity=".45"/>
                      <g stroke="${stroke}" stroke-opacity=".75" stroke-linecap="round" stroke-width="2.5">
                        <path d="M24 44v10"/><path d="M20 48h8"/><path d="M21.5 46.5l5 5"/><path d="M26.5 46.5l-5 5"/>
                        <path d="M40 44v10"/><path d="M36 48h8"/><path d="M37.5 46.5l5 5"/><path d="M42.5 46.5l-5 5"/>
                      </g>
                    </svg>`;
                }
                return `<svg ${common}><rect x="10" y="10" width="44" height="44" rx="12" fill="${fillC}" stroke="${stroke}" stroke-opacity=".35"/></svg>`;
            },

            async fetchWeather() {
                const { lat, lon } = this.getConfig();
                const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&current=temperature_2m,relative_humidity_2m,pressure_msl,wind_speed_10m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=7&timezone=America%2FSao_Paulo`;
                const res = await fetch(url, { cache: 'no-store' });
                if (!res.ok) throw new Error(`weather_http_${res.status}`);
                return await res.json();
            },

            render(data) {
                const cfg = this.getConfig();
                const cityEl = document.getElementById('wg-city');
                if (cityEl) cityEl.textContent = cfg.city;

                const cur = data?.current || {};
                const temp = typeof cur.temperature_2m === 'number' ? Math.round(cur.temperature_2m) : null;
                const hum  = typeof cur.relative_humidity_2m === 'number' ? Math.round(cur.relative_humidity_2m) : null;
                const pres = typeof cur.pressure_msl === 'number' ? Math.round(cur.pressure_msl) : null;
                const wind = typeof cur.wind_speed_10m === 'number' ? Math.round(cur.wind_speed_10m) : null;
                const info = this.codeInfo(cur.weather_code);

                const tempEl = document.getElementById('wg-temp');
                if (tempEl) tempEl.textContent = temp === null ? '--°' : `${temp}°C`;
                const descEl = document.getElementById('wg-desc');
                if (descEl) descEl.textContent = info.t;
                const iconEl = document.getElementById('wg-icon');
                if (iconEl) iconEl.innerHTML = this.iconSvg(info.icon, 64);

                const windEl = document.getElementById('wg-wind');
                if (windEl) windEl.textContent = wind === null ? '-- km/h' : `${wind} km/h`;
                const humEl = document.getElementById('wg-hum');
                if (humEl) humEl.textContent = hum === null ? '--%' : `${hum}%`;
                const presEl = document.getElementById('wg-pres');
                if (presEl) presEl.textContent = pres === null ? '---- hPa' : `${pres} hPa`;

                const weekEl = document.getElementById('wg-week');
                if (weekEl) {
                    const times = data?.daily?.time || [];
                    const codes = data?.daily?.weather_code || [];
                    const maxs  = data?.daily?.temperature_2m_max || [];
                    const mins  = data?.daily?.temperature_2m_min || [];

                    const fmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });
                    const items = times.slice(0, 7).map((t, i) => {
                        const d = new Date(`${t}T12:00:00`);
                        const dow = fmt.format(d).replace('.', '').toUpperCase();
                        const ci = this.codeInfo(codes[i]);
                        const mx = typeof maxs[i] === 'number' ? Math.round(maxs[i]) : null;
                        const mn = typeof mins[i] === 'number' ? Math.round(mins[i]) : null;
                        const range = (mx === null || mn === null) ? '--/--' : `${mx}°/${mn}°`;
                        return `
                            <div class="wg-day">
                                <div class="wg-dow">${dow}</div>
                                <div class="wg-dicon">${this.iconSvg(ci.icon, 26)}</div>
                                <div class="wg-dtemp">${range}</div>
                            </div>
                        `.trim();
                    });
                    weekEl.innerHTML = items.join('');
                }
            },

            renderError() {
                const descEl = document.getElementById('wg-desc');
                if (descEl) descEl.textContent = 'Sem dados';
                const iconEl = document.getElementById('wg-icon');
                if (iconEl) iconEl.innerHTML = this.iconSvg('cloud', 64);
                const weekEl = document.getElementById('wg-week');
                if (weekEl) weekEl.innerHTML = '';
            },

            async refresh() {
                if (this._inflight) return this._inflight;
                this._inflight = (async () => {
                    try {
                        const json = await this.fetchWeather();
                        this.render(json);
                    } catch (e) {
                        console.warn('[weather] falha ao carregar', e);
                        this.renderError();
                    } finally {
                        this._inflight = null;
                    }
                })();
                return this._inflight;
            },

            start() {
                if (this._timer) return;
                this.refresh();
                this._timer = window.setInterval(() => this.refresh(), this.refreshMs);
            },
        };

        const SupabaseStore = {
            bucket: 'avantrax-files',
            dashboardUpdatesTable: 'dashboard_updates',
            _client: null,

            getConfig() {
                const viteEnv = (typeof import.meta !== 'undefined' && import.meta && import.meta.env) ? import.meta.env : undefined;
                const url = (viteEnv && viteEnv.VITE_SUPABASE_URL) || window.SUPABASE_URL;
                const key = (viteEnv && viteEnv.VITE_SUPABASE_ANON_KEY) || window.SUPABASE_ANON_KEY;
                return { url, key };
            },

            isConfigured() {
                const { url, key } = this.getConfig();
                return Boolean(url && key);
            },

            getClient() {
                if (this._client) return this._client;
                const { url, key } = this.getConfig();
                if (!url || !key) return null;
                this._client = createClient(url, key);
                return this._client;
            },

            tableForType(type) {
                return type === 'embarcados' ? 'embarcados_uploads' : 'inventario_uploads';
            },

            safePathSegment(value) {
                return String(value || 'arquivo')
                    .replace(/[\\/]+/g, '-')
                    .replace(/[^\w.\- ]+/g, '')
                    .trim()
                    .replace(/\s+/g, '_')
                    .slice(0, 180);
            },

            makeStoragePath(type, fileName) {
                const safeName = this.safePathSegment(fileName || `${type}.xlsx`) || `${type}.xlsx`;
                const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '');
                const rand = Math.random().toString(36).slice(2, 8);
                return `${type}/${stamp}-${rand}-${safeName}`;
            },

            isPermissionError(err) {
                const code = String(err?.code || '').toLowerCase();
                const msg = String(err?.message || '').toLowerCase();
                const status = Number(err?.status || err?.statusCode || 0);
                return status === 401
                    || status === 403
                    || code === '42501'
                    || msg.includes('permission denied')
                    || msg.includes('row-level security')
                    || msg.includes('not authorized');
            },

            buildUploadError(type, err) {
                const status = Number(err?.status || err?.statusCode || 0);
                const code = err?.code ? ` code=${err.code}` : '';
                const statusPart = status ? ` status=${status}` : '';
                const base = `[upload:${type}] ${err?.message || 'falha desconhecida'}${code}${statusPart}`;
                if (this.isPermissionError(err)) {
                    return new Error(`${base}. Verifique politicas RLS do Supabase (storage.objects precisa SELECT+UPDATE para upsert, alem de INSERT para novos objetos).`);
                }
                return new Error(base);
            },

            async uploadFile(type, file) {
                const supabase = this.getClient();
                if (!supabase) throw new Error('Supabase não configurado (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
                if (!file) throw new Error(`Arquivo de ${type} não informado.`);
                const path = this.makeStoragePath(type, file?.name || `${type}.xlsx`);
                const tableName = this.tableForType(type);

                const { error: upErr } = await supabase.storage
                    .from(this.bucket)
                    .upload(path, file, {
                        upsert: true,
                        contentType: file?.type || undefined,
                        cacheControl: '0',
                    });
                if (upErr) throw this.buildUploadError(type, upErr);

                const payload = {
                    file_name: file?.name || null,
                    storage_path: path,
                    file_size: typeof file?.size === 'number' ? file.size : null,
                    mime_type: file?.type || null,
                };
                const { error: metaErr } = await supabase
                    .from(tableName)
                    .upsert([payload], { onConflict: 'storage_path' });
                if (metaErr) throw new Error(`[upload:${type}] erro ao salvar metadata (upsert por storage_path): ${metaErr?.message || 'desconhecido'}`);
                return payload;
            },

            async getLatestUpload(type) {
                const supabase = this.getClient();
                if (!supabase) return null;
                const table = this.tableForType(type);
                const { data, error } = await supabase
                    .from(table)
                    .select('file_name, storage_path, created_at, file_size, mime_type')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                if (error) throw error;
                return data || null;
            },

            async downloadLatestFile(type) {
                const supabase = this.getClient();
                if (!supabase) return null;
                const latest = await this.getLatestUpload(type);
                if (!latest?.storage_path) return null;
                const cacheBust = `${latest?.created_at || Date.now()}-${Date.now()}`;
                const blob = await this.downloadBlobNoCache(latest.storage_path, cacheBust);
                return { blob, meta: latest };
            },

            async downloadBlobNoCache(storagePath, cacheBustToken) {
                const supabase = this.getClient();
                if (!supabase) throw new Error('Supabase nÃ£o configurado.');

                try {
                    const { data: signed, error: signedErr } = await supabase.storage
                        .from(this.bucket)
                        .createSignedUrl(storagePath, 60);
                    if (signedErr) throw signedErr;
                    const signedUrl = signed?.signedUrl;
                    if (!signedUrl) throw new Error('signed_url_ausente');

                    const sep = signedUrl.includes('?') ? '&' : '?';
                    const url = `${signedUrl}${sep}cb=${encodeURIComponent(cacheBustToken || Date.now())}`;
                    const resp = await fetch(url, { cache: 'no-store' });
                    if (!resp.ok) throw new Error(`signed_download_http_${resp.status}`);
                    return await resp.blob();
                } catch (signedDownloadErr) {
                    const { data: blob, error } = await supabase.storage.from(this.bucket).download(storagePath);
                    if (error) throw signedDownloadErr || error;
                    return blob;
                }
            },

            async publishDashboardUpdateEvent(eventType, version) {
                const supabase = this.getClient();
                if (!supabase) return null;

                const evtType = String(eventType || 'dashboard_refresh');
                const evtVersion = String(version || Date.now());
                const nowIso = new Date().toISOString();
                const candidates = [
                    { event_type: evtType, version: evtVersion, created_at: nowIso },
                    { event_type: evtType, version: evtVersion, timestamp: nowIso },
                    { event_type: evtType, version: evtVersion },
                ];

                let lastError = null;
                for (const payload of candidates) {
                    const { error } = await supabase.from(this.dashboardUpdatesTable).insert([payload]);
                    if (!error) {
                        console.log('[realtime] evento realtime enviado', payload);
                        return payload;
                    }
                    lastError = error;
                    const msg = String(error?.message || '').toLowerCase();
                    const looksLikeMissingColumn = msg.includes('column') && msg.includes('does not exist');
                    if (!looksLikeMissingColumn) break;
                }

                throw new Error(`[dashboard_updates] falha ao enviar evento realtime: ${lastError?.message || 'desconhecido'}`);
            },
        };

        const RealtimeSync = {
            _channel: null,
            _refreshTimer: 0,
            _onReload: null,
            _lastVersion: null,

            init(onReload) {
                if (!SupabaseStore.isConfigured()) return;
                const supabase = SupabaseStore.getClient();
                if (!supabase) return;
                this._onReload = typeof onReload === 'function' ? onReload : null;

                if (this._channel) {
                    try { supabase.removeChannel(this._channel); } catch (_) {}
                    this._channel = null;
                }

                const channelName = `avantrax-dashboard-updates-index-${Date.now()}`;
                this._channel = supabase
                    .channel(channelName)
                    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: SupabaseStore.dashboardUpdatesTable }, (payload) => {
                        this.scheduleReload('dashboard_updates', payload?.new || null);
                    })
                    .subscribe();
            },

            scheduleReload(source, eventPayload) {
                if (!this._onReload) return;
                const version = String(eventPayload?.version || '');
                if (version && this._lastVersion === version) return;
                if (version) this._lastVersion = version;

                console.log('[realtime] evento realtime recebido', eventPayload || { source });

                if (this._refreshTimer) clearTimeout(this._refreshTimer);
                this._refreshTimer = window.setTimeout(async () => {
                    this._refreshTimer = 0;
                    try {
                        await this._onReload(source, eventPayload || null);
                    } catch (_) {}
                }, 120);
            },
        };

        const ViewportScale = {
            designWidth: 1920,
            designHeight: 1080,
            _pendingRaf: 0,
            tuneKey: 'avantrax.viewport.tune.v1',
            tune: { scalePct: 100, offsetY: 0, widthPct: 100, heightPct: 100 },

            loadTune() {
                try {
                    const raw = localStorage.getItem(this.tuneKey);
                    if (!raw) return;
                    const parsed = JSON.parse(raw);
                    if (!parsed || typeof parsed !== 'object') return;
                    const scalePct = Number(parsed.scalePct);
                    const offsetY = Number(parsed.offsetY);
                    const widthPct = Number(parsed.widthPct);
                    const heightPct = Number(parsed.heightPct);
                    if (Number.isFinite(scalePct)) this.tune.scalePct = Math.min(100, Math.max(80, Math.round(scalePct)));
                    if (Number.isFinite(offsetY)) this.tune.offsetY = Math.min(180, Math.max(-180, Math.round(offsetY)));
                    if (Number.isFinite(widthPct)) this.tune.widthPct = Math.min(120, Math.max(80, Math.round(widthPct)));
                    if (Number.isFinite(heightPct)) this.tune.heightPct = Math.min(130, Math.max(80, Math.round(heightPct)));
                } catch (_) {}
            },

            persistTune() {
                try { localStorage.setItem(this.tuneKey, JSON.stringify(this.tune)); } catch (_) {}
            },

            setTune(next) {
                if (next && typeof next === 'object') {
                    if (next.scalePct !== undefined) {
                        const v = Number(next.scalePct);
                        if (Number.isFinite(v)) this.tune.scalePct = Math.min(100, Math.max(80, Math.round(v)));
                    }
                    if (next.offsetY !== undefined) {
                        const v = Number(next.offsetY);
                        if (Number.isFinite(v)) this.tune.offsetY = Math.min(180, Math.max(-180, Math.round(v)));
                    }
                    if (next.widthPct !== undefined) {
                        const v = Number(next.widthPct);
                        if (Number.isFinite(v)) this.tune.widthPct = Math.min(120, Math.max(80, Math.round(v)));
                    }
                    if (next.heightPct !== undefined) {
                        const v = Number(next.heightPct);
                        if (Number.isFinite(v)) this.tune.heightPct = Math.min(130, Math.max(80, Math.round(v)));
                    }
                }
                this.persistTune();
                this.apply();
            },

            apply() {
                const root = document.getElementById('design-root');
                const viewport = window.visualViewport || null;
                const widthCandidates = [
                    document.documentElement && document.documentElement.clientWidth,
                    window.innerWidth,
                    viewport && viewport.width,
                ].filter(v => typeof v === 'number' && v > 0);
                const heightCandidates = [
                    document.documentElement && document.documentElement.clientHeight,
                    window.innerHeight,
                    viewport && viewport.height,
                ].filter(v => typeof v === 'number' && v > 0);

                const vw = widthCandidates.length ? Math.min(...widthCandidates) : this.designWidth;
                const vh = heightCandidates.length ? Math.min(...heightCandidates) : this.designHeight;
                const vpLeft = viewport && typeof viewport.offsetLeft === 'number' ? viewport.offsetLeft : 0;
                const vpTop  = viewport && typeof viewport.offsetTop  === 'number' ? viewport.offsetTop  : 0;

                const isPresentation = document.body.classList.contains('presentation-mode');
                const baseX = isPresentation ? (vw / this.designWidth) : Math.min(vw / this.designWidth, vh / this.designHeight);
                const baseY = isPresentation ? (vh / this.designHeight) : Math.min(vw / this.designWidth, vh / this.designHeight);
                const safeBaseX = Number.isFinite(baseX) && baseX > 0 ? baseX : 1;
                const safeBaseY = Number.isFinite(baseY) && baseY > 0 ? baseY : 1;
                const tuneScale = (this.tune.scalePct || 100) / 100;
                const desiredScaleX = safeBaseX * tuneScale * ((this.tune.widthPct || 100) / 100);
                const desiredScaleY = safeBaseY * tuneScale * ((this.tune.heightPct || 100) / 100);

                const setScaleAndCenter = (scaleX, scaleY) => {
                    document.documentElement.style.setProperty('--ui-scale', String(scaleY));
                    document.documentElement.style.setProperty('--ui-scale-x', String(scaleX));
                    if (!root) return;
                    const offsetX = Math.max(0, (vw - this.designWidth  * scaleX) / 2);
                    const offsetY = Math.max(0, (vh - this.designHeight * scaleY) / 2) + (this.tune.offsetY || 0) * scaleY;
                    root.style.left = `${Math.floor(offsetX + vpLeft)}px`;
                    root.style.top  = `${Math.floor(offsetY + vpTop )}px`;
                };

                setScaleAndCenter(desiredScaleX, desiredScaleY);

                if (this._pendingRaf) cancelAnimationFrame(this._pendingRaf);
                this._pendingRaf = requestAnimationFrame(() => {
                    this._pendingRaf = 0;
                    if (!root) return;
                    const rect = root.getBoundingClientRect();
                    const overflowX = rect.right  - (vpLeft + vw);
                    const overflowY = rect.bottom - (vpTop  + vh);
                    if (overflowX <= 0.5 && overflowY <= 0.5) return;
                    const fitX = overflowX > 0.5 ? (vw / Math.max(1, rect.width)) * 0.992 : 1;
                    const fitY = overflowY > 0.5 ? (vh / Math.max(1, rect.height)) * 0.992 : 1;
                    const nextScaleX = Number.isFinite(desiredScaleX * fitX) && desiredScaleX * fitX > 0 ? desiredScaleX * fitX : desiredScaleX;
                    const nextScaleY = Number.isFinite(desiredScaleY * fitY) && desiredScaleY * fitY > 0 ? desiredScaleY * fitY : desiredScaleY;
                    setScaleAndCenter(nextScaleX, nextScaleY);
                });
            },

            init() {
                this.loadTune();
                this.apply();
                window.addEventListener('resize', () => this.apply(), { passive: true });
                if (window.visualViewport) {
                    window.visualViewport.addEventListener('resize', () => this.apply(), { passive: true });
                    window.visualViewport.addEventListener('scroll',  () => this.apply(), { passive: true });
                }
            }
        };
        ViewportScale.init();

        const DataService = {
            embarcados: [],
            inventario: [],
            lastUpdate: null,
            filters: { montadora: '', proprietario: '' },
            columnMap: {
                embarcados: { montadora: null, proprietario: null },
                inventario:  { montadora: null, proprietario: null },
            },
            storageKey: 'avantrax.filters.v1',

            normalizeHeader(value) {
                return String(value ?? '')
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .toUpperCase()
                    .replace(/[\s\-]+/g, '_')
                    .replace(/[^A-Z0-9_]/g, '_')
                    .replace(/_+/g, '_')
                    .replace(/^_+|_+$/g, '')
                    .trim();
            },
            normalizeValue(value) { return String(value ?? '').trim(); },

            findBestKey(rows, candidates, heuristics = []) {
                if (!Array.isArray(rows) || rows.length === 0) return null;
                const keys = Object.keys(rows[0] ?? {});
                if (keys.length === 0) return null;
                const normalizedKeys = keys.map(k => ({ raw: k, norm: this.normalizeHeader(k) }));
                const normalizedCandidates = candidates.map(c => this.normalizeHeader(c));
                for (const cand of normalizedCandidates) {
                    const exact = normalizedKeys.find(k => k.norm === cand);
                    if (exact) return exact.raw;
                }
                const simplify = (s) => s.replace(/[^A-Z0-9]/g, '');
                const normalizedKeysSimple = normalizedKeys.map(k => ({ raw: k.raw, norm: simplify(k.norm) }));
                const candidatesSimple = normalizedCandidates.map(simplify);
                for (const cand of candidatesSimple) {
                    const exact = normalizedKeysSimple.find(k => k.norm === cand);
                    if (exact) return exact.raw;
                }
                const heuristicMatches = [];
                for (const h of heuristics) {
                    const hn = simplify(this.normalizeHeader(h));
                    normalizedKeysSimple.forEach(k => { if (k.norm.includes(hn)) heuristicMatches.push(k.raw); });
                }
                const unique = Array.from(new Set(heuristicMatches));
                return unique.length === 1 ? unique[0] : null;
            },

            updateColumnMap(type) {
                const rows = this[type] ?? [];
                this.columnMap[type] = {
                    montadora: this.findBestKey(rows, ['MONTADORA','MOTADORA','MONTADORA/GRUPO','MONTADORA GRUPO'], ['MONTADOR','MOTADOR']),
                    proprietario: this.findBestKey(rows, ['PROPRIETARIO','PROPRIETÁRIO','PROPRIETARIO/CLIENTE','CLIENTE','PROPRIETARIO CLIENTE'], ['PROPRIETAR','CLIENTE']),
                };
            },

            loadFilters() {
                try {
                    const raw = localStorage.getItem(this.storageKey);
                    if (!raw) return;
                    const parsed = JSON.parse(raw);
                    if (parsed && typeof parsed === 'object') {
                        this.filters.montadora    = this.normalizeValue(parsed.montadora || '');
                        this.filters.proprietario = this.normalizeValue(parsed.proprietario || '');
                    }
                } catch (_) {}
            },

            persistFilters() {
                try { localStorage.setItem(this.storageKey, JSON.stringify(this.filters)); } catch (_) {}
            },

            setFilters(next) {
                this.filters = {
                    montadora:    this.normalizeValue(next?.montadora    ?? this.filters.montadora    ?? ''),
                    proprietario: this.normalizeValue(next?.proprietario ?? this.filters.proprietario ?? ''),
                };
                this.persistFilters();
                if (TV_MODE) {
                    try { window.parent?.postMessage({ type: 'avantrax:filters', filters: { ...this.filters } }, '*'); } catch (_) {}
                }
            },

            clearFilters() {
                this.filters = { montadora: '', proprietario: '' };
                this.persistFilters();
                if (TV_MODE) {
                    try { window.parent?.postMessage({ type: 'avantrax:filters', filters: { ...this.filters } }, '*'); } catch (_) {}
                }
            },

            getFiltered(type) {
                const rows = this[type] ?? [];
                const map  = this.columnMap[type] ?? {};
                const f    = this.filters;
                if (!rows.length) return rows;
                const montadoraActive    = f.montadora    && map.montadora;
                const proprietarioActive = f.proprietario && map.proprietario;
                if (!montadoraActive && !proprietarioActive) return rows;
                return rows.filter(r => {
                    if (montadoraActive    && this.normalizeValue(r[map.montadora])    !== f.montadora)    return false;
                    if (proprietarioActive && this.normalizeValue(r[map.proprietario]) !== f.proprietario) return false;
                    return true;
                });
            },

            getFilterOptions() {
                const options = { montadora: new Set(), proprietario: new Set(), has: { montadora: false, proprietario: false } };
                const collect = (type) => {
                    const rows = this[type] ?? [];
                    const map  = this.columnMap[type] ?? {};
                    if (map.montadora)    options.has.montadora    = true;
                    if (map.proprietario) options.has.proprietario = true;
                    rows.forEach(r => {
                        if (map.montadora)    { const v = this.normalizeValue(r[map.montadora]);    if (v) options.montadora.add(v); }
                        if (map.proprietario) { const v = this.normalizeValue(r[map.proprietario]); if (v) options.proprietario.add(v); }
                    });
                };
                collect('inventario');
                collect('embarcados');
                return {
                    montadora:    Array.from(options.montadora).sort((a,b) => a.localeCompare(b, 'pt-BR')),
                    proprietario: Array.from(options.proprietario).sort((a,b) => a.localeCompare(b, 'pt-BR')),
                    has: options.has,
                };
            },

            setData(type, data) { this[type] = data; this.lastUpdate = new Date(); this.updateColumnMap(type); },

            getStats() {
                const inventario  = this.getFiltered('inventario');
                const embarcados  = this.getFiltered('embarcados');
                const totalPatio  = inventario.length;
                const naoFaturados       = inventario.filter(i => i.STAT_FAT === 'NAO FATURADO').length;
                const faturadosAguardando = inventario.filter(i => i.STAT_FAT === 'FATURADO').length;
                const bloqueados  = inventario.filter(i => i['MOTIVO BLOQUEIO'] && i['MOTIVO BLOQUEIO'].trim() !== '');
                const agingPatioSum = inventario.reduce((acc, curr) => acc + (Number(curr.AGING_PATIO) || 0), 0);
                const agingPatioAvg = totalPatio > 0 ? (agingPatioSum / totalPatio).toFixed(1) : 0;
                const criticos    = inventario.filter(i => (Number(i.AGING_PATIO) || 0) > 90).length;

                // Transportadoras: conta distintas do INVENTÁRIO DE PÁTIO
                const transportadoras = new Set(
                    inventario
                        .map(i => String(i['NOME TRANSPORTADORA'] || i['TRANSPORTADORA'] || i['TRANSP'] || '').trim())
                        .filter(v => v !== '')
                ).size;

                // Embarcados Total: somente do dia atual, pela col N (DT_EXPEDICAO) dos embarcados
                const hoje = new Date();
                const diaH = hoje.getDate(), mesH = hoje.getMonth(), anoH = hoje.getFullYear();

                const excelToDate = (v) => {
                    if (v === undefined || v === null || v === '') return null;
                    // Serial numérico do Excel
                    if (typeof v === 'number') {
                        return new Date(Date.UTC(1899, 11, 30) + v * 86400000);
                    }
                    const s = String(v).trim();
                    // Formato DD/MM/AAAA (padrão brasileiro do Excel)
                    const brMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
                    if (brMatch) {
                        return new Date(Number(brMatch[3]), Number(brMatch[2]) - 1, Number(brMatch[1]));
                    }
                    // ISO ou qualquer outro formato reconhecido
                    const d = new Date(s);
                    return isNaN(d.getTime()) ? null : d;
                };

                const totalEmbarcados = embarcados.filter(e => {
                    // Col N: "DATA EXPEDIÇÃO" — tenta todas as variações possíveis
                    const raw = e['DATA EXPEDIÇÃO'] ?? e['DATA EXPEDICAO'] ?? e['DT_EXPEDICAO'] ?? e['DT EXPEDICAO'] ?? e['DATA_EXPEDICAO'] ?? e['DT EXPEDIÇÃO'] ?? e['DT_EXPEDIÇÃO'];
                    const d = excelToDate(raw);
                    if (!d) return false;
                    // Serial Excel → UTC; texto → local
                    const useUTC = typeof raw === 'number';
                    const dia = useUTC ? d.getUTCDate()     : d.getDate();
                    const mes = useUTC ? d.getUTCMonth()    : d.getMonth();
                    const ano = useUTC ? d.getUTCFullYear() : d.getFullYear();
                    return dia === diaH && mes === mesH && ano === anoH;
                }).length;

                return {
                    totalPatio, naoFaturados, faturadosAguardando,
                    bloqueadosCount: bloqueados.length,
                    bloqueadosList:  bloqueados.slice(0, 10),
                    agingPatioAvg, totalEmbarcados, transportadoras, criticos,
                };
            }
        };

        const Parser = {
            normalizeHeaderCell(value, index) {
                const raw = String(value ?? '').trim();
                const normalized = raw
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .toUpperCase()
                    .replace(/[\s\-]+/g, '_')
                    .replace(/[^A-Z0-9_]/g, '_')
                    .replace(/_+/g, '_')
                    .replace(/^_+|_+$/g, '')
                    .trim();
                return normalized || `COLUNA_${index}`;
            },

            makeUniqueHeader(baseHeader, colIndex, used) {
                if (!used.has(baseHeader)) {
                    used.set(baseHeader, 1);
                    return baseHeader;
                }
                const nextCount = (used.get(baseHeader) || 1) + 1;
                used.set(baseHeader, nextCount);
                return `${baseHeader}_${colIndex}`;
            },

            getHeaderAliases(normalizedHeader, rawHeader) {
                const aliases = new Set();
                const rawTrimmed = String(rawHeader ?? '').trim();
                if (rawTrimmed) aliases.add(rawTrimmed);
                if (normalizedHeader.includes('_')) aliases.add(normalizedHeader.replace(/_/g, ' '));

                const explicitAliasGroups = [
                    ['MOTIVO_BLOQUEIO', 'MOTIVO BLOQUEIO'],
                    ['LOCAL_ENTREGA', 'LOCAL ENTREGA'],
                    ['DESC_CLIENTE', 'DESC CLIENTE'],
                    ['DATA_EXPEDICAO', 'DATA EXPEDICAO', 'DATA EXPEDIÇÃO'],
                    ['DESCRICAO_MODELO', 'DESCRICAO MODELO', 'DESCRIÇÃO MODELO'],
                ];

                for (const group of explicitAliasGroups) {
                    if (group.includes(normalizedHeader) || group.includes(rawTrimmed)) {
                        group.forEach((g) => aliases.add(g));
                    }
                }

                aliases.delete(normalizedHeader);
                return Array.from(aliases);
            },

            getRequiredColumns(type) {
                if (type === 'inventario') {
                    return [
                        'SITE','PROPRIETARIO','MONTADORA','NF','CHAVE','STAT_FAT','DT_FAT','HR_FAT','CHASSI','PAIS_DESTINO',
                        'CODIGO','MODELO','SUFIXO','DEP','AR','ENDERECO','AGING_PATIO','AGING_TOTAL','CLIENTE','DESC_CLIENTE',
                        'LOCAL_ENTREGA','COR','DATA_CRIACAO','HORA_CRIACAO','TRANSPORTADORA','MOTIVO_BLOQUEIO','TP_VENDA',
                    ];
                }
                if (type === 'embarcados') {
                    return ['PROPRIETARIO','MONTADORA','CHASSI','DESCRICAO_MODELO','DATA_EXPEDICAO','FROTA'];
                }
                return [];
            },

            findMissingRequiredColumns(baseHeaders, requiredColumns) {
                if (!requiredColumns.length) return [];
                const headerSet = new Set(baseHeaders);
                return requiredColumns.filter((required) => !headerSet.has(required));
            },

            async parseFile(file, type = 'generic') {
                const getBuffer = async () => {
                    if (file && typeof file.arrayBuffer === 'function') return file.arrayBuffer();
                    return new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = (e) => resolve(e.target.result);
                        reader.onerror = reject;
                        reader.readAsArrayBuffer(file);
                    });
                };

                const buffer = await getBuffer();
                const data = new Uint8Array(buffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                const matrix = XLSX.utils.sheet_to_json(worksheet, {
                    header: 1,
                    defval: '',
                    blankrows: false,
                });

                const rawHeaders = Array.isArray(matrix[0]) ? matrix[0] : [];
                const dataRows = matrix.slice(1);
                const totalColumns = Math.max(
                    rawHeaders.length,
                    ...dataRows.map((row) => (Array.isArray(row) ? row.length : 0)),
                    0
                );

                const used = new Map();
                const headers = [];
                const baseHeaders = [];
                const aliasesByIndex = [];

                for (let colIndex = 0; colIndex < totalColumns; colIndex++) {
                    const rawHeader = rawHeaders[colIndex] ?? '';
                    const baseHeader = this.normalizeHeaderCell(rawHeader, colIndex);
                    const uniqueHeader = this.makeUniqueHeader(baseHeader, colIndex, used);
                    headers.push(uniqueHeader);
                    baseHeaders.push(baseHeader);
                    aliasesByIndex.push(this.getHeaderAliases(uniqueHeader, rawHeader));
                }

                const rows = dataRows.map((row) => {
                    const out = {};
                    for (let colIndex = 0; colIndex < totalColumns; colIndex++) {
                        const key = headers[colIndex];
                        const value = Array.isArray(row) ? (row[colIndex] ?? '') : '';
                        out[key] = value;

                        const aliases = aliasesByIndex[colIndex] || [];
                        for (const alias of aliases) {
                            if (!alias || Object.prototype.hasOwnProperty.call(out, alias)) continue;
                            out[alias] = value;
                        }
                    }
                    return out;
                });

                const firstRow = rows[0] ?? {};
                const missingRequired = this.findMissingRequiredColumns(baseHeaders, this.getRequiredColumns(type));
                const fileName = file?.name || 'arquivo_sem_nome.xlsx';
                console.log(`[upload:${type}] arquivo: ${fileName}`);
                console.log(`[upload:${type}] headers brutos:`, rawHeaders);
                console.log(`[upload:${type}] headers normalizados:`, headers);
                console.log(`[upload:${type}] total de colunas lidas:`, headers.length);
                console.log(`[upload:${type}] primeira linha montada:`, firstRow);
                console.log(`[upload:${type}] quantidade de chaves da primeira linha:`, Object.keys(firstRow).length);
                if (missingRequired.length) {
                    console.warn(`[upload:${type}] colunas obrigatorias ausentes:`, missingRequired);
                } else {
                    console.log(`[upload:${type}] colunas obrigatorias ausentes: nenhuma`);
                }

                return rows;
            }
        };

        const InventoryDiagnostics = {
            analyze(rows) {
                const keyCount = Object.keys(rows?.[0] ?? {}).length;
                const localKey = DataService.findBestKey(
                    rows,
                    [
                        'LOCAL_ENTREGA','LOCAL ENTREGA','LOCAL DE ENTREGA','LOC_ENTREGA','LOC ENTREGA','LOCALENTREGA',
                        'DESTINO','CIDADE DESTINO','CIDADE_DESTINO','MUNICIPIO DESTINO','MUNICIPIO_DESTINO','MUNICÍPIO DESTINO',
                        'LOCAL_DESTINO','LOCAL DESTINO','LOCAL DE DESTINO','CIDADE','MUNICIPIO','MUNICÍPIO','UF_DESTINO','UF DESTINO'
                    ],
                    ['ENTREGA','DESTINO','LOCAL','CIDADE','MUNICIP']
                );
                const statusKey = DataService.findBestKey(rows, ['STAT_FAT','STAT FAT','STATUS_FATURAMENTO','STATUS FAT','STATFAT'], ['STAT', 'FATUR']);
                const countryKey = DataService.findBestKey(rows, ['PAIS_DESTINO','PAIS DESTINO','PAÍS_DESTINO','PAÍS DESTINO','PAIS','PAÍS'], ['PAIS', 'DESTINO']);
                return {
                    keyCount,
                    localKey,
                    statusKey,
                    countryKey,
                    looksIncompleteForMap: !localKey || keyCount <= 16,
                };
            },

            warnIfIncomplete(rows, sourceLabel = 'inventário') {
                const info = this.analyze(rows);
                if (!info.looksIncompleteForMap) return;
                console.warn(
                    `[index] ${sourceLabel} parece incompleto para o mapa. ` +
                    `colunas=${info.keyCount}, LOCAL/DESTINO=${info.localKey || 'não encontrado'}, ` +
                    `PAIS_DESTINO=${info.countryKey || 'não encontrado'}, STAT_FAT=${info.statusKey || 'não encontrado'}`
                );
            },
        };

        const DashboardRender = {
            charts: {},
            rotationMs: 120000,
            _rotationTimer: 0,
            _countdownTimer: 0,
            _countdownEndAt: 0,
            _countdownTotalMs: 0,
            _centerToggleTimer: 0,
            _embFile: null,
            _invFile: null,
            _refreshInFlight: null,
            _refreshQueued: false,
            _refreshQueuedReason: '',
            _lastRefreshAt: 0,
            _minRefreshGapMs: 700,

            startCountdown(durationMs) {
                this.stopCountdown();
                this._countdownTotalMs = Math.max(0, Number(durationMs) || 0);
                this._countdownEndAt = Date.now() + this._countdownTotalMs;

                const ensureMarkup = () => {
                    const el = document.getElementById('screen-countdown');
                    if (!el) return null;
                    if (!el.dataset.cdownReady) {
                        el.dataset.cdownReady = '1';
                        el.classList.add('cdown');
                        el.innerHTML = `
                            <span>Troca em:</span>
                            <div class="cbar-wrap"><div class="cbar" id="cbar-index" style="width:100%"></div></div>
                            <span id="screen-countdown-txt">2:00</span>
                        `.trim();
                    }
                    return el;
                };

                const tick = () => {
                    if (!ensureMarkup()) return;
                    const remainingMs = Math.max(0, this._countdownEndAt - Date.now());
                    const totalSec = Math.ceil(remainingMs / 1000);
                    const m = Math.floor(totalSec / 60);
                    const s = totalSec % 60;
                    const txt = document.getElementById('screen-countdown-txt');
                    if (txt) txt.textContent = `${m}:${String(s).padStart(2, '0')}`;

                    const bar = document.getElementById('cbar-index');
                    if (bar && this._countdownTotalMs > 0) {
                        const pct = Math.max(0, Math.min(1, remainingMs / this._countdownTotalMs)) * 100;
                        bar.style.width = `${pct}%`;
                    }
                    if (remainingMs <= 0) this.stopCountdown();
                };

                tick();
                this._countdownTimer = window.setInterval(tick, 1000);
            },

            stopCountdown() {
                if (!this._countdownTimer) return;
                clearInterval(this._countdownTimer);
                this._countdownTimer = 0;
                this._countdownEndAt = 0;
                this._countdownTotalMs = 0;
            },

            startRotationToMap() {
                if (TV_MODE) return;
                this.stopRotation();
                this._rotationTimer = window.setTimeout(() => {
                    window.location.href = 'mapa.html';
                }, this.rotationMs);
                this.startCountdown(this.rotationMs);
            },

            stopRotation() {
                if (!this._rotationTimer) return;
                clearTimeout(this._rotationTimer);
                this._rotationTimer = 0;
                this.stopCountdown();
            },

            openUploadOverlay() {
                this.stopRotation();
                this.stopCountdown();
                this._embFile = null;
                this._invFile = null;

                const inputEmb = document.getElementById('input-embarcados');
                const inputInv = document.getElementById('input-inventario');
                if (inputEmb) inputEmb.value = '';
                if (inputInv) inputInv.value = '';

                const boxEmb = document.getElementById('box-embarcados');
                const boxInv = document.getElementById('box-inventario');
                const labelEmb = document.getElementById('label-embarcados');
                const labelInv = document.getElementById('label-inventario');
                if (boxEmb) boxEmb.classList.remove('loaded');
                if (boxInv) boxInv.classList.remove('loaded');
                if (labelEmb) labelEmb.textContent = 'Clique para selecionar';
                if (labelInv) labelInv.textContent = 'Clique para selecionar';

                const btnStart = document.getElementById('btn-start');
                if (btnStart) { btnStart.disabled = true; btnStart.textContent = 'INICIAR DASHBOARD'; }

                const overlay = document.getElementById('upload-overlay');
                if (overlay) {
                    overlay.style.display = 'flex';
                    overlay.style.opacity = '1';
                }
                const dash = document.getElementById('dashboard');
                if (dash) dash.style.display = 'none';
            },

            ensureDashboardVisible() {
                const overlay = document.getElementById('upload-overlay');
                const dash = document.getElementById('dashboard');
                const shouldShow = dash && dash.style.display !== 'flex';
                if (!shouldShow) return;

                if (overlay) {
                    overlay.style.opacity = '0';
                    window.setTimeout(() => {
                        overlay.style.display = 'none';
                    }, 500);
                }
                dash.style.display = 'flex';
                this.enterFullscreen();
                this.startRotationToMap();
                postReadyToParent();
            },

            async safeRefreshAllData(reason = 'manual') {
                if (!SupabaseStore.isConfigured()) return false;
                if (this._refreshInFlight) {
                    this._refreshQueued = true;
                    this._refreshQueuedReason = reason;
                    return this._refreshInFlight;
                }

                const now = Date.now();
                const waitMs = this._lastRefreshAt > 0
                    ? Math.max(0, this._minRefreshGapMs - (now - this._lastRefreshAt))
                    : 0;

                this._refreshInFlight = (async () => {
                    if (waitMs > 0) {
                        await new Promise((resolve) => window.setTimeout(resolve, waitMs));
                    }
                    console.log(`[refresh] inicio (${reason})`);
                    try {
                        const reasonStr = String(reason || '');
                        const maxAttempts = (reasonStr.startsWith('realtime:') || reasonStr.startsWith('postMessage:')) ? 3 : 1;
                        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                            const ok = await this.tryLoadFromSupabase({ silentUi: true, reason });
                            if (ok) return true;
                            if (attempt < maxAttempts) {
                                console.warn(`[refresh] tentativa ${attempt}/${maxAttempts} sem dados novos; aguardando retry`);
                                await new Promise((resolve) => window.setTimeout(resolve, 700 * attempt));
                            }
                        }
                        return false;
                    } finally {
                        this._lastRefreshAt = Date.now();
                        console.log(`[refresh] fim (${reason})`);
                    }
                })();

                try {
                    return await this._refreshInFlight;
                } finally {
                    this._refreshInFlight = null;
                    if (this._refreshQueued) {
                        const queuedReason = this._refreshQueuedReason || 'queued';
                        this._refreshQueued = false;
                        this._refreshQueuedReason = '';
                        window.setTimeout(() => {
                            this.safeRefreshAllData(`queued:${queuedReason}`);
                        }, 60);
                    }
                }
            },

            async init() {
                DataService.loadFilters();
                if (TV_MODE) {
                    try { window.parent?.postMessage({ type: 'avantrax:filters', filters: { ...DataService.filters } }, '*'); } catch (_) {}
                }
                this.setupClock();
                this.setupCenterGadget();
                this.setupUploadListeners();
                this.setupFilters();
                RealtimeSync.init(async (_source, eventPayload) => {
                    const evtType = String(eventPayload?.event_type || 'dashboard_updates');
                    const evtVersion = eventPayload?.version ? `#${eventPayload.version}` : '';
                    await this.safeRefreshAllData(`realtime:${evtType}${evtVersion}`);
                });
                await this.safeRefreshAllData('startup');
            },

            setupCenterGadget() {
                const totalPanel = document.getElementById('center-total-panel');
                const weatherPanel  = document.getElementById('center-weather-panel');
                if (!totalPanel || !weatherPanel) return;

                const showTotal = () => {
                    totalPanel.classList.add('on');
                    weatherPanel.classList.remove('on');
                    weatherPanel.setAttribute('aria-hidden', 'true');
                };
                const showWeather = () => {
                    weatherPanel.classList.add('on');
                    totalPanel.classList.remove('on');
                    weatherPanel.setAttribute('aria-hidden', 'false');
                };

                const totalMs = 14000;
                const timeMs  = 7000;

                if (this._centerToggleTimer) clearTimeout(this._centerToggleTimer);
                this._centerToggleTimer = 0;

                showTotal();
                const loop = () => {
                    showWeather();
                    this._centerToggleTimer = window.setTimeout(() => {
                        showTotal();
                        this._centerToggleTimer = window.setTimeout(loop, totalMs);
                    }, timeMs);
                };
                this._centerToggleTimer = window.setTimeout(loop, totalMs);

                try { WeatherGadget.start(); } catch (_) {}
            },
            async tryLoadFromSupabase(options = {}) {
                if (!SupabaseStore.isConfigured()) return false;
                const opts = options && typeof options === 'object' ? options : {};
                const silentUi = Boolean(opts.silentUi);
                const dashboardEl = document.getElementById('dashboard');
                const isDashboardVisible = dashboardEl && dashboardEl.style.display === 'flex';
                const shouldTouchUploadUi = !silentUi || !isDashboardVisible;

                const btnStart = document.getElementById('btn-start');
                const labelEmb = document.getElementById('label-embarcados');
                const labelInv = document.getElementById('label-inventario');
                const boxEmb = document.getElementById('box-embarcados');
                const boxInv = document.getElementById('box-inventario');

                if (shouldTouchUploadUi) {
                    if (labelEmb) labelEmb.textContent = 'Carregando do Supabase...';
                    if (labelInv) labelInv.textContent = 'Carregando do Supabase...';
                    if (btnStart) { btnStart.textContent = 'CARREGANDO...'; btnStart.disabled = true; }
                }

                try {
                    const [emb, inv] = await Promise.all([
                        SupabaseStore.downloadLatestFile('embarcados'),
                        SupabaseStore.downloadLatestFile('inventario'),
                    ]);

                    if (!emb?.blob || !inv?.blob) {
                        if (shouldTouchUploadUi) {
                            if (btnStart) { btnStart.textContent = 'INICIAR DASHBOARD'; btnStart.disabled = true; }
                            if (labelEmb) labelEmb.textContent = 'Clique para selecionar';
                            if (labelInv) labelInv.textContent = 'Clique para selecionar';
                        }
                        return false;
                    }

                    if (shouldTouchUploadUi) {
                        if (boxEmb) boxEmb.classList.add('loaded');
                        if (boxInv) boxInv.classList.add('loaded');
                        if (labelEmb) labelEmb.textContent = emb?.meta?.file_name || 'embarcados.xlsx';
                        if (labelInv) labelInv.textContent = inv?.meta?.file_name || 'inventario_de_patio.xlsx';
                    }

                    const [dataEmb, dataInv] = await Promise.all([
                        Parser.parseFile(emb.blob, 'embarcados'),
                        Parser.parseFile(inv.blob, 'inventario'),
                    ]);
                    InventoryDiagnostics.warnIfIncomplete(dataInv, 'inventário carregado do Supabase');
                    DataService.setData('embarcados', dataEmb);
                    DataService.setData('inventario', dataInv);
                    this.renderAll();
                    this.ensureDashboardVisible();
                    return true;
                } catch (err) {
                    console.warn('Falha ao carregar do Supabase. Mantendo upload manual.', err);
                    if (shouldTouchUploadUi) {
                        if (btnStart) { btnStart.textContent = 'INICIAR DASHBOARD'; btnStart.disabled = true; }
                        if (labelEmb) labelEmb.textContent = 'Clique para selecionar';
                        if (labelInv) labelInv.textContent = 'Clique para selecionar';
                    }
                    return false;
                }
            },

            setupClock() {
                const updateClock = () => {
                    const now = new Date();
                    document.getElementById('current-time').textContent = now.toLocaleTimeString('pt-BR');
                    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
                    document.getElementById('current-date').textContent = now.toLocaleDateString('pt-BR', options).toUpperCase();
                };
                setInterval(updateClock, 1000);
                updateClock();
            },

            setupUploadListeners() {
                const inputEmb = document.getElementById('input-embarcados');
                const inputInv = document.getElementById('input-inventario');
                const btnStart = document.getElementById('btn-start');
                this._embFile = null;
                this._invFile = null;

                inputEmb.onchange = (e) => {
                    this._embFile = e.target.files[0];
                    if (this._embFile) {
                        document.getElementById('box-embarcados').classList.add('loaded');
                        document.getElementById('label-embarcados').textContent = this._embFile.name;
                        if (this._embFile && this._invFile) btnStart.disabled = false;
                    }
                };
                inputInv.onchange = (e) => {
                    this._invFile = e.target.files[0];
                    if (this._invFile) {
                        document.getElementById('box-inventario').classList.add('loaded');
                        document.getElementById('label-inventario').textContent = this._invFile.name;
                        if (this._embFile && this._invFile) btnStart.disabled = false;
                    }
                };

                btnStart.onclick = async () => {
                    btnStart.textContent = "PROCESSANDO...";
                    btnStart.disabled = true;
                    try {
                        const dataEmb = await Parser.parseFile(this._embFile, 'embarcados');
                        const dataInv = await Parser.parseFile(this._invFile, 'inventario');
                        InventoryDiagnostics.warnIfIncomplete(dataInv, 'inventário enviado manualmente');
                        DataService.setData('embarcados', dataEmb);
                        DataService.setData('inventario', dataInv);
                        this.renderAll();
                        console.log('[upload] upload concluido (processamento local) inventario + embarcados');

                        if (SupabaseStore.isConfigured()) {
                            try {
                                btnStart.textContent = "ENVIANDO PARA SUPABASE...";
                                await Promise.all([
                                    SupabaseStore.uploadFile('embarcados', this._embFile),
                                    SupabaseStore.uploadFile('inventario', this._invFile),
                                ]);
                                console.log('[upload] upload concluido com sucesso no Supabase (inventario + embarcados)');
                                try {
                                    await SupabaseStore.publishDashboardUpdateEvent('inventory_embarcados_upload_completed', `${Date.now()}`);
                                } catch (evtErr) {
                                    console.warn('[realtime] nao foi possivel enviar evento realtime apos upload', evtErr);
                                }
                                if (TV_MODE) {
                                    try { window.parent?.postMessage({ type: 'avantrax:data_updated' }, '*'); } catch (_) {}
                                }
                            } catch (err) {
                                console.error('Falha ao enviar para Supabase. Dashboard seguirá com dados locais.', err);
                                alert('Falha ao enviar para Supabase. O dashboard seguirá com dados locais.\n\n' + (err?.message || err));
                            }
                        }

                        this.ensureDashboardVisible();
                    } catch (err) {
                        alert("Erro ao processar arquivos. Verifique o formato.");
                        console.error(err);
                        btnStart.disabled = false;
                        btnStart.textContent = "INICIAR DASHBOARD";
                    }
                };
            },

            setupFilters() {
                const panel             = document.getElementById('filters-panel');
                const hotspot           = document.getElementById('filters-hotspot');
                const closeBtn          = document.getElementById('filters-close');
                const applyBtn          = document.getElementById('filters-apply');
                const clearBtn          = document.getElementById('filters-clear');
                const uploadBtn         = document.getElementById('filters-upload');
                const montadoraSelect   = document.getElementById('filter-montadora');
                const proprietarioSelect= document.getElementById('filter-proprietario');
                const tuneScale         = document.getElementById('tune-scale');
                const tuneScaleVal      = document.getElementById('tune-scale-val');
                const tuneOffsetY       = document.getElementById('tune-offsety');
                const tuneOffsetYVal    = document.getElementById('tune-offsety-val');
                const tuneWidth         = document.getElementById('tune-width');
                const tuneWidthVal      = document.getElementById('tune-width-val');
                const tuneHeight        = document.getElementById('tune-height');
                const tuneHeightVal     = document.getElementById('tune-height-val');

                const open = () => {
                    panel.classList.add('open');
                    panel.setAttribute('aria-hidden', 'false');
                    this.refreshFiltersUI();
                    if (tuneScale)    tuneScale.value    = String(ViewportScale.tune.scalePct ?? 100);
                    if (tuneScaleVal) tuneScaleVal.textContent = `${ViewportScale.tune.scalePct ?? 100}%`;
                    if (tuneOffsetY)  tuneOffsetY.value  = String(ViewportScale.tune.offsetY ?? 0);
                    if (tuneOffsetYVal) tuneOffsetYVal.textContent = String(ViewportScale.tune.offsetY ?? 0);
                    if (tuneWidth) tuneWidth.value = String(ViewportScale.tune.widthPct ?? 100);
                    if (tuneWidthVal) tuneWidthVal.textContent = `${ViewportScale.tune.widthPct ?? 100}%`;
                    if (tuneHeight) tuneHeight.value = String(ViewportScale.tune.heightPct ?? 100);
                    if (tuneHeightVal) tuneHeightVal.textContent = `${ViewportScale.tune.heightPct ?? 100}%`;
                };
                const close  = () => { panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true'); };
                const toggle = () => { panel.classList.contains('open') ? close() : open(); };

                const applyFromUI = () => {
                    DataService.setFilters({
                        montadora:    montadoraSelect.value    === '__ALL__' ? '' : montadoraSelect.value,
                        proprietario: proprietarioSelect.value === '__ALL__' ? '' : proprietarioSelect.value,
                    });
                    this.renderAll();
                };

                hotspot.onclick  = toggle;
                closeBtn.onclick = close;
                applyBtn.onclick = () => { applyFromUI(); close(); };
                clearBtn.onclick = () => { DataService.clearFilters(); this.refreshFiltersUI(); this.renderAll(); };
                if (uploadBtn) uploadBtn.onclick = () => { close(); this.openUploadOverlay(); };
                montadoraSelect.onchange    = applyFromUI;
                proprietarioSelect.onchange = applyFromUI;

                const applyTune = () => {
                    if (!tuneScale || !tuneOffsetY || !tuneWidth || !tuneHeight) return;
                    ViewportScale.setTune({
                        scalePct: Number(tuneScale.value),
                        offsetY: Number(tuneOffsetY.value),
                        widthPct: Number(tuneWidth.value),
                        heightPct: Number(tuneHeight.value),
                    });
                    if (tuneScaleVal)  tuneScaleVal.textContent  = `${ViewportScale.tune.scalePct}%`;
                    if (tuneOffsetYVal) tuneOffsetYVal.textContent = String(ViewportScale.tune.offsetY);
                    if (tuneWidthVal) tuneWidthVal.textContent = `${ViewportScale.tune.widthPct}%`;
                    if (tuneHeightVal) tuneHeightVal.textContent = `${ViewportScale.tune.heightPct}%`;
                };
                if (tuneScale)   tuneScale.addEventListener('input',  applyTune, { passive: true });
                if (tuneOffsetY) tuneOffsetY.addEventListener('input', applyTune, { passive: true });
                if (tuneWidth)   tuneWidth.addEventListener('input', applyTune, { passive: true });
                if (tuneHeight)  tuneHeight.addEventListener('input', applyTune, { passive: true });

                window.addEventListener('keydown', (e) => {
                    const key = (e.key || '').toLowerCase();
                    if (e.ctrlKey && e.shiftKey && key === 'f') { e.preventDefault(); toggle(); }
                    if (e.ctrlKey && e.shiftKey && key === 'h') {
                        e.preventDefault();
                        if (TV_MODE) {
                            try { window.parent?.postMessage({ type: 'avantrax:top_info_toggle' }, '*'); } catch (_) { TopInfoVisibility.toggle(); }
                        } else {
                            TopInfoVisibility.toggle();
                        }
                        return;
                    }
                    if (e.ctrlKey && e.shiftKey && key === 'p') {
                        e.preventDefault();
                        try { window.parent?.postMessage({ type: 'avantrax:manual_switch_open' }, '*'); } catch (_) {}
                    }
                    if (e.ctrlKey && e.shiftKey && key === 'g') {
                        e.preventDefault();
                        try { window.parent?.postMessage({ type: 'avantrax:manage_open' }, '*'); } catch (_) {}
                    }
                    if (e.ctrlKey && e.altKey) {
                        if (key === '-' || key === '_') { e.preventDefault(); ViewportScale.setTune({ scalePct: (ViewportScale.tune.scalePct ?? 100) - 2 }); if (panel.classList.contains('open')) open(); }
                        if (key === '=' || key === '+') { e.preventDefault(); ViewportScale.setTune({ scalePct: (ViewportScale.tune.scalePct ?? 100) + 2 }); if (panel.classList.contains('open')) open(); }
                        if (key === 'arrowup')   { e.preventDefault(); ViewportScale.setTune({ offsetY: (ViewportScale.tune.offsetY ?? 0) - 10 }); if (panel.classList.contains('open')) open(); }
                        if (key === 'arrowdown') { e.preventDefault(); ViewportScale.setTune({ offsetY: (ViewportScale.tune.offsetY ?? 0) + 10 }); if (panel.classList.contains('open')) open(); }
                    }
                    if (key === 'escape') close();
                });
            },

            refreshFiltersUI() {
                const { montadora, proprietario, has } = DataService.getFilterOptions();
                const montadoraRow    = document.getElementById('filter-row-montadora');
                const proprietarioRow = document.getElementById('filter-row-proprietario');
                const montadoraSelect    = document.getElementById('filter-montadora');
                const proprietarioSelect = document.getElementById('filter-proprietario');

                const fillSelect = (select, options, current, field) => {
                    const prev = current || '';
                    select.innerHTML = '';
                    const optAll = document.createElement('option');
                    optAll.value = '__ALL__'; optAll.textContent = 'Todos';
                    select.appendChild(optAll);
                    options.forEach(v => {
                        const o = document.createElement('option');
                        o.value = v; o.textContent = v;
                        select.appendChild(o);
                    });
                    if (!prev) { select.value = '__ALL__'; return; }
                    const found = options.includes(prev);
                    select.value = found ? prev : '__ALL__';
                    if (!found) {
                        DataService.setFilters({
                            montadora:    field === 'montadora'    ? '' : DataService.filters.montadora,
                            proprietario: field === 'proprietario' ? '' : DataService.filters.proprietario,
                        });
                    }
                };

                montadoraRow.style.display    = has.montadora    ? 'grid' : 'none';
                proprietarioRow.style.display = has.proprietario ? 'grid' : 'none';
                fillSelect(montadoraSelect,    montadora,    DataService.filters.montadora,    'montadora');
                fillSelect(proprietarioSelect, proprietario, DataService.filters.proprietario, 'proprietario');
            },

            enterFullscreen() {
                if (TV_MODE) return;
                if (document.documentElement.requestFullscreen) {
                    document.documentElement.requestFullscreen().catch(() => {});
                }
            },

            renderAll() {
                const stats = DataService.getStats();
                this.refreshFiltersUI();

                // KPIs
                this.animateValue('kpi-patio',      stats.totalPatio);
                this.animateValue('kpi-embarcados',  stats.totalEmbarcados);
                this.animateValue('kpi-aguardando',  stats.faturadosAguardando);
                this.animateValue('kpi-bloqueios',   stats.bloqueadosCount);
                document.getElementById('kpi-aging').textContent   = stats.agingPatioAvg + 'd';
                this.animateValue('kpi-transp',    stats.transportadoras);
                this.animateValue('kpi-criticos',  stats.criticos);
                this.animateValue('big-total-patio', stats.totalPatio);

                // Last Update
                const now = new Date();
                document.getElementById('last-update').textContent = `ÚLTIMA ATUALIZAÇÃO: ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
                const pLast = document.getElementById('presentation-last-update');
                if (pLast) pLast.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                const pEmb = document.getElementById('presentation-embarcados');
                if (pEmb) pEmb.textContent = Number(stats.totalEmbarcados || 0).toLocaleString('pt-BR');
                const pFat = document.getElementById('presentation-faturados');
                if (pFat) pFat.textContent = Number(stats.faturadosAguardando || 0).toLocaleString('pt-BR');
                const pAgu = document.getElementById('presentation-aguardando');
                if (pAgu) pAgu.textContent = Number(stats.faturadosAguardando || 0).toLocaleString('pt-BR');

                // Veículos Bloqueados — grid 2×2 com paginação
                const bloqueados = DataService.getFiltered('inventario')
                    .filter(i => i['MOTIVO BLOQUEIO'] && String(i['MOTIVO BLOQUEIO']).trim() !== '')
                    .sort((a,b) => (Number(b.AGING_PATIO)||0) - (Number(a.AGING_PATIO)||0));

                const totalBloq = Number(bloqueados.length || 0);
                const bloqBadge = document.getElementById('bloq-badge');
                if (bloqBadge) {
                    bloqBadge.textContent = `TOTAL ${totalBloq.toLocaleString('pt-BR')}`;
                    bloqBadge.title = `Total geral de bloqueados: ${totalBloq.toLocaleString('pt-BR')}`;
                }

                // Agrupa por motivo para pills
                const motivoMap = {};
                bloqueados.forEach(i => {
                    const m = String(i['MOTIVO BLOQUEIO']).trim();
                    motivoMap[m] = (motivoMap[m] || 0) + 1;
                });
                const motivosSorted = Object.entries(motivoMap).sort((a,b) => b[1]-a[1]);

                const motivoCores = [
                    { bg:'rgba(239,68,68,0.15)',  border:'rgba(239,68,68,0.35)',  text:'#EF4444' },
                    { bg:'rgba(245,158,11,0.15)', border:'rgba(245,158,11,0.35)', text:'#F59E0B' },
                    { bg:'rgba(139,92,246,0.15)', border:'rgba(139,92,246,0.35)', text:'#8B5CF6' },
                    { bg:'rgba(59,130,246,0.15)', border:'rgba(59,130,246,0.35)', text:'#3B82F6' },
                    { bg:'rgba(16,185,129,0.15)', border:'rgba(16,185,129,0.35)', text:'#10B981' },
                ];

                const motivoColorIndex = {};
                motivosSorted.forEach(([m], idx) => { motivoColorIndex[m] = motivoCores[idx % motivoCores.length]; });

                // Cards de resumo por motivo
                const motivosEl = document.getElementById('bloq-motivos');
                motivosEl.innerHTML = '';
                const totalCard = document.createElement('div');
                totalCard.style.cssText = `
                    display:flex;align-items:center;justify-content:space-between;gap:8px;
                    padding:6px 10px;border-radius:10px;
                    background:linear-gradient(180deg, rgba(0,191,255,0.16), rgba(0,191,255,0.08));
                    border:1px solid rgba(0,191,255,0.35);
                    font-size:0.64rem;font-weight:800;color:#8FE9FF;
                `;
                totalCard.innerHTML = `
                    <span style="display:inline-flex;align-items:center;gap:6px;min-width:0;">
                        <span style="width:6px;height:6px;border-radius:50%;background:#00BFFF;box-shadow:0 0 8px rgba(0,191,255,.45);flex-shrink:0;"></span>
                        <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">TOTAL GERAL</span>
                    </span>
                    <span style="padding:2px 8px;border-radius:999px;background:rgba(0,191,255,0.2);border:1px solid rgba(0,191,255,0.38);font-family:'JetBrains Mono',monospace;color:#E8F8FF;">${totalBloq.toLocaleString('pt-BR')}</span>
                `;
                motivosEl.appendChild(totalCard);

                motivosSorted.slice(0, 3).forEach(([motivo, count]) => {
                    const c = motivoColorIndex[motivo];
                    const card = document.createElement('div');
                    card.style.cssText = `
                        display:flex;align-items:center;justify-content:space-between;gap:8px;
                        padding:6px 10px;border-radius:10px;
                        background:${c.bg};
                        border:1px solid ${c.border};
                        font-size:0.64rem;font-weight:800;color:${c.text};
                    `;
                    card.innerHTML = `
                        <span style="display:inline-flex;align-items:center;gap:6px;min-width:0;">
                            <span style="width:6px;height:6px;border-radius:50%;background:${c.text};flex-shrink:0;"></span>
                            <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${motivo}</span>
                        </span>
                        <span style="padding:2px 8px;border-radius:999px;background:rgba(0,0,0,0.16);border:1px solid rgba(255,255,255,0.16);font-family:'JetBrains Mono',monospace;color:${c.text};">${Number(count || 0).toLocaleString('pt-BR')}</span>
                    `;
                    motivosEl.appendChild(card);
                });

                const getAgingColor = (aging) => {
                    if (aging > 180) return '#EF4444';
                    if (aging > 90)  return '#F59E0B';
                    return '#94A3B8';
                };

                const isPresentationMode = document.body.classList.contains('presentation-mode');
                const PER_PAGE = 4;

                const renderBloqPage = (page) => {
                    const grid = document.getElementById('bloq-grid');
                    grid.innerHTML = '';
                    const start = page * PER_PAGE;
                    const slice = bloqueados.slice(start, start + PER_PAGE);
                    const totalPages = Math.ceil(bloqueados.length / PER_PAGE);

                    slice.forEach(item => {
                        const motivo     = String(item['MOTIVO BLOQUEIO']).trim();
                        const aging      = Number(item.AGING_PATIO) || 0;
                        const chassi     = String(item.CHASSI || '---');
                        const modelo     = String(item.MODELO || '').substring(0, 16);
                        const c          = motivoColorIndex[motivo] || motivoCores[0];
                        const agingColor = getAgingColor(aging);

                        const card = document.createElement('div');
                        card.style.cssText = `
                            background: linear-gradient(180deg, rgba(20,34,68,0.34), rgba(15,23,42,0.22));
                            border: 1px solid rgba(255,255,255,0.08);
                            border-left: 3px solid ${c.text};
                            border-radius: 12px;
                            padding: 10px 12px;
                            display: flex;
                            flex-direction: column;
                            justify-content: space-between;
                            gap: 6px;
                            min-width: 0;
                            box-shadow: inset 0 0 0 1px rgba(255,255,255,0.02);
                        `;
                        card.innerHTML = `
                            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:6px;">
                                <div style="font-size:0.68rem; font-weight:800; color:#E0E6ED; font-family:'JetBrains Mono',monospace; letter-spacing:0.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1;">
                                    ${chassi}
                                </div>
                                <div style="text-align:right; flex-shrink:0;">
                                    <div style="font-size:0.85rem; font-weight:800; color:${agingColor}; font-family:'JetBrains Mono',monospace; line-height:1;">${aging}d</div>
                                    <div style="font-size:0.5rem; color:#475569; text-transform:uppercase; letter-spacing:0.5px;">aging</div>
                                </div>
                            </div>
                            ${modelo ? `<div style="font-size:0.6rem; color:#64748B; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${modelo}</div>` : ''}
                            <div style="display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:6px; background:${c.bg}; border:1px solid ${c.border}; align-self:flex-start; max-width:100%;">
                                <span style="width:4px; height:4px; border-radius:50%; background:${c.text}; flex-shrink:0;"></span>
                                <span style="font-size:0.58rem; font-weight:700; color:${c.text}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${motivo}</span>
                            </div>
                        `;
                        grid.appendChild(card);
                    });

                    // Paginação
                    const pageInfo = document.getElementById('bloq-page-info');
                    const prevBtn  = document.getElementById('bloq-prev');
                    const nextBtn  = document.getElementById('bloq-next');
                    const paginationEl = document.getElementById('bloq-pagination');

                    if (totalPages <= 1) {
                        paginationEl.style.display = 'none';
                    } else {
                        paginationEl.style.display = 'flex';
                        pageInfo.textContent = `${page + 1} / ${totalPages}`;
                        prevBtn.style.opacity = page === 0 ? '0.3' : '1';
                        prevBtn.style.pointerEvents = page === 0 ? 'none' : 'auto';
                        nextBtn.style.opacity = page === totalPages - 1 ? '0.3' : '1';
                        nextBtn.style.pointerEvents = page === totalPages - 1 ? 'none' : 'auto';
                    }
                };

                // Pager global com auto-rotação a cada 6s
                window.BloqPager = {
                    page: 0,
                    total: Math.ceil(bloqueados.length / PER_PAGE),
                    timer: null,
                    go(p) {
                        this.page = Math.max(0, Math.min(p, this.total - 1));
                        renderBloqPage(this.page);
                        this.resetTimer();
                    },
                    next() { this.go(this.page < this.total - 1 ? this.page + 1 : 0); },
                    prev() { this.go(this.page > 0 ? this.page - 1 : this.total - 1); },
                    resetTimer() {
                        if (this.timer) clearInterval(this.timer);
                        if (this.total > 1) {
                            this.timer = setInterval(() => this.next(), isPresentationMode ? 5000 : 6000);
                        }
                    }
                };
                window.BloqPager.page = 0;
                window.BloqPager.total = Math.ceil(bloqueados.length / PER_PAGE);
                renderBloqPage(0);
                window.BloqPager.resetTimer();

                // Depósitos
                const deps = { GMB: 0, '0KM': 0, FZD: 0 };
                DataService.getFiltered('inventario').forEach(i => { if (deps[i.DEP] !== undefined) deps[i.DEP]++; });
                ['GMB', '0KM', 'FZD'].forEach(d => {
                    const id = d.toLowerCase();
                    const val = deps[d];
                    const perc = stats.totalPatio > 0 ? (val / stats.totalPatio * 100) : 0;
                    document.getElementById(`bar-${id}`).style.width = perc + '%';
                    document.getElementById(`val-${id}`).textContent = val;
                });

                this.renderCharts(stats);
                try { PresentationDashboard.syncKPIs(stats); } catch (_) {}
            },

            animateValue(id, end) {
                const obj = document.getElementById(id);
                const duration = 1500;
                const startTime = performance.now();
                const update = (currentTime) => {
                    const elapsed  = currentTime - startTime;
                    const progress = Math.min(elapsed / duration, 1);
                    obj.textContent = Math.floor(progress * end).toLocaleString('pt-BR');
                    if (progress < 1) requestAnimationFrame(update);
                };
                requestAnimationFrame(update);
            },

            renderCharts(stats) {
                Object.values(this.charts).forEach(c => c.destroy());
                this.charts = {};

                const inventario = DataService.getFiltered('inventario');
                const embarcados = DataService.getFiltered('embarcados');

                const chartConfig = (type, labels, data, colors) => ({
                    type,
                    data: {
                        labels,
                        datasets: [{ data, backgroundColor: colors, borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1 }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: type === 'bar' ? {
                            y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94A3B8' } },
                            x: { grid: { display: false }, ticks: { color: '#94A3B8' } }
                        } : {}
                    }
                });

                // ─── 1. STATUS DE FATURAMENTO — DONUT DETALHADO ───
                const fatCount  = inventario.filter(i => i.STAT_FAT === 'FATURADO').length;
                const nfatCount = inventario.filter(i => i.STAT_FAT === 'NAO FATURADO').length;
                const total     = fatCount + nfatCount;
                const pctFat    = total > 0 ? Math.round((fatCount / total) * 100) : 0;
                const pctNfat   = 100 - pctFat;

                // Atualiza centro do donut
                document.getElementById('fat-pct-center').textContent = pctFat + '%';

                // Atualiza barras laterais
                document.getElementById('fat-num-fat').textContent  = fatCount.toLocaleString('pt-BR');
                document.getElementById('fat-num-nfat').textContent = nfatCount.toLocaleString('pt-BR');
                document.getElementById('fat-sub-fat').textContent  = 'Aguardando Expedição';
                document.getElementById('fat-sub-nfat').textContent = 'Aguardando Faturamento';

                // Anima barras com pequeno delay para fluidez
                setTimeout(() => {
                    document.getElementById('fat-bar-fat').style.width  = pctFat  + '%';
                    document.getElementById('fat-bar-nfat').style.width = pctNfat + '%';
                }, 120);

                // Faturamento do dia atual — coluna DT_FAT (col G do inventário)
                const hoje = new Date();
                const diaHoje = hoje.getDate();
                const mesHoje = hoje.getMonth();
                const anoHoje = hoje.getFullYear();

                const excelSerialToDate = (serial) => {
                    // Excel: dia 1 = 01/01/1900, mas tem o bug do ano bissexto de 1900
                    const utc = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
                    return utc;
                };

                const fatHoje = inventario.filter(i => {
                    const raw = i.DT_FAT;
                    if (raw === undefined || raw === null || raw === '') return false;
                    let d;
                    if (typeof raw === 'number') {
                        d = excelSerialToDate(raw);
                    } else {
                        // Texto: tenta DD/MM/AAAA e ISO
                        const parts = String(raw).split('/');
                        if (parts.length === 3) {
                            d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
                        } else {
                            d = new Date(raw);
                        }
                    }
                    if (!d || isNaN(d.getTime())) return false;
                    return d.getUTCDate() === diaHoje && d.getUTCMonth() === mesHoje && d.getUTCFullYear() === anoHoje;
                }).length;

                const fatTodayEl = document.getElementById('fat-today-val');
                fatTodayEl.textContent = `+${fatHoje.toLocaleString('pt-BR')} unidade${fatHoje !== 1 ? 's' : ''}`;

                // Donut Chart
                this.charts.statFat = new Chart(document.getElementById('chart-stat-fat'), {
                    type: 'doughnut',
                    data: {
                        labels: ['Faturado', 'Não Faturado'],
                        datasets: [{
                            data: [fatCount, nfatCount],
                            backgroundColor: ['#10B981', 'rgba(30,41,59,0.9)'],
                            borderColor:     ['rgba(16,185,129,0.42)', 'rgba(255,255,255,0.04)'],
                            borderWidth: [2, 1],
                            hoverOffset: 4,
                        }]
                    },
                    options: {
                        cutout: '74%',
                        responsive: false,
                        animation: { animateRotate: true, duration: 1200, easing: 'easeInOutQuart' },
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                callbacks: {
                                    label: (ctx) => {
                                        const v = ctx.parsed;
                                        const pct = total > 0 ? Math.round(v / total * 100) : 0;
                                        return ` ${ctx.label}: ${v.toLocaleString('pt-BR')} (${pct}%)`;
                                    }
                                },
                                backgroundColor: 'rgba(10,15,30,0.95)',
                                borderColor:  'rgba(16,185,129,0.28)',
                                borderWidth:  1,
                                titleColor:   '#10B981',
                                bodyColor:    '#E0E6ED',
                                padding:      10,
                            }
                        }
                    }
                });
                // ──────────────────────────────────────────────────

                // 2. Top 5 Modelos Pátio — rank visual com barras HTML
                const modelosMap = {};
                inventario.forEach(i => { if (i.MODELO) modelosMap[i.MODELO] = (modelosMap[i.MODELO] || 0) + 1; });
                const topModelos   = Object.entries(modelosMap).sort((a,b) => b[1]-a[1]).slice(0, 5);
                const totalModelos = Object.keys(modelosMap).length;
                const maxModelo    = topModelos.length > 0 ? topModelos[0][1] : 1;

                document.getElementById('modelos-total-badge').textContent = `${totalModelos} modelos`;

                const modeloColors = ['#00BFFF','#0099E6','#0077CC','#0055AA','#003D88'];
                const rankSymbols  = ['①','②','③','④','⑤'];

                const listEl = document.getElementById('modelos-list');
                listEl.innerHTML = '';
                topModelos.forEach(([nome, qtd], idx) => {
                    const pct = Math.round((qtd / maxModelo) * 100);
                    const pctTotal = stats.totalPatio > 0 ? Math.round((qtd / stats.totalPatio) * 100) : 0;
                    const color = modeloColors[idx] || '#00BFFF';

                    const row = document.createElement('div');
                    row.style.cssText = 'display:flex; align-items:center; gap:10px;';

                    row.innerHTML = `
                        <div style="width:20px; font-size:0.75rem; font-weight:800; color:${color}; text-align:center; flex-shrink:0;">${rankSymbols[idx]}</div>
                        <div style="flex:1; min-width:0;">
                            <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:4px;">
                                <span style="font-size:0.72rem; font-weight:700; color:#E0E6ED; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:160px;">${nome}</span>
                                <span style="font-size:0.72rem; font-family:'JetBrains Mono',monospace; font-weight:800; color:${color}; margin-left:8px; flex-shrink:0;">${qtd.toLocaleString('pt-BR')}</span>
                            </div>
                            <div style="height:6px; background:rgba(255,255,255,0.06); border-radius:6px; overflow:hidden; position:relative;">
                                <div class="_mbar" data-w="${pct}" style="height:100%; width:0%; background:${color}; border-radius:6px; opacity:0.85; transition:width 1s cubic-bezier(.16,1,.3,1);"></div>
                            </div>
                        </div>
                        <div style="width:36px; font-size:0.65rem; color:#64748B; text-align:right; flex-shrink:0;">${pctTotal}%</div>
                    `;
                    listEl.appendChild(row);
                });

                // Anima barras após render
                setTimeout(() => {
                    document.querySelectorAll('._mbar').forEach(el => {
                        el.style.width = el.dataset.w + '%';
                    });
                }, 80);

                // 3. Heatmap de Aging — render HTML detalhado
                const agingBands = [
                    { label: '0 – 7d',   key: 'fresh',    min: 0,   max: 7,   color: '#10B981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.3)',  icon: '●', desc: 'Recém chegados' },
                    { label: '8 – 30d',  key: 'normal',   min: 8,   max: 30,  color: '#3B82F6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.3)',  icon: '●', desc: 'Em movimentação' },
                    { label: '31 – 90d', key: 'atencao',  min: 31,  max: 90,  color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)',  icon: '▲', desc: 'Atenção' },
                    { label: '> 90d',    key: 'critico',  min: 91,  max: Infinity, color: '#EF4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', icon: '■', desc: 'Crítico' },
                ];

                const agingCounts = agingBands.map(b => ({
                    ...b,
                    count: inventario.filter(i => {
                        const a = Number(i.AGING_PATIO) || 0;
                        return a >= b.min && a <= b.max;
                    }).length
                }));

                const maxAgingCount = Math.max(...agingCounts.map(b => b.count), 1);
                const totalAgingVeic = agingCounts.reduce((s, b) => s + b.count, 0);
                const avgAging = stats.agingPatioAvg;

                document.getElementById('aging-avg-badge').textContent = `avg ${avgAging}d`;

                // Faixas
                const bandsEl = document.getElementById('aging-bands');
                bandsEl.innerHTML = '';
                agingCounts.forEach(b => {
                    const pct    = Math.round((b.count / maxAgingCount) * 100);
                    const pctTot = totalAgingVeic > 0 ? Math.round((b.count / totalAgingVeic) * 100) : 0;
                    const presentationModeActive = document.body.classList.contains('presentation-mode');
                    const labelWidth = presentationModeActive ? 168 : 60;
                    const labelFontSize = presentationModeActive ? '1.85rem' : '0.68rem';
                    const labelHtml = presentationModeActive
                        ? `<div class="aging-band-main" style="font-size:${labelFontSize}; font-weight:900; color:${b.color}; font-family:'JetBrains Mono',monospace; letter-spacing:0.3px;">${b.label}</div>`
                        : `
                            <div class="aging-band-main" style="font-size:${labelFontSize}; font-weight:800; color:${b.color}; font-family:'JetBrains Mono',monospace;">${b.label}</div>
                            <div class="aging-band-desc" style="font-size:0.55rem; color:#475569; margin-top:1px;">${b.desc}</div>
                          `;

                    const row = document.createElement('div');
                    row.style.cssText = 'display:flex; align-items:center; gap:10px;';
                    row.innerHTML = `
                        <!-- Faixa label -->
                        <div style="width:${labelWidth}px; flex-shrink:0; text-align:right;">
                            ${labelHtml}
                        </div>

                        <!-- Barra com segmento e glow -->
                        <div style="flex:1; position:relative;">
                            <div style="height:22px; background:rgba(255,255,255,0.04); border-radius:6px; overflow:hidden; border:1px solid rgba(255,255,255,0.05);">
                                <div class="_abar" data-w="${pct}" style="
                                    height:100%; width:0%;
                                    background: linear-gradient(90deg, ${b.color}CC, ${b.color});
                                    border-radius:6px;
                                    transition: width 1.1s cubic-bezier(.16,1,.3,1);
                                    box-shadow: 0 0 10px ${b.color}55;
                                    position:relative;
                                ">
                                    <!-- Shimmer interno -->
                                    <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(90deg,transparent 60%,rgba(255,255,255,0.12));border-radius:6px;"></div>
                                </div>
                            </div>
                        </div>

                        <!-- Valor + % -->
                        <div style="width:72px; flex-shrink:0; display:flex; align-items:baseline; gap:5px; justify-content:flex-end;">
                            <span style="font-size:0.9rem; font-weight:800; color:${b.color}; font-family:'JetBrains Mono',monospace;">${b.count.toLocaleString('pt-BR')}</span>
                            <span style="font-size:0.6rem; color:#475569; font-weight:600;">${pctTot}%</span>
                        </div>
                    `;
                    bandsEl.appendChild(row);
                });

                // Anima barras
                setTimeout(() => {
                    document.querySelectorAll('._abar').forEach(el => {
                        el.style.width = el.dataset.w + '%';
                    });
                }, 100);

                // Footer: mini KPIs de aging
                const agingFooterEl = document.getElementById('aging-footer');
                agingFooterEl.innerHTML = '';
                const footerItems = [
                    { label: 'Frescos ≤7d',  val: agingCounts[0].count.toLocaleString('pt-BR'), color: '#10B981' },
                    { label: 'Em fluxo',      val: agingCounts[1].count.toLocaleString('pt-BR'), color: '#3B82F6' },
                    { label: 'Atenção',       val: agingCounts[2].count.toLocaleString('pt-BR'), color: '#F59E0B' },
                    { label: 'Críticos +90d', val: agingCounts[3].count.toLocaleString('pt-BR'), color: '#EF4444' },
                ];
                footerItems.forEach(fi => {
                    const div = document.createElement('div');
                    div.style.cssText = `flex:1; text-align:center; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:8px; padding:5px 4px;`;
                    div.innerHTML = `
                        <div style="font-size:0.85rem; font-weight:800; color:${fi.color}; font-family:'JetBrains Mono',monospace; line-height:1;">${fi.val}</div>
                        <div style="font-size:0.55rem; color:#475569; text-transform:uppercase; letter-spacing:0.5px; margin-top:3px;">${fi.label}</div>
                    `;
                    agingFooterEl.appendChild(div);
                });

                // 4. Top 5 Transportadoras — dados do INVENTÁRIO DE PÁTIO
                const transpsMap = {};
                DataService.getFiltered('inventario').forEach(i => {
                    const nome = String(i['NOME TRANSPORTADORA'] || i['TRANSPORTADORA'] || i['TRANSP'] || '').trim();
                    if (nome) transpsMap[nome] = (transpsMap[nome] || 0) + 1;
                });
                const totalTransp    = Object.keys(transpsMap).length;
                const topTransp      = Object.entries(transpsMap).sort((a,b) => b[1]-a[1]).slice(0, 5);
                const maxTranspCount = topTransp.length > 0 ? topTransp[0][1] : 1;
                const totalInvTransp = DataService.getFiltered('inventario').length;

                document.getElementById('transp-total-badge').textContent = `${totalTransp} transp.`;

                const transpColorMap = {
                    TEGMA: '#F59E0B',
                    JSL: '#EF4444',
                    TRANSZERO: '#22C55E',
                    BRAZUL: '#1E3A8A',
                    TRANSAUTO: '#38BDF8'
                };
                const transpColors = ['#007BFF','#0099E6','#00BFFF','#3B82F6','#60A5FA'];
                const transpRanks  = ['①','②','③','④','⑤'];

                const transpListEl = document.getElementById('transp-list');
                transpListEl.innerHTML = '';

                topTransp.forEach(([nome, qtd], idx) => {
                    const pctBar  = Math.round((qtd / maxTranspCount) * 100);
                    const pctTot  = totalInvTransp > 0 ? Math.round((qtd / totalInvTransp) * 100) : 0;
                    const normalizedNome = String(nome || '').trim().toUpperCase();
                    const color   = transpColorMap[normalizedNome] || transpColors[idx] || '#007BFF';
                    // Abrevia nome longo mantendo legível
                    const nomeExib = nome.length > 22 ? nome.substring(0, 20) + '…' : nome;

                    const row = document.createElement('div');
                    row.style.cssText = 'display:flex; align-items:center; gap:10px;';
                    row.innerHTML = `
                        <div style="width:20px; font-size:0.75rem; font-weight:800; color:${color}; text-align:center; flex-shrink:0; line-height:1;">${transpRanks[idx]}</div>
                        <div style="flex:1; min-width:0;">
                            <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:4px;">
                                <span style="font-size:0.68rem; font-weight:700; color:#E0E6ED; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:170px;" title="${nome}">${nomeExib}</span>
                                <span style="font-size:0.72rem; font-family:'JetBrains Mono',monospace; font-weight:800; color:${color}; margin-left:8px; flex-shrink:0;">${qtd.toLocaleString('pt-BR')}</span>
                            </div>
                            <div style="height:6px; background:rgba(255,255,255,0.06); border-radius:6px; overflow:hidden;">
                                <div class="_tbar" data-w="${pctBar}" style="height:100%; width:0%;
                                    background: linear-gradient(90deg, ${color}88, ${color});
                                    border-radius:6px;
                                    box-shadow: 0 0 8px ${color}55;
                                    transition: width 1s cubic-bezier(.16,1,.3,1);
                                "></div>
                            </div>
                        </div>
                        <div style="width:36px; font-size:0.62rem; color:#64748B; text-align:right; flex-shrink:0; font-family:'JetBrains Mono',monospace;">${pctTot}%</div>
                    `;
                    transpListEl.appendChild(row);
                });

                setTimeout(() => {
                    document.querySelectorAll('._tbar').forEach(el => {
                        el.style.width = el.dataset.w + '%';
                    });
                }, 80);

                // 5. Distribuição TP Venda — tudo vem do INVENTÁRIO DE PÁTIO
                // VD  → TP_VENDA (col AE) = 'VD'
                // TD  → TP_VENDA (col AE) = 'TD'
                // PDI → STAT_FAT = 'FATURADO'
                //       + LOCAL_ENTREGA (col W) = GRAVATAÍ-RS (com ou sem acento)
                //       + DESC_CLIENTE (col V) NÃO contém SINOSCAR

                const normalizeStr = (s) => String(s || '').trim().toUpperCase()
                    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

                const invFiltrado = DataService.getFiltered('inventario');

                let vdCount = 0, tdCount = 0, pdiCount = 0;

                invFiltrado.forEach(row => {
                    const tp      = normalizeStr(row.TP_VENDA);
                    const local   = normalizeStr(row.LOCAL_ENTREGA);
                    const cliente = normalizeStr(row.DESC_CLIENTE);
                    const fat     = normalizeStr(row.STAT_FAT);

                    // PDI: faturado + Gravataí + não Sinoscar
                    const isGravatai = local === 'GRAVATAI-RS';
                    const isSinoscar = cliente.includes('SINOSCAR');
                    const isFaturado = fat === 'NAO FATURADO' ? false : fat === 'FATURADO';

                    if (isFaturado && isGravatai && !isSinoscar) {
                        pdiCount++;
                    } else if (tp === 'VD') {
                        vdCount++;
                    } else if (tp === 'TD') {
                        tdCount++;
                    }
                });

                const tpTotal  = vdCount + tdCount + pdiCount;
                const tpVdPct  = tpTotal > 0 ? Math.round((vdCount  / tpTotal) * 100) : 0;
                const tpTdPct  = tpTotal > 0 ? Math.round((tdCount  / tpTotal) * 100) : 0;
                const tpPdiPct = tpTotal > 0 ? Math.round((pdiCount / tpTotal) * 100) : 0;

                document.getElementById('tp-total-badge').textContent  = `${tpTotal.toLocaleString('pt-BR')} veíc.`;
                document.getElementById('tp-vd-num').textContent       = vdCount.toLocaleString('pt-BR');
                document.getElementById('tp-td-num').textContent       = tdCount.toLocaleString('pt-BR');
                document.getElementById('tp-pdi-num').textContent      = pdiCount.toLocaleString('pt-BR');
                document.getElementById('tp-vd-pct').textContent       = `${tpVdPct}% do total`;
                document.getElementById('tp-td-pct').textContent       = `${tpTdPct}% do total`;
                document.getElementById('tp-pdi-pct').textContent      = `${tpPdiPct}% do total`;

                setTimeout(() => {
                    document.getElementById('tp-vd-bar').style.width  = tpVdPct  + '%';
                    document.getElementById('tp-td-bar').style.width  = tpTdPct  + '%';
                    document.getElementById('tp-pdi-bar').style.width = tpPdiPct + '%';
                }, 120);

                // Rodapé com 4 mini-KPIs
                const tpFooterEl = document.getElementById('tp-footer');
                tpFooterEl.innerHTML = '';
                [
                    { label: 'Venda Direta', val: vdCount.toLocaleString('pt-BR'),  pct: tpVdPct  + '%', color: '#00E5FF' },
                    { label: 'TD',           val: tdCount.toLocaleString('pt-BR'),  pct: tpTdPct  + '%', color: '#007BFF' },
                    { label: 'VD (PDI)',      val: pdiCount.toLocaleString('pt-BR'), pct: tpPdiPct + '%', color: '#10B981' },
                    { label: 'Total',         val: tpTotal.toLocaleString('pt-BR'),  pct: '100%',          color: '#94A3B8' },
                ].forEach(fi => {
                    const div = document.createElement('div');
                    div.style.cssText = `flex:1; text-align:center; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:8px; padding:5px 3px;`;
                    div.innerHTML = `
                        <div style="font-size:0.78rem; font-weight:800; color:${fi.color}; font-family:'JetBrains Mono',monospace; line-height:1;">${fi.val}</div>
                        <div style="font-size:0.48rem; color:#475569; text-transform:uppercase; letter-spacing:0.5px; margin-top:3px;">${fi.label}</div>
                        <div style="font-size:0.55rem; color:${fi.color}; opacity:0.7; margin-top:1px;">${fi.pct}</div>
                    `;
                    tpFooterEl.appendChild(div);
                });

                // Donut com 3 fatias — responsive:true dentro de wrapper 120×120 fixo
                if (this.charts.tpVenda) this.charts.tpVenda.destroy();
                this.charts.tpVenda = new Chart(document.getElementById('chart-tp-venda'), {
                    type: 'doughnut',
                    data: {
                        labels: ['Venda Direta (VD)', 'TD', 'VD (PDI)'],
                        datasets: [{
                            data: [vdCount, tdCount, pdiCount],
                            backgroundColor: ['#00E5FF', '#007BFF', '#10B981'],
                            borderColor: ['rgba(0,229,255,0.3)', 'rgba(0,123,255,0.2)', 'rgba(16,185,129,0.3)'],
                            borderWidth: [1.5, 1, 1.5],
                            hoverOffset: 4,
                        }]
                    },
                    options: {
                        cutout: '72%',
                        responsive: true,
                        maintainAspectRatio: true,
                        animation: { animateRotate: true, duration: 1200, easing: 'easeInOutQuart' },
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                callbacks: {
                                    label: (ctx) => {
                                        const v = ctx.parsed;
                                        const p = tpTotal > 0 ? Math.round(v / tpTotal * 100) : 0;
                                        return ` ${ctx.label}: ${v.toLocaleString('pt-BR')} (${p}%)`;
                                    }
                                },
                                backgroundColor: 'rgba(10,15,30,0.95)',
                                borderColor: 'rgba(0,191,255,0.25)',
                                borderWidth: 1,
                                titleColor: '#00BFFF',
                                bodyColor: '#E0E6ED',
                                padding: 10,
                            }
                        }
                    }
                });

                // Loop rotativo no centro do donut: VD → TD → PDI → VD …
                if (window._tpDonutTimer) clearInterval(window._tpDonutTimer);
                const tpSlides = [
                    { pct: tpVdPct,  label: 'VD',       color: '#00E5FF' },
                    { pct: tpTdPct,  label: 'TD',        color: '#007BFF' },
                    { pct: tpPdiPct, label: 'VD (PDI)',   color: '#10B981' },
                ];
                let tpSlideIdx = 0;

                const tpDonutValEl = document.getElementById('tp-donut-val');
                const tpDonutLblEl = document.getElementById('tp-donut-lbl');

                const showTpSlide = (idx) => {
                    const s = tpSlides[idx];
                    // Fade out
                    tpDonutValEl.style.opacity = '0';
                    tpDonutLblEl.style.opacity = '0';
                    setTimeout(() => {
                        tpDonutValEl.textContent  = s.pct + '%';
                        tpDonutValEl.style.color  = s.color;
                        tpDonutLblEl.textContent  = s.label;
                        tpDonutLblEl.style.color  = s.color;
                        // Fade in
                        tpDonutValEl.style.opacity = '1';
                        tpDonutLblEl.style.opacity = '1';
                    }, 420);
                };

                // Exibe o primeiro imediatamente
                showTpSlide(0);

                // Rotaciona a cada 2.5s
                window._tpDonutTimer = setInterval(() => {
                    tpSlideIdx = (tpSlideIdx + 1) % tpSlides.length;
                    showTpSlide(tpSlideIdx);
                }, 2500);

                // 6. Aging Embarcados — render HTML detalhado
                const embBands = [
                    { label: '0 – 5d',   min: 0,  max: 5,        color: '#00BFFF', bg: 'rgba(0,191,255,0.12)',   border: 'rgba(0,191,255,0.3)',   desc: 'Em trânsito normal' },
                    { label: '6 – 15d',  min: 6,  max: 15,       color: '#3B82F6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.3)',  desc: 'Atenção ao prazo' },
                    { label: '16 – 30d', min: 16, max: 30,       color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)',  desc: 'Prazo estourado' },
                    { label: '> 30d',    min: 31, max: Infinity,  color: '#EF4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.3)',  desc: 'Crítico' },
                ];

                const parseDataExpedicao = (v) => {
                    if (v === undefined || v === null || v === '') return null;
                    if (typeof v === 'number') {
                        return new Date(Date.UTC(1899, 11, 30) + v * 86400000);
                    }
                    const s = String(v).trim();
                    const brMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
                    if (brMatch) {
                        return new Date(Number(brMatch[3]), Number(brMatch[2]) - 1, Number(brMatch[1]));
                    }
                    const d = new Date(s);
                    return isNaN(d.getTime()) ? null : d;
                };

                const hojeEmb = new Date();
                const diaEmb = hojeEmb.getDate();
                const mesEmb = hojeEmb.getMonth();
                const anoEmb = hojeEmb.getFullYear();

                const embarcadosHoje = embarcados.filter(e => {
                    const raw = e['DATA EXPEDIÇÃO']
                        ?? e['DATA EXPEDICAO']
                        ?? e['DT_EXPEDICAO']
                        ?? e['DT EXPEDICAO']
                        ?? e['DATA_EXPEDICAO']
                        ?? e['DT EXPEDIÇÃO']
                        ?? e['DT_EXPEDIÇÃO'];
                    const d = parseDataExpedicao(raw);
                    if (!d) return false;
                    const useUTC = typeof raw === 'number';
                    const dia = useUTC ? d.getUTCDate() : d.getDate();
                    const mes = useUTC ? d.getUTCMonth() : d.getMonth();
                    const ano = useUTC ? d.getUTCFullYear() : d.getFullYear();
                    return dia === diaEmb && mes === mesEmb && ano === anoEmb;
                });

                const embCounts = embBands.map(b => ({
                    ...b,
                    count: embarcadosHoje.filter(e => {
                        const a = Number(e.AGING) || 0;
                        return a >= b.min && a <= b.max;
                    }).length
                }));

                const maxEmbCount   = Math.max(...embCounts.map(b => b.count), 1);
                const totalEmbAging = embCounts.reduce((s, b) => s + b.count, 0);

                // Calcula aging médio dos embarcados
                const embAgingSum = embarcadosHoje.reduce((acc, e) => acc + (Number(e.AGING) || 0), 0);
                const embAgingAvg = embarcadosHoje.length > 0 ? (embAgingSum / embarcadosHoje.length).toFixed(1) : 0;
                document.getElementById('emb-avg-badge').textContent = `avg ${embAgingAvg}d`;

                // Faixas
                const embBandsEl = document.getElementById('emb-aging-bands');
                embBandsEl.innerHTML = '';
                embCounts.forEach(b => {
                    const pct    = Math.round((b.count / maxEmbCount) * 100);
                    const pctTot = totalEmbAging > 0 ? Math.round((b.count / totalEmbAging) * 100) : 0;
                    const presentationModeActive = document.body.classList.contains('presentation-mode');
                    const labelWidth = presentationModeActive ? 168 : 60;
                    const labelFontSize = presentationModeActive ? '1.85rem' : '0.68rem';
                    const labelHtml = presentationModeActive
                        ? `<div class="aging-band-main" style="font-size:${labelFontSize}; font-weight:900; color:${b.color}; font-family:'JetBrains Mono',monospace; letter-spacing:0.3px;">${b.label}</div>`
                        : `
                            <div class="aging-band-main" style="font-size:${labelFontSize}; font-weight:800; color:${b.color}; font-family:'JetBrains Mono',monospace;">${b.label}</div>
                            <div class="aging-band-desc" style="font-size:0.55rem; color:#475569; margin-top:1px;">${b.desc}</div>
                          `;

                    const row = document.createElement('div');
                    row.style.cssText = 'display:flex; align-items:center; gap:10px;';
                    row.innerHTML = `
                        <div style="width:${labelWidth}px; flex-shrink:0; text-align:right;">
                            ${labelHtml}
                        </div>
                        <div style="flex:1; position:relative;">
                            <div style="height:22px; background:rgba(255,255,255,0.04); border-radius:6px; overflow:hidden; border:1px solid rgba(255,255,255,0.05);">
                                <div class="_ebar" data-w="${pct}" style="
                                    height:100%; width:0%;
                                    background: linear-gradient(90deg, ${b.color}BB, ${b.color});
                                    border-radius:6px;
                                    transition: width 1.1s cubic-bezier(.16,1,.3,1);
                                    box-shadow: 0 0 10px ${b.color}55;
                                    position:relative;
                                ">
                                    <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(90deg,transparent 60%,rgba(255,255,255,0.12));border-radius:6px;"></div>
                                </div>
                            </div>
                        </div>
                        <div style="width:72px; flex-shrink:0; display:flex; align-items:baseline; gap:5px; justify-content:flex-end;">
                            <span style="font-size:0.9rem; font-weight:800; color:${b.color}; font-family:'JetBrains Mono',monospace;">${b.count.toLocaleString('pt-BR')}</span>
                            <span style="font-size:0.6rem; color:#475569; font-weight:600;">${pctTot}%</span>
                        </div>
                    `;
                    embBandsEl.appendChild(row);
                });

                setTimeout(() => {
                    document.querySelectorAll('._ebar').forEach(el => {
                        el.style.width = el.dataset.w + '%';
                    });
                }, 100);

                // Footer mini-KPIs
                const embFooterEl = document.getElementById('emb-aging-footer');
                embFooterEl.innerHTML = '';
                const embFooterItems = [
                    { label: 'Normal ≤5d',  val: embCounts[0].count.toLocaleString('pt-BR'), color: '#00BFFF' },
                    { label: 'Atenção',      val: embCounts[1].count.toLocaleString('pt-BR'), color: '#3B82F6' },
                    { label: 'Estourado',    val: embCounts[2].count.toLocaleString('pt-BR'), color: '#F59E0B' },
                    { label: 'Crítico +30d', val: embCounts[3].count.toLocaleString('pt-BR'), color: '#EF4444' },
                ];
                embFooterItems.forEach(fi => {
                    const div = document.createElement('div');
                    div.style.cssText = `flex:1; text-align:center; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:8px; padding:5px 4px;`;
                    div.innerHTML = `
                        <div style="font-size:0.85rem; font-weight:800; color:${fi.color}; font-family:'JetBrains Mono',monospace; line-height:1;">${fi.val}</div>
                        <div style="font-size:0.55rem; color:#475569; text-transform:uppercase; letter-spacing:0.5px; margin-top:3px;">${fi.label}</div>
                    `;
                    embFooterEl.appendChild(div);
                });
            }
        };

        const Animations = {
            init() {
                const canvas = document.getElementById('particles-canvas');
                const ctx = canvas.getContext('2d');
                const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
                window.onresize = resize;
                resize();

                class Particle {
                    constructor() {
                        this.x = Math.random() * canvas.width;
                        this.y = Math.random() * canvas.height;
                        this.size   = Math.random() * 2 + 1;
                        this.speedX = Math.random() * 1 - 0.5;
                        this.speedY = Math.random() * 1 - 0.5;
                    }
                    update() {
                        this.x += this.speedX; this.y += this.speedY;
                        if (this.x > canvas.width)  this.x = 0;
                        if (this.x < 0) this.x = canvas.width;
                        if (this.y > canvas.height) this.y = 0;
                        if (this.y < 0) this.y = canvas.height;
                    }
                    draw() {
                        ctx.fillStyle = '#00BFFF';
                        ctx.beginPath();
                        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }

                const particles = Array.from({ length: 100 }, () => new Particle());
                const animate = () => {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    particles.forEach(p => { p.update(); p.draw(); });
                    requestAnimationFrame(animate);
                };
                animate();
            }
        };

        const PresentationDashboard = {
            storageKey: 'AVANTRAX_PRESENTATION_MODE',
            enabled: false,
            paused: false,
            groupIndex: 0,
            rotateMs: 15000,
            timer: 0,
            groups: [
                { label: '1/4 · Status faturamento + Top transportadoras', cards: ['status-fat', 'top-transportadoras'] },
                { label: '2/4 · TP venda + Heatmap aging', cards: ['tp-venda', 'aging-patio'] },
                { label: '3/4 · Veículos bloqueados + Aging embarcados', cards: ['bloqueados', 'aging-embarcados'] },
                { label: '4/4 - Top modelos + Descargas de importados', cards: ['top-modelos', 'veiculos-criticos'] },
            ],
            cardMap: {},
            leftCard: null,
            criticalCard: null,
            _boundKey: null,

            init() {
                this.bindButton();
                this.captureCards();
                this.ensureCriticalCard();
                const existingCrit = Number(String(document.getElementById('kpi-criticos')?.textContent || '0').replace(/[^\d]/g, '')) || 0;
                this.syncKPIs({ criticos: existingCrit });
                this.bindKeys();
                if (this.readPersisted()) this.enable();
                else this.updateBadge();
            },

            bindButton() {
                const btn = document.getElementById('presentation-toggle-btn');
                if (!btn) return;
                btn.addEventListener('click', () => this.toggle());
            },

            bindKeys() {
                if (this._boundKey) return;
                this._boundKey = (e) => {
                    const key = String(e.key || '').toLowerCase();
                    const tag = String(e.target?.tagName || '').toLowerCase();
                    const isInput = tag === 'input' || tag === 'textarea' || tag === 'select';

                    if (key === 'f2') {
                        e.preventDefault();
                        this.toggle();
                        return;
                    }
                    if (!this.enabled) return;
                    if (key === 'escape') {
                        e.preventDefault();
                        this.disable();
                        return;
                    }
                    if (key === 'arrowright') {
                        e.preventDefault();
                        this.nextGroup(true);
                        return;
                    }
                    if (key === 'arrowleft') {
                        e.preventDefault();
                        this.prevGroup(true);
                        return;
                    }
                    if (key === ' ' && !isInput) {
                        e.preventDefault();
                        this.togglePause();
                    }
                };
                window.addEventListener('keydown', this._boundKey, true);
            },

            captureCards() {
                const all = Array.from(document.querySelectorAll('[data-presentation-card]'));
                this.cardMap = {};
                all.forEach((el) => { this.cardMap[el.dataset.presentationCard] = el; });
                this.leftCard = this.cardMap['center-total'] || null;
            },
            ensureCriticalCard() {
                if (this.criticalCard) return;
                const grid = document.querySelector('.main-grid');
                if (!grid) return;
                const card = document.createElement('div');
                card.className = 'card';
                card.dataset.presentationCard = 'veiculos-criticos';
                card.style.display = 'none';
                card.innerHTML = `
                    <div class="card-header">
                        <span class="card-title">Descargas de Importados</span>
                        <span id="presentation-importados-badge" style="font-size:0.7rem; padding:4px 10px; border-radius:999px; background:rgba(56,189,248,0.12); border:1px solid rgba(56,189,248,0.35); color:#67E8F9; font-weight:800; font-family:'JetBrains Mono',monospace;">7 dias</span>
                    </div>
                    <div id="presentation-importados-list" style="display:flex; flex-direction:column; gap:9px; flex:1; justify-content:center;"></div>
                    <div id="presentation-importados-footer" style="margin-top:10px; padding-top:10px; border-top:1px solid rgba(255,255,255,0.08); font-size:0.8rem; color:#9FB4D1; letter-spacing:0.4px;">
                        Base: inventario de patio - sufixo CEGONHA
                    </div>
                `.trim();
                grid.appendChild(card);
                this.criticalCard = card;
                this.cardMap['veiculos-criticos'] = card;
            },

            normalizeText(value) {
                return String(value || '')
                    .trim()
                    .toUpperCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '');
            },

            parseCreationDate(raw) {
                if (raw === undefined || raw === null || raw === '') return null;
                if (typeof raw === 'number' && Number.isFinite(raw)) {
                    const utc = new Date(Date.UTC(1899, 11, 30) + raw * 86400000);
                    if (isNaN(utc.getTime())) return null;
                    return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
                }
                const text = String(raw).trim();
                const br = text.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
                if (br) {
                    const d = Number(br[1]);
                    const m = Number(br[2]) - 1;
                    const y = br[3].length === 2 ? 2000 + Number(br[3]) : Number(br[3]);
                    const out = new Date(y, m, d);
                    return isNaN(out.getTime()) ? null : out;
                }
                const parsed = new Date(text);
                if (isNaN(parsed.getTime())) return null;
                return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
            },

            getImportadoBucket(modelo) {
                const m = this.normalizeText(modelo);
                if (!m) return '';
                if (m.includes('TRACKER')) return 'TRACKER';
                if (m.includes('EQUINOX')) return 'EQUINOX';
                if (m.includes('SILVERADO')) return 'SILVERADO';
                return '';
            },

            formatDateDot(date) {
                const dd = String(date.getDate()).padStart(2, '0');
                const mm = String(date.getMonth() + 1).padStart(2, '0');
                const yyyy = date.getFullYear();
                return `${dd}.${mm}.${yyyy}`;
            },

            dayKey(date) {
                const y = date.getFullYear();
                const m = String(date.getMonth() + 1).padStart(2, '0');
                const d = String(date.getDate()).padStart(2, '0');
                return `${y}-${m}-${d}`;
            },

            readPersisted() {
                try { return localStorage.getItem(this.storageKey) === '1'; } catch (_) { return false; }
            },

            persist(value) {
                try { localStorage.setItem(this.storageKey, value ? '1' : '0'); } catch (_) {}
            },

            toggle() {
                if (this.enabled) this.disable();
                else this.enable();
            },

            enable() {
                this.captureCards();
                this.ensureCriticalCard();
                if (!this.leftCard) return;
                this.enabled = true;
                this.paused = false;
                document.body.classList.add('presentation-mode');
                document.documentElement.classList.add('presentation-mode-root');
                try { ViewportScale.apply(); } catch (_) {}
                const summary = document.getElementById('presentation-summary');
                if (summary) summary.setAttribute('aria-hidden', 'false');
                this.applyGroup();
                this.startTimer();
                this.persist(true);
                this.updateBadge();
            },

            disable() {
                this.enabled = false;
                this.paused = false;
                this.stopTimer();
                document.body.classList.remove('presentation-mode');
                document.documentElement.classList.remove('presentation-mode-root');
                try { ViewportScale.apply(); } catch (_) {}
                const summary = document.getElementById('presentation-summary');
                if (summary) summary.setAttribute('aria-hidden', 'true');
                this.clearClasses();
                this.persist(false);
                this.updateBadge();
            },

            clearClasses() {
                Object.values(this.cardMap).forEach((card) => {
                    if (!card) return;
                    card.classList.remove('presentation-left', 'presentation-slot-a', 'presentation-slot-b');
                });
            },

            startTimer() {
                this.stopTimer();
                this.timer = window.setInterval(() => {
                    if (!this.enabled || this.paused) return;
                    this.nextGroup(false);
                }, this.rotateMs);
            },

            stopTimer() {
                if (!this.timer) return;
                clearInterval(this.timer);
                this.timer = 0;
            },

            togglePause() {
                if (!this.enabled) return;
                this.paused = !this.paused;
                this.updateBadge();
            },

            nextGroup(fromKeyboard) {
                if (!this.enabled) return;
                this.groupIndex = (this.groupIndex + 1) % this.groups.length;
                this.applyGroup();
                if (fromKeyboard) this.updateBadge();
            },

            prevGroup(fromKeyboard) {
                if (!this.enabled) return;
                this.groupIndex = (this.groupIndex - 1 + this.groups.length) % this.groups.length;
                this.applyGroup();
                if (fromKeyboard) this.updateBadge();
            },

            applyGroup() {
                this.clearClasses();
                if (!this.enabled) return;
                this.leftCard?.classList.add('presentation-left');
                const group = this.groups[this.groupIndex] || this.groups[0];
                const a = this.cardMap[group.cards[0]];
                const b = this.cardMap[group.cards[1]];
                if (a) a.classList.add('presentation-slot-a');
                if (b) b.classList.add('presentation-slot-b');
                this.updateBadge();
            },

            updateBadge() {
                const btn = document.getElementById('presentation-toggle-btn');
                const label = document.getElementById('presentation-group-label');
                if (btn) {
                    const pause = this.enabled && this.paused ? ' • Pausado' : '';
                    btn.textContent = this.enabled ? `Apresentação${pause}` : 'Apresentação';
                }
                if (label) {
                    if (!this.enabled) { label.textContent = ''; return; }
                    const g = this.groups[this.groupIndex] || this.groups[0];
                    label.textContent = `${g.label} · 15s`;
                }
            },
            syncKPIs(stats) {
                const listEl = document.getElementById('presentation-importados-list');
                if (!listEl) return;

                const badgeEl = document.getElementById('presentation-importados-badge');
                const footerEl = document.getElementById('presentation-importados-footer');
                const inventario = DataService.getFiltered('inventario');

                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const days = Array.from({ length: 7 }, (_, idx) => {
                    const d = new Date(today);
                    d.setDate(today.getDate() - (6 - idx));
                    return d;
                });

                const byDay = {};
                days.forEach((d) => {
                    byDay[this.dayKey(d)] = {
                        date: d,
                        TRACKER: 0,
                        EQUINOX: 0,
                        SILVERADO: 0,
                        total: 0,
                    };
                });

                inventario.forEach((row) => {
                    const sufixo = this.normalizeText(row.SUFIXO);
                    if (sufixo !== 'CEGONHA') return;

                    const bucket = this.getImportadoBucket(row.MODELO);
                    if (!bucket) return;

                    const dtRaw = row.DATA_CRIACAO ?? row['DATA CRIACAO'] ?? row.DT_CRIACAO ?? row['DT CRIACAO'];
                    const dt = this.parseCreationDate(dtRaw);
                    if (!dt) return;

                    const key = this.dayKey(dt);
                    if (!byDay[key]) return;

                    byDay[key][bucket] += 1;
                    byDay[key].total += 1;
                });

                const rows = days.map((d) => byDay[this.dayKey(d)]);
                const total7d = rows.reduce((sum, r) => sum + (r?.total || 0), 0);

                listEl.innerHTML = '';
                rows.forEach((r) => {
                    const parts = [];
                    if (r.TRACKER > 0) parts.push(`${r.TRACKER} ${r.TRACKER === 1 ? 'unidade' : 'unidades'} de TRACKER`);
                    if (r.EQUINOX > 0) parts.push(`${r.EQUINOX} ${r.EQUINOX === 1 ? 'unidade' : 'unidades'} de EQUINOX`);
                    if (r.SILVERADO > 0) parts.push(`${r.SILVERADO} ${r.SILVERADO === 1 ? 'unidade' : 'unidades'} de SILVERADO`);

                    const sentence = parts.length ? `descarregou ${parts.join(' e ')}` : 'sem descargas de importados';
                    const row = document.createElement('div');
                    row.className = `importados-day-row ${r.total > 0 ? 'has-discharge' : 'no-discharge'}`;
                    row.innerHTML = `
                        <div class="importados-day-date">${this.formatDateDot(r.date)}</div>
                        <div class="importados-day-text">${sentence}</div>
                        <div class="importados-day-total">${r.total.toLocaleString('pt-BR')}</div>
                    `;
                    listEl.appendChild(row);
                });

                if (badgeEl) badgeEl.textContent = `${total7d.toLocaleString('pt-BR')} unid. / 7 dias`;
                if (footerEl) footerEl.textContent = 'Base: inventario de patio | filtro: SUFIXO=CEGONHA | modelos: TRACKER*, EQUINOX, SILVERADO';
            },
        };

        window.onload = async () => {
            TopInfoVisibility.init();
            Animations.init();
            await DashboardRender.init();
            PresentationDashboard.init();
        };

        const postReadyToParent = () => {
            if (!TV_MODE) return;
            try { window.parent?.postMessage({ type: 'avantrax:ready', page: 'index' }, '*'); } catch (_) {}
        };

        window.addEventListener('message', async (e) => {
            const data = e?.data;
            if (!data || typeof data !== 'object') return;
            if (data.type === 'avantrax:top_info_set') {
                TopInfoVisibility.apply(Boolean(data.hidden));
                return;
            }
            if (data.type === 'avantrax:pick_enable') {
                try { FieldPicker.setEnabled(Boolean(data.enabled)); } catch (_) {}
                return;
            }
            if (data.type === 'avantrax:dataset_request') {
                try {
                    const id = String(data.id || '');
                    let dataset = null;
                    if (id === 'inv_faturados') {
                        dataset = FieldPicker.buildInventarioDataset('Status de Faturamento — Faturados', (r) => String(r?.STAT_FAT || '').trim().toUpperCase() === 'FATURADO');
                    } else if (id === 'inv_nao_faturados') {
                        dataset = FieldPicker.buildInventarioDataset('Status de Faturamento — Não Faturados', (r) => String(r?.STAT_FAT || '').trim().toUpperCase() === 'NAO FATURADO');
                    } else if (id === 'inv_bloqueados') {
                        dataset = FieldPicker.buildBloqueadosDataset();
                    } else if (id === 'inv_aging_0_7') {
                        dataset = FieldPicker.buildInventarioDataset('Heatmap de Aging (Pátio)  0-7 dias', (r) => { const a = Number(r?.AGING_PATIO) || 0; return a >= 0 && a <= 7; });
                    } else if (id === 'inv_aging_8_30') {
                        dataset = FieldPicker.buildInventarioDataset('Heatmap de Aging (Pátio) 8-30 dias', (r) => { const a = Number(r?.AGING_PATIO) || 0; return a >= 8 && a <= 30; });
                    } else if (id === 'inv_aging_31_90') {
                        dataset = FieldPicker.buildInventarioDataset('Heatmap de Aging (Pátio)  31-90 dias', (r) => { const a = Number(r?.AGING_PATIO) || 0; return a >= 31 && a <= 90; });
                    } else if (id === 'inv_aging_90_plus') {
                        dataset = FieldPicker.buildInventarioDataset('Heatmap de Aging (Pátio)  > 90 dias', (r) => { const a = Number(r?.AGING_PATIO) || 0; return a > 90; });
                    } else if (id === 'emb_hoje') {
                        dataset = FieldPicker.buildEmbarcadosHojeDataset();
                    }
                    if (dataset) {
                        window.parent?.postMessage({ type: 'avantrax:dataset_selected', dataset }, '*');
                    }
                } catch (_) {}
                return;
            }
            if (data.type === 'avantrax:refresh') {
                const reason = String(data.reason || data.source || 'postMessage');
                try { await DashboardRender.safeRefreshAllData(`postMessage:${reason}`); } catch (_) {}
            }
            if (data.type === 'avantrax:screen_start') {
                DashboardRender.startCountdown(data.durationMs);
            }
        });

        const FieldPicker = {
            enabled: false,
            hoverEl: null,
            hoverAction: null,
            hl: null,
            badge: null,

            setEnabled(enabled) {
                const next = Boolean(enabled);
                if (next === this.enabled) return;
                this.enabled = next;
                if (this.enabled) this.enable();
                else this.disable();
            },

            enable() {
                this.ensureUI();
                document.documentElement.style.cursor = 'crosshair';
                window.addEventListener('mousemove', this._onMove, true);
                window.addEventListener('click', this._onClick, true);
                window.addEventListener('keydown', this._onKey, true);
                this.updateBadge(true);
            },

            disable() {
                document.documentElement.style.cursor = '';
                window.removeEventListener('mousemove', this._onMove, true);
                window.removeEventListener('click', this._onClick, true);
                window.removeEventListener('keydown', this._onKey, true);
                this.hoverEl = null;
                this.updateHL(null);
                this.updateBadge(false);
            },

            ensureUI() {
                if (!this.hl) {
                    const hl = document.createElement('div');
                    hl.id = 'avantrax-fieldpicker-hl';
                    hl.style.cssText = [
                        'position:fixed',
                        'left:0',
                        'top:0',
                        'width:0',
                        'height:0',
                        'pointer-events:none',
                        'z-index:2147483646',
                        'border:2px solid rgba(0,229,255,.95)',
                        'border-radius:10px',
                        'box-shadow:0 0 20px rgba(0,229,255,.22)',
                        'background:rgba(0,229,255,.06)',
                        'opacity:0',
                        'transition:opacity .08s ease',
                    ].join(';');
                    document.body.appendChild(hl);
                    this.hl = hl;
                }
                if (!this.badge) {
                    const b = document.createElement('div');
                    b.id = 'avantrax-fieldpicker-badge';
                    b.style.cssText = [
                        'position:fixed',
                        'left:16px',
                        'bottom:16px',
                        'z-index:2147483646',
                        'pointer-events:none',
                        'padding:8px 10px',
                        'border-radius:999px',
                        'border:1px solid rgba(0,229,255,.35)',
                        'background:rgba(15,23,42,.88)',
                        'color:rgba(224,242,254,.95)',
                        'font:800 12px ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial',
                        'letter-spacing:.2px',
                        'box-shadow:0 12px 45px rgba(0,0,0,.45)',
                        'backdrop-filter:blur(10px)',
                        'opacity:0',
                        'transform:translateY(6px)',
                        'transition:opacity .12s ease, transform .12s ease',
                    ].join(';');
                    b.textContent = 'Gerência: seleção ativa (clique em um campo • Esc desativa)';
                    document.body.appendChild(b);
                    this.badge = b;
                }

                // bind once
                if (!this._bound) {
                    this._bound = true;
                    this._onMove = (e) => this.onMove(e);
                    this._onClick = (e) => this.onClick(e);
                    this._onKey = (e) => this.onKey(e);
                }
            },

            updateBadge(on) {
                if (!this.badge) return;
                this.badge.style.opacity = on ? '1' : '0';
                this.badge.style.transform = on ? 'translateY(0)' : 'translateY(6px)';
            },

            onKey(e) {
                if (!this.enabled) return;
                const key = String(e.key || '').toLowerCase();
                if (key === 'escape') {
                    e.preventDefault();
                    this.setEnabled(false);
                }
            },

            onMove(e) {
                if (!this.enabled) return;
                const el = document.elementFromPoint(e.clientX, e.clientY);
                const action = this.pickExportAction(el);
                this.hoverAction = action;
                this.hoverEl = action?.el || null;
                this.updateHL(this.hoverEl);
            },

            onClick(e) {
                if (!this.enabled) return;
                e.preventDefault();
                e.stopPropagation();
                const action = this.hoverAction || this.pickExportAction(document.elementFromPoint(e.clientX, e.clientY));
                if (!action) return;

                if (action.type === 'fat_menu') {
                    const inv = DataService.getFiltered('inventario') || [];
                    const fatCount = inv.filter(r => String(r?.STAT_FAT || '').trim().toUpperCase() === 'FATURADO').length;
                    const nfatCount = inv.filter(r => String(r?.STAT_FAT || '').trim().toUpperCase() === 'NAO FATURADO').length;
                    const menu = {
                        id: 'fat_status',
                        title: 'Status de Faturamento',
                        page: 'index',
                        options: [
                            { id: 'inv_faturados', label: 'Faturados', count: fatCount },
                            { id: 'inv_nao_faturados', label: 'Não Faturados', count: nfatCount },
                        ],
                        timestamp: new Date().toISOString(),
                    };
                    try { window.parent?.postMessage({ type: 'avantrax:export_menu', menu }, '*'); } catch (_) {}
                    return;
                }
                if (action.type === 'bloq_menu') {
                    const inv = DataService.getFiltered('inventario') || [];
                    const bloqueadosCount = inv.filter(r => String(r?.['MOTIVO BLOQUEIO'] || '').trim() !== '').length;
                    const menu = {
                        id: 'bloq_status',
                        title: 'Veiculos Bloqueados',
                        page: 'index',
                        options: [
                            { id: 'inv_bloqueados', label: 'Lista de Bloqueados', count: bloqueadosCount },
                        ],
                        timestamp: new Date().toISOString(),
                    };
                    try { window.parent?.postMessage({ type: 'avantrax:export_menu', menu }, '*'); } catch (_) {}
                    return;
                }

                if (action.type === 'aging_menu') {
                    const inv = DataService.getFiltered('inventario') || [];
                    const count07 = inv.filter(r => { const a = Number(r?.AGING_PATIO) || 0; return a >= 0 && a <= 7; }).length;
                    const count830 = inv.filter(r => { const a = Number(r?.AGING_PATIO) || 0; return a >= 8 && a <= 30; }).length;
                    const count3190 = inv.filter(r => { const a = Number(r?.AGING_PATIO) || 0; return a >= 31 && a <= 90; }).length;
                    const count90p = inv.filter(r => { const a = Number(r?.AGING_PATIO) || 0; return a > 90; }).length;
                    const menu = {
                        id: 'aging_heatmap',
                        title: 'Heatmap de Aging (Pátio)',
                        page: 'index',
                        options: [
                            { id: 'inv_aging_0_7', label: '0-7 dias', count: count07 },
                            { id: 'inv_aging_8_30', label: '8-30 dias', count: count830 },
                            { id: 'inv_aging_31_90', label: '31-90 dias', count: count3190 },
                            { id: 'inv_aging_90_plus', label: '> 90 dias', count: count90p },
                        ],
                        timestamp: new Date().toISOString(),
                    };
                    try { window.parent?.postMessage({ type: 'avantrax:export_menu', menu }, '*'); } catch (_) {}
                    return;
                }
            },

            pickExportAction(el) {
                try {
                    if (!el) return null;

                    // Only exportable region (card inteiro): Status de Faturamento
                    const card = el.closest?.('.card');
                    if (card && (card.querySelector?.('#chart-stat-fat') || card.querySelector?.('#fat-num-fat') || card.querySelector?.('#fat-num-nfat'))) {
                        return { type: 'fat_menu', el: card };
                    }
                    if (card && (card.querySelector?.('#bloq-grid') || card.querySelector?.('#bloq-badge') || /veiculos bloqueados/i.test(String(card.textContent || '')))) {
                        return { type: 'bloq_menu', el: card };
                    }
                    if (card && (card.querySelector?.('#aging-bands') || card.querySelector?.('#aging-avg-badge') || /heatmap de aging/i.test(String(card.textContent || '')))) {
                        return { type: 'aging_menu', el: card };
                    }

                    return null;
                } catch (_) {
                    return null;
                }
            },

            buildInventarioDataset(title, predicate) {
                const rows = DataService.getFiltered('inventario') || [];
                const filtered = rows.filter((r) => {
                    try { return predicate(r); } catch (_) { return false; }
                });

                const keys = this.getInventarioKeys(rows);
                const columns = this.makeInventarioColumns(keys);
                const outRows = filtered.map((r) => this.mapInventarioRow(r, keys));

                return {
                    title,
                    page: 'index',
                    dataset: 'inventario',
                    count: outRows.length,
                    columns,
                    rows: outRows,
                    timestamp: new Date().toISOString(),
                };
            },
    
            buildBloqueadosDataset() {
                const rows = DataService.getFiltered('inventario') || [];
                const keys = this.getInventarioKeys(rows);

                const readByHeader = (row, candidates) => {
                    try {
                        const rkeys = Object.keys(row || {});
                        const targets = (candidates || []).map((c) => DataService.normalizeHeader(c));
                        for (const rk of rkeys) {
                            const nrk = DataService.normalizeHeader(rk);
                            if (targets.includes(nrk)) return row?.[rk];
                        }
                        return '';
                    } catch (_) {
                        return '';
                    }
                };

                const readMotivo = (row) => {
                    const explicit = readByHeader(row, ['MOTIVO BLOQUEIO', 'MOTIVO_BLOQUEIO', 'BLOQUEIO', 'MOTIVO']);
                    const mapped = keys?.motivo ? row?.[keys.motivo] : '';
                    return String(explicit ?? mapped ?? '').trim();
                };

                const filtered = rows.filter((r) => readMotivo(r) !== '');
                const outRows = filtered.map((r) => {
                    const mapped = this.mapInventarioRow(r, keys);
                    mapped.motivo = readMotivo(r);
                    return mapped;
                });

                const columns = [
                    { key: 'proprietario', label: 'Proprietario' },
                    { key: 'statFat', label: 'Status faturamento' },
                    { key: 'chassi', label: 'Chassi' },
                    { key: 'modelo', label: 'Modelo' },
                    { key: 'area', label: 'AR' },
                    { key: 'endereco', label: 'Endereço' },
                    { key: 'motivo', label: 'Motivo bloqueio' },
                    { key: 'tpVenda', label: 'TP Venda' },
                ];

                return {
                    title: 'Veiculos Bloqueados',
                    page: 'index',
                    dataset: 'inventario',
                    count: outRows.length,
                    columns,
                    rows: outRows,
                    timestamp: new Date().toISOString(),
                };
            },
            getInventarioKeys(rows) {
                // Build a more reliable header reference:
                // some first rows can have empty cells and miss keys like NF.
                const sampleForHeaders = (rows || []).slice(0, 300);
                const headerKeysRef = sampleForHeaders.reduce((best, r) => {
                    const ks = Object.keys(r || {});
                    return ks.length > best.length ? ks : best;
                }, Object.keys(rows?.[0] ?? {}));

                const find = (cands, heur = []) => {
                    if (!headerKeysRef.length) return null;
                    const norm = (v) => DataService.normalizeHeader(v);
                    const simplify = (s) => String(s).replace(/[^A-Z0-9]/g, '');
                    const keysNorm = headerKeysRef.map(k => ({ raw: k, norm: norm(k), simp: simplify(norm(k)) }));
                    const candsNorm = (cands || []).map(c => norm(c));

                    for (const c of candsNorm) {
                        const hit = keysNorm.find(k => k.norm === c);
                        if (hit) return hit.raw;
                    }
                    for (const c of candsNorm.map(simplify)) {
                        const hit = keysNorm.find(k => k.simp === c);
                        if (hit) return hit.raw;
                    }

                    const hits = [];
                    for (const h of heur || []) {
                        const hs = simplify(norm(h));
                        keysNorm.forEach(k => { if (k.simp.includes(hs)) hits.push(k.raw); });
                    }
                    const unique = Array.from(new Set(hits));
                    return unique.length === 1 ? unique[0] : null;
                };
                const keyAtIndex = (idx) => {
                    try {
                        const keys = headerKeysRef;
                        return keys && keys.length > idx ? keys[idx] : null;
                    } catch (_) {
                        return null;
                    }
                };

                const looksLikeStatusFat = (v) => {
                    const s = String(v ?? '').trim().toUpperCase();
                    return s === 'FATURADO' || s === 'NAO FATURADO' || s === 'NÃO FATURADO';
                };
                const looksLikeNF = (v) => {
                    if (v === undefined || v === null) return false;
                    const s = String(v).trim();
                    if (!s) return false;
                    if (/^\d{4,}$/.test(s)) return true;
                    // Avoid patio address pattern like 401-037 (this is ENDERECO, not NF)
                    if (/^\d{3}-\d{3}$/.test(s)) return false;
                    if (/^\d{2,}[-/]\d{2,}$/.test(s)) return true;
                    if (/^\d{4,}\.\d+$/.test(s)) return true;
                    return false;
                };
                const scoreKeyAsNF = (key, statFatKey, sample, blockedKeys = []) => {
                    if (!key || key === statFatKey) return -1;
                    if (blockedKeys.includes(key)) return -1;
                    let nfHits = 0, statusHits = 0, nonEmpty = 0;
                    for (const r of sample) {
                        const v = r?.[key];
                        if (v === undefined || v === null || String(v).trim() === '') continue;
                        nonEmpty++;
                        if (looksLikeStatusFat(v)) statusHits++;
                        if (looksLikeNF(v)) nfHits++;
                    }
                    if (nonEmpty < 10) return -1;
                    const nfRatio = nfHits / nonEmpty;
                    const stRatio = statusHits / nonEmpty;
                    return (nfRatio * 1.2) - (stRatio * 2.0);
                };
                const detectNFKey = (preferredKey, statFatKey, blockedKeys = []) => {
                    try {
                        const keys = Object.keys(rows?.[0] ?? {});
                        if (!keys.length) return null;
                        const sample = (rows || []).slice(0, 800);

                        if (preferredKey) {
                            const sc = scoreKeyAsNF(preferredKey, statFatKey, sample, blockedKeys);
                            if (sc > 0.15) return preferredKey;
                        }

                        const kD = keyAtIndex(3);
                        if (kD) {
                            const sc = scoreKeyAsNF(kD, statFatKey, sample, blockedKeys);
                            if (sc > 0.15) return kD;
                        }

                        let best = null, bestScore = 0.15;
                        for (const k of keys) {
                            const sc = scoreKeyAsNF(k, statFatKey, sample, blockedKeys);
                            if (sc > bestScore) { best = k; bestScore = sc; }
                        }
                        return best;
                    } catch (_) {
                        return null;
                    }
                };

                const statFatKey = find(['STAT_FAT', 'STATUS FATURAMENTO', 'STATUS_FATURAMENTO', 'STATUS FAT'], ['STAT', 'FATUR']);
                const preferredNFKey = find(['NF', 'NOTA', 'NOTA FISCAL', 'NOTA_FISCAL', 'NFE', 'NF-E', 'NUMERO NF', 'NUM NF', 'NUMERO NOTA', 'NUM NOTA'], ['NOTA', 'NF', 'NFE']);
                const headerKeys = headerKeysRef;
                const keyByHeader = (target) => headerKeys.find(k => DataService.normalizeHeader(k) === target) || null;
                const nfIdxKey = keyAtIndex(16);
                const arIdxKey = keyAtIndex(10);
                const endIdxKey = keyAtIndex(11);
                const arKey = keyByHeader('AR') || find(['AR', 'AREA', 'ÁREA', 'AREA (AR)', 'AREA_AR'], ['AR', 'AREA']);
                const endKey = keyByHeader('ENDERECO') || find(['ENDERECO', 'ENDEREÇO', 'END', 'ENDERECAMENTO'], ['ENDEREC']);
                const blockedNFKeys = [arKey, endKey].filter(Boolean);
                const nfKey =
                    keyByHeader('NF') ||
                    (DataService.normalizeHeader(nfIdxKey) === 'NF' ? nfIdxKey : null) ||
                    detectNFKey(preferredNFKey, statFatKey, blockedNFKeys) ||
                    nfIdxKey ||
                    preferredNFKey ||
                    null;
                const motivoKey = find(['MOTIVO BLOQUEIO', 'MOTIVO_BLOQUEIO', 'BLOQUEIO', 'MOTIVO'], ['BLOQUEIO', 'MOTIVO']);
                const safeMotivoKey = (motivoKey && motivoKey !== endKey && motivoKey !== arKey) ? motivoKey : null;
                const detectMotivoKey = () => {
                    try {
                        const keys = headerKeysRef;
                        const sample = (rows || []).slice(0, 800);
                        let best = null, bestScore = 0.2;
                        for (const k of keys) {
                            if (!k || k === endKey || k === arKey || k === statFatKey || k === nfKey) continue;
                            let nonEmpty = 0, motivoHits = 0, addrHits = 0;
                            for (const r of sample) {
                                const v = String(r?.[k] ?? '').trim();
                                if (!v) continue;
                                nonEmpty++;
                                if (/^\d{3}-\d{3}$/.test(v)) addrHits++;
                                if (/(BLOQ|BLOQUE|CANCEL|FABRIC|GEREN|RESTRI|PENDEN)/i.test(v)) motivoHits++;
                            }
                            if (nonEmpty < 6) continue;
                            const score = (motivoHits / nonEmpty) - ((addrHits / nonEmpty) * 2.0);
                            if (score > bestScore) { best = k; bestScore = score; }
                        }
                        return best;
                    } catch (_) {
                        return null;
                    }
                };
                const resolvedMotivoKey = safeMotivoKey || detectMotivoKey();
                return {
                    chassi: find(['CHASSI', 'VIN', 'CHASSI/VIN', 'CHASSIS', 'CHASSI_VIN'], ['CHASSI', 'VIN']),
                    modelo: find(['MODELO', 'MODELO/ANO', 'MODELO ANO', 'MODELO_DESC', 'DESCRICAO MODELO'], ['MODELO']),
                    // NF fica na coluna D (index 3) do inventário de pátio — usar header se existir, senão fallback pela posição
                    nota: ((nfKey && nfKey !== endKey && nfKey !== arKey) ? nfKey : (nfIdxKey || null)),
                    statFat: statFatKey,
                    aging: find(['AGING_PATIO', 'AGING PATIO', 'AGING'], ['AGING']),
                    motivo: resolvedMotivoKey,
                    transp: find(['NOME TRANSPORTADORA', 'TRANSPORTADORA', 'TRANSP', 'TRANS'], ['TRANSP']),
                    montadora: (DataService.columnMap?.inventario?.montadora) || find(['MONTADORA'], ['MONTADOR']),
                    proprietario: (DataService.columnMap?.inventario?.proprietario) || find(['PROPRIETARIO', 'CLIENTE'], ['CLIENTE']),
                    tpVenda: find(['TP_VENDA', 'TP VENDA', 'TPVENDA'], ['TP', 'VENDA']) || keyAtIndex(26),
                    // Área (coluna P / AR) e Endereço (coluna Q)
                    area: arKey || find(['AREA', 'ÁREA', 'AR', 'AREA (AR)', 'AREA_AR'], ['AREA', 'AR']) || arIdxKey || keyAtIndex(15),
                    endereco: endKey || find(['ENDERECO', 'ENDEREÇO', 'END', 'ENDERECAMENTO'], ['ENDEREC']) || endIdxKey,
                };
            },

            makeInventarioColumns(keys) {
                const cols = [];
                const push = (key, label) => { if (keys[key]) cols.push({ key, label }); };
                // Always show a concise, useful set
                push('chassi', 'Chassi');
                push('modelo', 'Modelo');
                push('statFat', 'Status faturamento');
                push('aging', 'Aging pátio');
                push('motivo', 'Motivo bloqueio');
                push('transp', 'Transportadora');
                push('montadora', 'Montadora');
                push('proprietario', 'Proprietário');
                push('area', 'Área');
                push('endereco', 'Endereço');
                // Keep NF at the end (next to Endereco in the modal table)
                cols.push({ key: 'nota', label: 'NF' });

                // fallback if nothing detected
                if (!cols.length) {
                    cols.push({ key: 'raw', label: 'Valor' });
                }
                return cols;
            },

            mapInventarioRow(r, keys) {
                const o = {};
                Object.keys(keys).forEach((k) => {
                    const rawKey = keys[k];
                    if (!rawKey) return;
                    const v = r?.[rawKey];
                    o[k] = v === undefined || v === null ? '' : String(v).trim();
                });
                if (!Object.keys(o).length) {
                    o.raw = String(r?.CHASSI || r?.MODELO || r?.STAT_FAT || '').trim();
                }
                return o;
            },

            buildEmbarcadosHojeDataset() {
                const rows = DataService.getFiltered('embarcados') || [];
                const keys = this.getEmbarcadosKeys(rows);
                const dateKey = keys.dataExp;
                const excelToDate = (v) => {
                    if (v === undefined || v === null || v === '') return null;
                    if (typeof v === 'number') return new Date(Date.UTC(1899, 11, 30) + v * 86400000);
                    const s = String(v).trim();
                    const brMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
                    if (brMatch) return new Date(Number(brMatch[3]), Number(brMatch[2]) - 1, Number(brMatch[1]));
                    const d = new Date(s);
                    return isNaN(d.getTime()) ? null : d;
                };

                const hoje = new Date();
                const diaH = hoje.getDate(), mesH = hoje.getMonth(), anoH = hoje.getFullYear();

                const filtered = rows.filter((e) => {
                    if (!dateKey) return false;
                    const raw = e?.[dateKey];
                    const d = excelToDate(raw);
                    if (!d) return false;
                    const useUTC = typeof raw === 'number';
                    const dia = useUTC ? d.getUTCDate() : d.getDate();
                    const mes = useUTC ? d.getUTCMonth() : d.getMonth();
                    const ano = useUTC ? d.getUTCFullYear() : d.getFullYear();
                    return dia === diaH && mes === mesH && ano === anoH;
                });

                const columns = this.makeEmbarcadosColumns(keys);
                const outRows = filtered.map((r) => this.mapEmbarcadosRow(r, keys));

                return {
                    title: 'Embarcados — Hoje',
                    page: 'index',
                    dataset: 'embarcados',
                    count: outRows.length,
                    columns,
                    rows: outRows,
                    timestamp: new Date().toISOString(),
                };
            },

            getEmbarcadosKeys(rows) {
                const find = (cands, heur = []) => DataService.findBestKey(rows, cands, heur);
                return {
                    chassi: find(['CHASSI', 'VIN', 'CHASSI/VIN', 'CHASSIS'], ['CHASSI', 'VIN']),
                    modelo: find(['MODELO', 'DESCRICAO MODELO', 'MODELO_DESC'], ['MODELO']),
                    nota: find(['NF', 'NOTA', 'NOTA FISCAL', 'NFE', 'NF-E'], ['NOTA', 'NF', 'NFE']),
                    transp: find(['TRANSPORTADORA', 'NOME TRANSPORTADORA', 'TRANSP'], ['TRANSP']),
                    dataExp: find(['DATA EXPEDIÇÃO', 'DATA EXPEDICAO', 'DT_EXPEDICAO', 'DT EXPEDICAO', 'DATA_EXPEDICAO', 'DT EXPEDIÇÃO', 'DT_EXPEDIÇÃO'], ['EXPED']),
                    destino: find(['DESTINO', 'CIDADE DESTINO', 'UF DESTINO', 'LOCAL DESTINO'], ['DESTIN']),
                    montadora: (DataService.columnMap?.embarcados?.montadora) || find(['MONTADORA'], ['MONTADOR']),
                    proprietario: (DataService.columnMap?.embarcados?.proprietario) || find(['PROPRIETARIO', 'CLIENTE'], ['CLIENTE']),
                };
            },

            makeEmbarcadosColumns(keys) {
                const cols = [];
                const push = (key, label) => { if (keys[key]) cols.push({ key, label }); };
                push('chassi', 'Chassi');
                push('modelo', 'Modelo');
                push('nota', 'Nota');
                push('transp', 'Transportadora');
                push('dataExp', 'Data expedição');
                push('destino', 'Destino');
                push('montadora', 'Montadora');
                push('proprietario', 'Proprietário');
                if (!cols.length) cols.push({ key: 'raw', label: 'Valor' });
                return cols;
            },

            mapEmbarcadosRow(r, keys) {
                const o = {};
                Object.keys(keys).forEach((k) => {
                    const rawKey = keys[k];
                    if (!rawKey) return;
                    const v = r?.[rawKey];
                    o[k] = v === undefined || v === null ? '' : String(v).trim();
                });
                if (!Object.keys(o).length) o.raw = String(r?.CHASSI || r?.MODELO || '').trim();
                return o;
            },

            pickCandidate(el) {
                let cur = el;
                const avoid = new Set(['avantrax-fieldpicker-hl', 'avantrax-fieldpicker-badge']);
                while (cur && cur !== document.body && cur !== document.documentElement) {
                    if (cur.id && avoid.has(cur.id)) return null;
                    const rect = cur.getBoundingClientRect ? cur.getBoundingClientRect() : null;
                    const area = rect ? rect.width * rect.height : 0;
                    const txt = String(cur.textContent || '').trim();
                    const hasValueProp = Object.prototype.hasOwnProperty.call(cur, 'value');
                    const isTooBig = rect ? area > (window.innerWidth * window.innerHeight * 0.45) : false;

                    if (cur.id && !isTooBig) return cur;
                    if ((txt || hasValueProp) && !isTooBig) return cur;

                    cur = cur.parentElement;
                }
                return el || null;
            },

            extractField(el) {
                const tag = String(el.tagName || '').toLowerCase();
                const id = String(el.id || '');
                const title = String(el.getAttribute?.('title') || '');
                const ariaLabel = String(el.getAttribute?.('aria-label') || '');
                const selector = id ? `#${this.cssEscape(id)}` : this.buildSelector(el);
                const label = this.guessLabel(el) || ariaLabel || title || id || tag;
                const value = this.readValue(el);
                const text = String(el.textContent || '').trim();

                return {
                    page: 'index',
                    id,
                    tag,
                    label,
                    value,
                    text,
                    title,
                    ariaLabel,
                    selector,
                    timestamp: new Date().toISOString(),
                };
            },

            readValue(el) {
                try {
                    if (!el) return '';
                    const tag = String(el.tagName || '').toLowerCase();
                    if (tag === 'input' || tag === 'select' || tag === 'textarea') return String(el.value ?? '');
                    return String(el.textContent || '').trim();
                } catch (_) {
                    return '';
                }
            },

            guessLabel(el) {
                try {
                    if (!el) return '';
                    // KPI card pattern
                    const kpiCard = el.closest?.('.kpi-card');
                    if (kpiCard) {
                        const lbl = kpiCard.querySelector?.('.kpi-label');
                        const t = String(lbl?.textContent || '').trim();
                        if (t) return t;
                    }
                    if (el.id) {
                        const lab = document.querySelector?.(`label[for="${CSS.escape(el.id)}"]`);
                        const t = String(lab?.textContent || '').trim();
                        if (t) return t;
                    }
                    return '';
                } catch (_) {
                    return '';
                }
            },

            buildSelector(el) {
                try {
                    const tag = String(el.tagName || '').toLowerCase();
                    const classes = el.classList ? Array.from(el.classList).slice(0, 2) : [];
                    const cls = classes.length ? '.' + classes.map((c) => this.cssEscape(c)).join('.') : '';
                    return tag + cls;
                } catch (_) {
                    return '';
                }
            },

            cssEscape(s) {
                try {
                    return (window.CSS && CSS.escape) ? CSS.escape(String(s)) : String(s).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
                } catch (_) {
                    return String(s || '');
                }
            },

            updateHL(el) {
                if (!this.hl) return;
                if (!el || !el.getBoundingClientRect) {
                    this.hl.style.opacity = '0';
                    return;
                }
                const r = el.getBoundingClientRect();
                const pad = 3;
                this.hl.style.left = Math.max(0, r.left - pad) + 'px';
                this.hl.style.top = Math.max(0, r.top - pad) + 'px';
                this.hl.style.width = Math.max(0, r.width + pad * 2) + 'px';
                this.hl.style.height = Math.max(0, r.height + pad * 2) + 'px';
                this.hl.style.opacity = '1';
            },
        };
