
        import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

        const qs = new URLSearchParams(window.location.search);
        const TV_MODE = qs.has('tv');
        const STANDALONE_MODE = qs.has('standalone');

        if (!TV_MODE && !STANDALONE_MODE) {
            window.location.replace('tv.html');
        }

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
                const ts = new Date().toISOString().replace(/[:.]/g, '-');
                return `${type}/${ts}-${this.safePathSegment(fileName)}`;
            },

            async uploadFile(type, file) {
                const supabase = this.getClient();
                if (!supabase) throw new Error('Supabase não configurado (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
                const path = this.makeStoragePath(type, file?.name || `${type}.xlsx`);

                const { error: upErr } = await supabase.storage
                    .from(this.bucket)
                    .upload(path, file, { upsert: false, contentType: file?.type || undefined });
                if (upErr) throw upErr;

                const table = this.tableForType(type);
                const payload = {
                    file_name: file?.name || null,
                    storage_path: path,
                    file_size: typeof file?.size === 'number' ? file.size : null,
                    mime_type: file?.type || null,
                };
                const { error: insErr } = await supabase.from(table).insert([payload]);
                if (insErr) throw insErr;
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
                const { data: blob, error } = await supabase.storage.from(this.bucket).download(latest.storage_path);
                if (error) throw error;
                return { blob, meta: latest };
            },
        };

        const ViewportScale = {
            designWidth: 1920,
            designHeight: 1080,
            _pendingRaf: 0,
            tuneKey: 'avantrax.viewport.tune.v1',
            tune: { scalePct: 100, offsetY: 0 },

            loadTune() {
                try {
                    const raw = localStorage.getItem(this.tuneKey);
                    if (!raw) return;
                    const parsed = JSON.parse(raw);
                    if (!parsed || typeof parsed !== 'object') return;
                    const scalePct = Number(parsed.scalePct);
                    const offsetY = Number(parsed.offsetY);
                    if (Number.isFinite(scalePct)) this.tune.scalePct = Math.min(100, Math.max(80, Math.round(scalePct)));
                    if (Number.isFinite(offsetY)) this.tune.offsetY = Math.min(180, Math.max(-180, Math.round(offsetY)));
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

                const base = Math.min(vw / this.designWidth, vh / this.designHeight);
                const baseScale = Number.isFinite(base) && base > 0 ? base : 1;
                const tuneScale = (this.tune.scalePct || 100) / 100;
                const desiredScale = baseScale * tuneScale;

                const setScaleAndCenter = (scale) => {
                    document.documentElement.style.setProperty('--ui-scale', String(scale));
                    if (!root) return;
                    const offsetX = Math.max(0, (vw - this.designWidth  * scale) / 2);
                    const offsetY = Math.max(0, (vh - this.designHeight * scale) / 2) + (this.tune.offsetY || 0) * scale;
                    root.style.left = `${Math.floor(offsetX + vpLeft)}px`;
                    root.style.top  = `${Math.floor(offsetY + vpTop )}px`;
                };

                setScaleAndCenter(desiredScale);

                if (this._pendingRaf) cancelAnimationFrame(this._pendingRaf);
                this._pendingRaf = requestAnimationFrame(() => {
                    this._pendingRaf = 0;
                    if (!root) return;
                    const rect = root.getBoundingClientRect();
                    const overflowX = rect.right  - (vpLeft + vw);
                    const overflowY = rect.bottom - (vpTop  + vh);
                    if (overflowX <= 0.5 && overflowY <= 0.5) return;
                    const fitX = vw / Math.max(1, rect.width);
                    const fitY = vh / Math.max(1, rect.height);
                    const corrected = desiredScale * Math.min(fitX, fitY) * 0.992;
                    const nextScale = Number.isFinite(corrected) && corrected > 0 ? corrected : desiredScale;
                    setScaleAndCenter(nextScale);
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
                return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
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
            async parseFile(file) {
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
                return XLSX.utils.sheet_to_json(worksheet);
            }
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

            async init() {
                DataService.loadFilters();
                if (TV_MODE) {
                    try { window.parent?.postMessage({ type: 'avantrax:filters', filters: { ...DataService.filters } }, '*'); } catch (_) {}
                }
                this.setupClock();
                this.setupCenterGadget();
                this.setupUploadListeners();
                this.setupFilters();
                await this.tryLoadFromSupabase();
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

            async tryLoadFromSupabase() {
                if (!SupabaseStore.isConfigured()) return;

                const btnStart = document.getElementById('btn-start');
                const labelEmb = document.getElementById('label-embarcados');
                const labelInv = document.getElementById('label-inventario');
                const boxEmb = document.getElementById('box-embarcados');
                const boxInv = document.getElementById('box-inventario');

                if (labelEmb) labelEmb.textContent = 'Carregando do Supabase...';
                if (labelInv) labelInv.textContent = 'Carregando do Supabase...';
                if (btnStart) { btnStart.textContent = 'CARREGANDO...'; btnStart.disabled = true; }

                try {
                    const [emb, inv] = await Promise.all([
                        SupabaseStore.downloadLatestFile('embarcados'),
                        SupabaseStore.downloadLatestFile('inventario'),
                    ]);

                    if (!emb?.blob || !inv?.blob) {
                        if (btnStart) { btnStart.textContent = 'INICIAR DASHBOARD'; btnStart.disabled = true; }
                        if (labelEmb) labelEmb.textContent = 'Clique para selecionar';
                        if (labelInv) labelInv.textContent = 'Clique para selecionar';
                        return;
                    }

                    if (boxEmb) boxEmb.classList.add('loaded');
                    if (boxInv) boxInv.classList.add('loaded');
                    if (labelEmb) labelEmb.textContent = emb?.meta?.file_name || 'embarcados.xlsx';
                    if (labelInv) labelInv.textContent = inv?.meta?.file_name || 'inventario_de_patio.xlsx';

                    const [dataEmb, dataInv] = await Promise.all([
                        Parser.parseFile(emb.blob),
                        Parser.parseFile(inv.blob),
                    ]);
                    DataService.setData('embarcados', dataEmb);
                    DataService.setData('inventario', dataInv);
                    this.renderAll();
                    document.getElementById('upload-overlay').style.opacity = '0';
                    setTimeout(() => {
                        document.getElementById('upload-overlay').style.display = 'none';
                        document.getElementById('dashboard').style.display = 'flex';
                        this.enterFullscreen();
                        this.startRotationToMap();
                        postReadyToParent();
                    }, 500);
                } catch (err) {
                    console.warn('Falha ao carregar do Supabase. Mantendo upload manual.', err);
                    if (btnStart) { btnStart.textContent = 'INICIAR DASHBOARD'; btnStart.disabled = true; }
                    if (labelEmb) labelEmb.textContent = 'Clique para selecionar';
                    if (labelInv) labelInv.textContent = 'Clique para selecionar';
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
                        const dataEmb = await Parser.parseFile(this._embFile);
                        const dataInv = await Parser.parseFile(this._invFile);
                        DataService.setData('embarcados', dataEmb);
                        DataService.setData('inventario', dataInv);
                        this.renderAll();

                        if (SupabaseStore.isConfigured()) {
                            try {
                                btnStart.textContent = "ENVIANDO PARA SUPABASE...";
                                await Promise.all([
                                    SupabaseStore.uploadFile('embarcados', this._embFile),
                                    SupabaseStore.uploadFile('inventario', this._invFile),
                                ]);
                                if (TV_MODE) {
                                    try { window.parent?.postMessage({ type: 'avantrax:data_updated' }, '*'); } catch (_) {}
                                }
                            } catch (err) {
                                console.warn('Falha ao enviar para Supabase. Dashboard seguirá com dados locais.', err);
                            }
                        }

                        document.getElementById('upload-overlay').style.opacity = '0';
                        setTimeout(() => {
                            document.getElementById('upload-overlay').style.display = 'none';
                            document.getElementById('dashboard').style.display = 'flex';
                            this.enterFullscreen();
                            this.startRotationToMap();
                            postReadyToParent();
                        }, 500);
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

                const open = () => {
                    panel.classList.add('open');
                    panel.setAttribute('aria-hidden', 'false');
                    this.refreshFiltersUI();
                    if (tuneScale)    tuneScale.value    = String(ViewportScale.tune.scalePct ?? 100);
                    if (tuneScaleVal) tuneScaleVal.textContent = `${ViewportScale.tune.scalePct ?? 100}%`;
                    if (tuneOffsetY)  tuneOffsetY.value  = String(ViewportScale.tune.offsetY ?? 0);
                    if (tuneOffsetYVal) tuneOffsetYVal.textContent = String(ViewportScale.tune.offsetY ?? 0);
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
                    if (!tuneScale || !tuneOffsetY) return;
                    ViewportScale.setTune({ scalePct: Number(tuneScale.value), offsetY: Number(tuneOffsetY.value) });
                    if (tuneScaleVal)  tuneScaleVal.textContent  = `${ViewportScale.tune.scalePct}%`;
                    if (tuneOffsetYVal) tuneOffsetYVal.textContent = String(ViewportScale.tune.offsetY);
                };
                if (tuneScale)   tuneScale.addEventListener('input',  applyTune, { passive: true });
                if (tuneOffsetY) tuneOffsetY.addEventListener('input', applyTune, { passive: true });

                window.addEventListener('keydown', (e) => {
                    const key = (e.key || '').toLowerCase();
                    if (e.ctrlKey && e.shiftKey && key === 'f') { e.preventDefault(); toggle(); }
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

                // Veículos Bloqueados — grid 2×2 com paginação
                const bloqueados = DataService.getFiltered('inventario')
                    .filter(i => i['MOTIVO BLOQUEIO'] && String(i['MOTIVO BLOQUEIO']).trim() !== '')
                    .sort((a,b) => (Number(b.AGING_PATIO)||0) - (Number(a.AGING_PATIO)||0));

                document.getElementById('bloq-badge').textContent = bloqueados.length;

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

                // Pills de resumo
                const motivosEl = document.getElementById('bloq-motivos');
                motivosEl.innerHTML = '';
                motivosSorted.slice(0, 4).forEach(([motivo, count]) => {
                    const c = motivoColorIndex[motivo];
                    const pill = document.createElement('div');
                    pill.style.cssText = `display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:20px;background:${c.bg};border:1px solid ${c.border};font-size:0.6rem;font-weight:700;color:${c.text};white-space:nowrap;`;
                    pill.innerHTML = `<span style="width:5px;height:5px;border-radius:50%;background:${c.text};flex-shrink:0;"></span>${motivo} <span style="opacity:0.7;">(${count})</span>`;
                    motivosEl.appendChild(pill);
                });

                const getAgingColor = (aging) => {
                    if (aging > 180) return '#EF4444';
                    if (aging > 90)  return '#F59E0B';
                    return '#94A3B8';
                };

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
                            background: rgba(255,255,255,0.025);
                            border: 1px solid rgba(255,255,255,0.07);
                            border-left: 3px solid ${c.text};
                            border-radius: 10px;
                            padding: 10px 12px;
                            display: flex;
                            flex-direction: column;
                            gap: 6px;
                            min-width: 0;
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
                            this.timer = setInterval(() => this.next(), 6000);
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
                document.getElementById('fat-sub-fat').textContent  = `de ${total.toLocaleString('pt-BR')} veículos`;
                document.getElementById('fat-sub-nfat').textContent = 'aguardando expedição';

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
                            backgroundColor: ['#00BFFF', 'rgba(30,41,59,0.9)'],
                            borderColor:     ['rgba(0,191,255,0.4)', 'rgba(255,255,255,0.04)'],
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
                                borderColor:  'rgba(0,191,255,0.25)',
                                borderWidth:  1,
                                titleColor:   '#00BFFF',
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

                    const row = document.createElement('div');
                    row.style.cssText = 'display:flex; align-items:center; gap:10px;';
                    row.innerHTML = `
                        <!-- Faixa label -->
                        <div style="width:60px; flex-shrink:0; text-align:right;">
                            <div style="font-size:0.68rem; font-weight:800; color:${b.color}; font-family:'JetBrains Mono',monospace;">${b.label}</div>
                            <div style="font-size:0.55rem; color:#475569; margin-top:1px;">${b.desc}</div>
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

                const transpColors = ['#007BFF','#0099E6','#00BFFF','#3B82F6','#60A5FA'];
                const transpRanks  = ['①','②','③','④','⑤'];

                const transpListEl = document.getElementById('transp-list');
                transpListEl.innerHTML = '';

                topTransp.forEach(([nome, qtd], idx) => {
                    const pctBar  = Math.round((qtd / maxTranspCount) * 100);
                    const pctTot  = totalInvTransp > 0 ? Math.round((qtd / totalInvTransp) * 100) : 0;
                    const color   = transpColors[idx] || '#007BFF';
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

                const embCounts = embBands.map(b => ({
                    ...b,
                    count: embarcados.filter(e => {
                        const a = Number(e.AGING) || 0;
                        return a >= b.min && a <= b.max;
                    }).length
                }));

                const maxEmbCount   = Math.max(...embCounts.map(b => b.count), 1);
                const totalEmbAging = embCounts.reduce((s, b) => s + b.count, 0);

                // Calcula aging médio dos embarcados
                const embAgingSum = embarcados.reduce((acc, e) => acc + (Number(e.AGING) || 0), 0);
                const embAgingAvg = embarcados.length > 0 ? (embAgingSum / embarcados.length).toFixed(1) : 0;
                document.getElementById('emb-avg-badge').textContent = `avg ${embAgingAvg}d`;

                // Faixas
                const embBandsEl = document.getElementById('emb-aging-bands');
                embBandsEl.innerHTML = '';
                embCounts.forEach(b => {
                    const pct    = Math.round((b.count / maxEmbCount) * 100);
                    const pctTot = totalEmbAging > 0 ? Math.round((b.count / totalEmbAging) * 100) : 0;

                    const row = document.createElement('div');
                    row.style.cssText = 'display:flex; align-items:center; gap:10px;';
                    row.innerHTML = `
                        <div style="width:60px; flex-shrink:0; text-align:right;">
                            <div style="font-size:0.68rem; font-weight:800; color:${b.color}; font-family:'JetBrains Mono',monospace;">${b.label}</div>
                            <div style="font-size:0.55rem; color:#475569; margin-top:1px;">${b.desc}</div>
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

        window.onload = async () => {
            Animations.init();
            await DashboardRender.init();
        };

        const postReadyToParent = () => {
            if (!TV_MODE) return;
            try { window.parent?.postMessage({ type: 'avantrax:ready', page: 'index' }, '*'); } catch (_) {}
        };

        window.addEventListener('message', async (e) => {
            const data = e?.data;
            if (!data || typeof data !== 'object') return;
            if (data.type === 'avantrax:refresh') {
                try { await DashboardRender.tryLoadFromSupabase(); } catch (_) {}
            }
            if (data.type === 'avantrax:screen_start') {
                DashboardRender.startCountdown(data.durationMs);
            }
        });
    