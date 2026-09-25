
const weddingConfig = {
  coupleNames: "Trust & Naomi",

  heroTitle: "RubynGold",
  timezone: "Africa/Lagos",

  saveTheDateImage: "img.jpeg",

  invitationMessage:
    "We joyfully invite you to celebrate this special chapter with us.",

  whatsappNumber: "2348063002624",
  siteUrl: "", 

  enableRSVP: false,


  enableMusic: true,
  musicFile: "rubyngold1.mp3",

  events: {
    traditional: {
      key: "traditional",
      name: "Traditional Marriage",
      shortName: "Traditional",
      date: "2026-11-07",        // YYYY-MM-DD, interpreted in `timezone`
      startTime: "12:00",        // 24h HH:MM
      endTime: "18:00",

      // Single-venue events use this simple shape:
      venue: "Januchism Hotel",
      address: "Umuoko Village Gate, Ihiagwa Owerri west L.G.A, Imo state, Nigeria.",
      mapsUrl: "https://maps.app.goo.gl/JbEgagy925coV4gw9",

      description: "Join us as we honour our roots and celebrate our traditional marriage rites.",
      rsvpMessage: "I would like to RSVP for your Traditional Marriage.",
      theme: {
        primary:    "#6E1423",
        secondary:  "#C9A227", 
        background: "#F7ECDA",
        surface:    "#FBF4E4",
        text:       "#2A0B10",
        accent:     "#C9A227", 
        buttonStyle: "solid"
      }
    },

    whiteWedding: {
      key: "whiteWedding",
      name: "White Wedding",
      shortName: "White Wedding",
      date: "2026-12-05",
      startTime: "14:00",
      endTime: "20:00",

      // Multi-location events
      church: {
        name: "The Redeemed Christian Church of God, Tree of Life Parish",
        address: "78 Marine Road, Apapa Quays, Lagos State, Nigeria.",
        mapsUrl: "https://maps.app.goo.gl/N6S3f2YP328cAtE26"
      },
      reception: {
        name: "St. Andrew's Anglican church, Apapa GRA",
        address: "29 Marine Road, Lagos State, Nigeria",
        mapsUrl: "https://maps.app.goo.gl/wrsRBHqK1JXQuWfg6"
      },

      description: "Join us at the altar as we exchange vows in white, surrounded by the people we love.",
      rsvpMessage: "I would like to RSVP for your White Wedding.",
      theme: {
        primary:    "#B76E79",
        secondary:  "#8C4A52", 
        background: "#FFFFFF",
        surface:    "#FFFFFF",
        text:       "#3A2126",
        accent:     "#D4AF6A",
        buttonStyle: "solid"
      }
    }
  }
};

/* =========================================================
   STATE
   ========================================================= */
const state = {
  selectedEventKey: null,
  countdownTimer: null
};

/* =========================================================
   UTILITIES
   ========================================================= */

function safeText(value, fallback = "") {
  return (value === undefined || value === null || value === "") ? fallback : String(value);
}

function getSiteUrl() {
  if (weddingConfig.siteUrl) return weddingConfig.siteUrl;
  return window.location.href.split("#")[0];
}

function getUtcOffsetMinutes(timeZone, atDate) {
  try {
    const dtf = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" });
    const parts = dtf.formatToParts(atDate);
    const tzPart = parts.find(p => p.type === "timeZoneName");
    if (!tzPart) throw new Error("no timeZoneName part");
    const match = tzPart.value.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
    if (!match) throw new Error("unparsable offset: " + tzPart.value);
    const sign = match[1] === "-" ? -1 : 1;
    const hours = parseInt(match[2], 10);
    const mins = match[3] ? parseInt(match[3], 10) : 0;
    return sign * (hours * 60 + mins);
  } catch (err) {
    console.warn("Timezone offset lookup failed, defaulting to UTC+1:", err);
    return 60;
  }
}

function eventTimeToTimestamp(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  if ([y, m, d, hh, mm].some(n => Number.isNaN(n))) return null;

  const naiveUtcGuess = Date.UTC(y, m - 1, d, hh, mm);
  const offsetMinutes = getUtcOffsetMinutes(weddingConfig.timezone, new Date(naiveUtcGuess));
  return naiveUtcGuess - offsetMinutes * 60000;
}

function toICSDate(timestampMs) {
  const d = new Date(timestampMs);
  const pad = n => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) + "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) + "Z"
  );
}

function icsEscape(text) {
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function formatReadableDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

function formatReadableTime(timeStr) {
  if (!timeStr) return "";
  const [hh, mm] = timeStr.split(":").map(Number);
  const dt = new Date(Date.UTC(2000, 0, 1, hh, mm));
  return dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
}

/**
 * Normalize an event's location info — whether it was configured as a
 * single venue, a church+reception pair, or a raw locations[] array —
 * into one consistent array: [{ label, name, address, mapsUrl }, ...]
 */
function getEventLocations(event) {
  if (Array.isArray(event.locations)) return event.locations;

  if (event.church || event.reception) {
    const locs = [];
    if (event.church) locs.push({ label: "Church", ...event.church });
    if (event.reception) locs.push({ label: "Reception", ...event.reception });
    return locs;
  }

  if (event.venue || event.address || event.mapsUrl) {
    return [{ label: null, name: event.venue, address: event.address, mapsUrl: event.mapsUrl }];
  }

  return [];
}

/** One combined string for calendar LOCATION fields (Google Calendar + ICS). */
function getEventLocationText(event) {
  return getEventLocations(event)
    .map(loc => {
      const bits = [loc.name, loc.address].filter(Boolean).join(", ");
      return loc.label ? `${loc.label}: ${bits}` : bits;
    })
    .filter(Boolean)
    .join(" | ");
}

function buildMapsUrlForLocation(loc) {
  if (!loc) return null;
  if (loc.mapsUrl) return loc.mapsUrl;
  if (loc.address) return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(loc.address);
  return null;
}

/* =========================================================
   CALENDAR / MAPS / WHATSAPP URL BUILDERS
   (pure functions of an event object — no duplication per event)
   ========================================================= */

function buildGoogleCalendarUrl(event) {
  const start = eventTimeToTimestamp(event.date, event.startTime);
  const end = eventTimeToTimestamp(event.date, event.endTime || event.startTime);
  if (!start) return null;

  const fmt = ts => {
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, "0");
    return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) +
      "T" + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + "Z";
  };

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${weddingConfig.coupleNames} — ${event.name} ❤️`,
    dates: `${fmt(start)}/${fmt(end || start)}`,
    details: event.description || "",
    location: getEventLocationText(event)
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function buildICS(events) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//" + icsEscape(weddingConfig.coupleNames) + "//Save the Date//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH"
  ];

  events.forEach(event => {
    const start = eventTimeToTimestamp(event.date, event.startTime);
    const end = eventTimeToTimestamp(event.date, event.endTime || event.startTime) || start;
    if (!start) return;

    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.key}-${event.date}@savethe-date.local`,
      `DTSTAMP:${toICSDate(Date.now())}`,
      `DTSTART:${toICSDate(start)}`,
      `DTEND:${toICSDate(end)}`,
      `SUMMARY:${icsEscape(weddingConfig.coupleNames + " — " + event.name)}`,
      `DESCRIPTION:${icsEscape(event.description || "")}`,
      `LOCATION:${icsEscape(getEventLocationText(event))}`,
      "END:VEVENT"
    );
  });

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function downloadICS(icsContent, filename) {
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function buildWhatsAppRSVP(event) {
  if (!weddingConfig.whatsappNumber) return null;
  const msg =
    `Hello ${weddingConfig.coupleNames}! ❤️\n\n` +
    `${event.rsvpMessage || "I would like to RSVP for your " + event.name + "."}\n\n` +
    `Name:\nNumber of guests:`;
  return `https://wa.me/${weddingConfig.whatsappNumber}?text=${encodeURIComponent(msg)}`;
}

function buildWhatsAppShareMessage() {
  const eventLines = Object.values(weddingConfig.events)
    .map(e => `${e.name} — ${formatReadableDate(e.date)}`)
    .join("\n");
  return (
    `The countdown begins… ❤️\n\n` +
    `${weddingConfig.coupleNames} are getting married!\n\n` +
    `Save the Dates:\n${eventLines}\n\n` +
    `View Save the Date:\n${getSiteUrl()}`
  );
}

/* =========================================================
   THEME APPLICATION
   Writes event-level tokens onto #event-stage only, so the
   shell (hero, opening reveal) never re-themes.
   ========================================================= */
function applyEventTheme(event) {
  const stage = document.getElementById("event-stage");
  const theme = event.theme || {};
  const tokens = ["primary", "secondary", "background", "surface", "text", "accent"];
  tokens.forEach(t => {
    if (theme[t]) stage.style.setProperty(`--${t}`, theme[t]);
  });
}

/* =========================================================
   EVENT SELECTOR (built once from config)
   ========================================================= */
function buildEventSelector() {
  const selector = document.getElementById("event-selector");
  selector.innerHTML = "";

  Object.values(weddingConfig.events).forEach(event => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "selector__btn";
    btn.id = `select-${event.key}`;
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", "false");
    btn.setAttribute("aria-controls", "event-card");

    const dot = document.createElement("span");
    dot.className = "selector__dot";
    dot.style.background = event.theme && event.theme.primary ? event.theme.primary : "currentColor";
    dot.setAttribute("aria-hidden", "true");

    btn.appendChild(dot);
    btn.appendChild(document.createTextNode(event.shortName || event.name));

    btn.addEventListener("click", () => selectEvent(event.key));
    selector.appendChild(btn);
  });
}

/* =========================================================
   SELECT + RENDER AN EVENT
   ========================================================= */
function selectEvent(key) {
  const event = weddingConfig.events[key];
  if (!event) {
    console.error("Unknown event key:", key);
    return;
  }

  state.selectedEventKey = key;

  Object.values(weddingConfig.events).forEach(e => {
    const btn = document.getElementById(`select-${e.key}`);
    if (btn) btn.setAttribute("aria-selected", e.key === key ? "true" : "false");
  });

  applyEventTheme(event);
  renderEventCard(event);
  startCountdown(event);

  const bar = document.getElementById("action-bar");
  if (bar) bar.hidden = false;
}

function renderEventCard(event) {
  const card = document.getElementById("event-card");
  card.innerHTML = ""; // rebuilding from trusted config data, not user input

  const name = document.createElement("h2");
  name.className = "event-card__name";
  name.textContent = event.name;

  const when = document.createElement("p");
  when.className = "event-card__datetime";
  when.textContent = `${formatReadableDate(event.date)} · ${formatReadableTime(event.startTime)}`;

  const desc = document.createElement("p");
  desc.className = "event-card__desc";
  desc.textContent = safeText(event.description);

  const countdown = document.createElement("div");
  countdown.className = "countdown";
  countdown.id = "countdown";
  countdown.setAttribute("role", "timer");
  countdown.setAttribute("aria-live", "off");
  ["Days", "Hours", "Minutes", "Seconds"].forEach(label => {
    const unit = document.createElement("div");
    unit.className = "countdown__unit";
    const num = document.createElement("span");
    num.className = "countdown__num";
    num.id = `cd-${label.toLowerCase()}`;
    num.textContent = "00";
    const lab = document.createElement("span");
    lab.className = "countdown__label";
    lab.textContent = label;
    unit.appendChild(num);
    unit.appendChild(lab);
    countdown.appendChild(unit);
  });

  const message = document.createElement("p");
  message.className = "countdown__message";
  message.id = "countdown-message";
  message.hidden = true;

  card.appendChild(name);
  card.appendChild(when);
  if (event.description) card.appendChild(desc);
  card.appendChild(countdown);
  card.appendChild(message);

  // Venue/location block(s) — one per location (single venue, or church + reception)
  const locations = getEventLocations(event);
  locations.forEach(loc => {
    const venue = document.createElement("p");
    venue.className = "event-card__venue";
    if (loc.label) {
      const labelEl = document.createElement("span");
      labelEl.className = "event-card__venue-label";
      labelEl.textContent = loc.label;
      venue.appendChild(labelEl);
    }
    const strong = document.createElement("strong");
    strong.textContent = safeText(loc.name);
    venue.appendChild(strong);
    venue.appendChild(document.createTextNode(safeText(loc.address)));
    card.appendChild(venue);
  });

  // Actions
  const actions = document.createElement("div");
  actions.className = "event-card__actions";

  const googleUrl = buildGoogleCalendarUrl(event);
  if (googleUrl) {
    const googleBtn = document.createElement("button");
    googleBtn.type = "button";
    googleBtn.className = "btn";
    googleBtn.textContent = "Add to Google Calendar";
    googleBtn.addEventListener("click", () => window.open(googleUrl, "_blank", "noopener"));
    actions.appendChild(googleBtn);
  }

  const icalBtn = document.createElement("button");
  icalBtn.type = "button";
  icalBtn.className = "btn";
  icalBtn.textContent = "Add to iCalendar";
  icalBtn.addEventListener("click", () => downloadICS(buildICS([event]), `${event.key}.ics`));
  actions.appendChild(icalBtn);

  locations.forEach(loc => {
    const mapsUrl = buildMapsUrlForLocation(loc);
    if (!mapsUrl) return;
    const label = locations.length > 1 ? `View ${loc.label} Location` : "View location";
    const mapBtn = document.createElement("button");
    mapBtn.type = "button";
    mapBtn.className = "btn btn--secondary";
    mapBtn.textContent = label;
    mapBtn.addEventListener("click", () => window.open(mapsUrl, "_blank", "noopener"));
    actions.appendChild(mapBtn);
  });

  if (weddingConfig.enableRSVP) {
    const rsvpUrl = buildWhatsAppRSVP(event);
    if (rsvpUrl) {
      const rsvpBtn = document.createElement("button");
      rsvpBtn.type = "button";
      rsvpBtn.className = "btn btn--secondary";
      rsvpBtn.textContent = "RSVP on WhatsApp";
      rsvpBtn.addEventListener("click", () => window.open(rsvpUrl, "_blank", "noopener"));
      actions.appendChild(rsvpBtn);
    }
  }

  card.appendChild(actions);
}

/* =========================================================
   BOTH-EVENTS CALENDAR ACTIONS (below the event card)
   These never change the selected event — they exist purely
   so a guest attending both celebrations doesn't have to
   flip back and forth just to save both to a calendar.
   ========================================================= */
function buildBothEventsActions() {
  const wrap = document.getElementById("both-events-actions");
  wrap.innerHTML = "";

  const googleBtn = document.createElement("button");
  googleBtn.type = "button";
  googleBtn.className = "btn btn--outline";
  googleBtn.textContent = "Add Both Events to Google Calendar";
  googleBtn.addEventListener("click", openBothEventsGoogleSheet);
  wrap.appendChild(googleBtn);

  const icsBtn = document.createElement("button");
  icsBtn.type = "button";
  icsBtn.className = "btn btn--outline";
  icsBtn.textContent = "Add Both Events to iCalendar";
  icsBtn.addEventListener("click", () => {
    const ics = buildICS(Object.values(weddingConfig.events));
    downloadICS(ics, "save-the-date-both-events.ics");
  });
  wrap.appendChild(icsBtn);
}


function openBothEventsGoogleSheet() {
  openOptionsSheet({
    title: "Add both events",
    note: "Google Calendar can only add one event at a time — tap each below to add it.",
    options: Object.values(weddingConfig.events).map(event => ({
      label: `Add ${event.name} to Google Calendar`,
      onClick: () => {
        const url = buildGoogleCalendarUrl(event);
        if (url) window.open(url, "_blank", "noopener");
      },
      closeAfter: false
    }))
  });
}

function openOptionsSheet({ title, note, options }) {
  const sheet = document.getElementById("calendar-sheet");
  document.getElementById("sheet-title").textContent = title;

  const noteEl = document.getElementById("sheet-note");
  if (note) {
    noteEl.textContent = note;
    noteEl.hidden = false;
  } else {
    noteEl.hidden = true;
  }

  const optsWrap = document.getElementById("sheet-options");
  optsWrap.innerHTML = "";
  options.forEach(opt => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sheet__option";
    btn.textContent = opt.label;
    btn.addEventListener("click", () => {
      opt.onClick();
      if (opt.closeAfter !== false) closeCalendarSheet();
    });
    optsWrap.appendChild(btn);
  });

  sheet.hidden = false;
  document.getElementById("cal-cancel").focus();
}

function closeCalendarSheet() {
  document.getElementById("calendar-sheet").hidden = true;
}

function wireOptionsSheet() {
  document.getElementById("cal-cancel").addEventListener("click", closeCalendarSheet);
  const sheet = document.getElementById("calendar-sheet");
  sheet.addEventListener("click", e => { if (e.target === sheet) closeCalendarSheet(); });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !sheet.hidden) closeCalendarSheet();
  });
}

/* =========================================================
   COUNTDOWN (per selected event)
   ========================================================= */
function startCountdown(event) {
  if (state.countdownTimer) clearInterval(state.countdownTimer);

  const target = eventTimeToTimestamp(event.date, event.startTime);
  const endTarget = eventTimeToTimestamp(event.date, event.endTime || event.startTime) || target;

  function tick() {
    const countdownEl = document.getElementById("countdown");
    const messageEl = document.getElementById("countdown-message");
    if (!countdownEl || !messageEl) return; // card no longer in DOM (event switched)

    if (!target) {
      countdownEl.hidden = true;
      messageEl.hidden = false;
      messageEl.textContent = "Date to be confirmed ❤️";
      return;
    }

    const now = Date.now();
    const diff = target - now;

    if (diff > 0) {
      countdownEl.hidden = false;
      messageEl.hidden = true;
      const clamped = Math.max(diff, 0);
      const days = Math.floor(clamped / 86400000);
      const hours = Math.floor((clamped % 86400000) / 3600000);
      const minutes = Math.floor((clamped % 3600000) / 60000);
      const seconds = Math.floor((clamped % 60000) / 1000);
      setCountdownDigit("cd-days", days);
      setCountdownDigit("cd-hours", hours);
      setCountdownDigit("cd-minutes", minutes);
      setCountdownDigit("cd-seconds", seconds);
    } else if (now < endTarget) {
      countdownEl.hidden = true;
      messageEl.hidden = false;
      messageEl.textContent = "Today is the day! ❤️";
    } else {
      countdownEl.hidden = true;
      messageEl.hidden = false;
      messageEl.textContent = "This celebration has begun. ❤️";
    }
  }

  tick();
  state.countdownTimer = setInterval(tick, 1000);
}

function setCountdownDigit(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(Math.max(0, value)).padStart(2, "0");
}

/* =========================================================
   DESIGN + LIGHTBOX
   ========================================================= */
function wireArtwork() {
  const img = document.getElementById("artwork-img");
  const fallback = document.getElementById("artwork-fallback");
  const frame = document.getElementById("artwork-open");
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const closeBtn = document.getElementById("lightbox-close");

  img.addEventListener("error", () => {
    img.hidden = true;
    fallback.hidden = false;
  });

  frame.addEventListener("click", () => {
    if (img.hidden) return; 
    lightboxImg.src = img.src;
    lightbox.hidden = false;
    document.body.style.overflow = "hidden";
    closeBtn.focus();
  });

  function closeLightbox() {
    lightbox.hidden = true;
    document.body.style.overflow = "";
    frame.focus();
  }

  closeBtn.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", e => { if (e.target === lightbox) closeLightbox(); });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !lightbox.hidden) closeLightbox();
  });
}

/* =========================================================
   SHARE / COPY LINK
   ========================================================= */
function wireShare() {
  const statusEl = document.getElementById("share-status");
  const announce = msg => { statusEl.textContent = msg; };

  document.getElementById("share-invite").addEventListener("click", async () => {
    const url = getSiteUrl();
    const shareData = {
      title: `${weddingConfig.coupleNames} — Save the Date`,
      text: weddingConfig.invitationMessage,
      url
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if (err.name !== "AbortError") console.warn("Share failed:", err);
      }
    } else {
      await copyToClipboard(url);
      announce("Invitation link copied! ❤️");
    }
  });

  document.getElementById("share-whatsapp").addEventListener("click", () => {
    const url = "https://wa.me/?text=" + encodeURIComponent(buildWhatsAppShareMessage());
    window.open(url, "_blank", "noopener");
  });

  document.getElementById("copy-link").addEventListener("click", async () => {
    const ok = await copyToClipboard(getSiteUrl());
    announce(ok ? "Invitation link copied! ❤️" : "Couldn't copy automatically — long-press to copy the URL.");
  });
}

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    throw new Error("Clipboard API unavailable");
  } catch (err) {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (fallbackErr) {
      console.warn("Copy fallback failed:", fallbackErr);
      return false;
    }
  }
}

/* =========================================================
   STICKY ACTION BAR
   ========================================================= */
function wireActionBar() {
  document.getElementById("bar-calendar").addEventListener("click", () => {
    const event = weddingConfig.events[state.selectedEventKey];
    if (!event) return;
    const options = [];
    const googleUrl = buildGoogleCalendarUrl(event);
    if (googleUrl) options.push({ label: "Add to Google Calendar", onClick: () => window.open(googleUrl, "_blank", "noopener") });
    options.push({ label: "Add to iCalendar", onClick: () => downloadICS(buildICS([event]), `${event.key}.ics`) });
    openOptionsSheet({ title: `Add ${event.name} to calendar`, options });
  });

  document.getElementById("bar-location").addEventListener("click", () => {
    const event = weddingConfig.events[state.selectedEventKey];
    if (!event) return;
    const locations = getEventLocations(event).filter(loc => buildMapsUrlForLocation(loc));
    if (locations.length === 0) return;
    if (locations.length === 1) {
      window.open(buildMapsUrlForLocation(locations[0]), "_blank", "noopener");
      return;
    }
    openOptionsSheet({
      title: `${event.name} locations`,
      options: locations.map(loc => ({
        label: `View ${loc.label} Location`,
        onClick: () => window.open(buildMapsUrlForLocation(loc), "_blank", "noopener")
      }))
    });
  });

 const barRsvpBtn = document.getElementById("bar-rsvp");
if (barRsvpBtn) {
  barRsvpBtn.addEventListener("click", () => {
    const event = weddingConfig.events[state.selectedEventKey];
    const url = event && buildWhatsAppRSVP(event);
    if (url) window.open(url, "_blank", "noopener");
  });
}}


function wireMusic() {
  if (!weddingConfig.enableMusic || !weddingConfig.musicFile) return;

  const toggle = document.getElementById("music-toggle");
  const icon = toggle.querySelector(".music-toggle__icon");
  const label = toggle.querySelector(".music-toggle__label");
  const audio = document.getElementById("music-audio");

  audio.src = weddingConfig.musicFile;
  audio.volume = 0.6;
  toggle.hidden = false;

  function setPlayingUI(isPlaying) {
    toggle.setAttribute("aria-pressed", isPlaying ? "true" : "false");
    icon.textContent = isPlaying ? "🎵" : "🔇";
    label.textContent = isPlaying ? "Music On" : "Music Off";
  }

  function tryPlay() {
    return audio.play().then(() => setPlayingUI(true)).catch(() => {
      setPlayingUI(false); // blocked — the button now clearly invites a tap to start it
    });
  }

  setPlayingUI(false);
  tryPlay();

  // One retry on the guest's first interaction anywhere on the page —
  // browsers that blocked the initial autoplay often allow it here.
  function retryOnFirstInteraction() {
    if (audio.paused) tryPlay();
  }
  document.addEventListener("click", retryOnFirstInteraction, { once: true });
  document.addEventListener("touchstart", retryOnFirstInteraction, { once: true, passive: true });

  toggle.addEventListener("click", () => {
    if (audio.paused) tryPlay();
    else { audio.pause(); setPlayingUI(false); }
  });
}

/* =========================================================
   OPENING REVEAL
   Stays in normal document flow at all times — never hidden,
   never position-fixed over the rest of the page, and never
   blocks scrolling. The button and the auto-timeout both just
   scroll the guest down; they never hide/replace content.
   ========================================================= */
function wireReveal() {
  const main = document.getElementById("main");
  const enterBtn = document.getElementById("reveal-enter");

  function scrollToInvitation() {
    main.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start"
    });
  }

  enterBtn.addEventListener("click", scrollToInvitation);

  // If the guest hasn't already scrolled or tapped through by themselves,
  // gently move them into the invitation after a short pause — but never
  // leave them on a blank screen if they take no action at all.
  const autoDelay = prefersReducedMotion() ? 600 : 2600;
  setTimeout(() => {
    if (window.scrollY < 40) scrollToInvitation();
  }, autoDelay);
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* =========================================================
   INIT
   ========================================================= */
function init() {
  document.title = `${weddingConfig.coupleNames} — Save the Date`;
  document.getElementById("reveal-names").textContent = weddingConfig.coupleNames;
  document.getElementById("couple-names").textContent = weddingConfig.heroTitle || weddingConfig.coupleNames;
  document.getElementById("invitation-message").textContent = weddingConfig.invitationMessage;

  const img = document.getElementById("artwork-img");
  if (weddingConfig.saveTheDateImage) {
    img.src = weddingConfig.saveTheDateImage;
  } else {
    img.hidden = true;
    document.getElementById("artwork-fallback").hidden = false;
  }

  if (!weddingConfig.enableRSVP) {
    const barRsvp = document.getElementById("bar-rsvp");
    if (barRsvp) barRsvp.remove();
  }

  buildEventSelector();
  buildBothEventsActions();
  wireArtwork();
  wireShare();
  wireOptionsSheet();
  wireActionBar();
  wireMusic();
  wireReveal();

  const firstKey = Object.keys(weddingConfig.events)[0];
  if (firstKey) selectEvent(firstKey);
}

document.addEventListener("DOMContentLoaded", init);
