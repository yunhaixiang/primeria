import {
  TYPES,
  TYPE_MAP,
  MODES,
  total,
  scores,
  scoreBreakdown,
} from "./engine.js?v=d746a55b94";
import {
  tileHTML,
  factorKeyHTML,
  escapeHTML as escape,
} from "./tiles.js?v=d746a55b94";

export function splitPermissions(
  state,
  seat,
  {
    role = null,
    connected = true,
    botPlayer = null,
    networkLost = false,
    reviewAt = null,
  } = {},
) {
  const human =
    seat !== botPlayer && (role === null || (connected && role === seat));
  const available =
    human &&
    !networkLost &&
    reviewAt === null &&
    !state.ended &&
    !state.startCountdown;
  return {
    canMove: available && state.started && !state.paused && state.turn === seat,
    canStart: available && !state.started,
    canPause: available && state.started,
    canResign:
      available &&
      state.started &&
      !state.paused &&
      (state.turn === seat || state.turn === botPlayer),
  };
}

/** Keep cloned action controls accessible without duplicating the sidebar's IDs. */
export function splitActionHTML(html, seat) {
  return html
    .replace(/<div[^>]*data-standalone-only[^>]*>[\s\S]*?<\/div>/g, "")
    .replace(
      /\bid="([^"]+)"/g,
      (_, id) =>
        `id="split-${seat}-${id}"${id === "factor-input" ? ' data-split-field="factor"' : id === "segment-picker" ? ' data-split-field="segment"' : id === "factor-backspace" ? ' data-split-command="delete"' : id === "auto-orient" ? ' data-split-command="align"' : ""}`,
    );
}

export function splitPanelHTML(state, options) {
  const {
    seat,
    display = state,
    formatTime,
    action = "drop",
    selected = "j1",
    content = "",
    feedback = "",
    commitLabel = "",
    commitDisabled = true,
    clearVisible = false,
    phoneOpen = false,
    historyOpen = false,
    reviewAt = null,
    result = "",
    muted = true,
    journal = [],
  } = options;
  const permissions = splitPermissions(state, seat, options),
    current = state.turn === seat,
    { canMove, canStart, canPause, canResign } = permissions;
  const points = scores(display),
    breakdown = scoreBreakdown(display),
    reserve = display.reserves[seat],
    mode = MODES[state.mode];
  const button = (command, label, disabled = false, extra = "") =>
    `<button type="button" data-split-command="${command}" ${disabled ? "disabled" : ""} ${extra}>${label}</button>`;
  const status =
    reviewAt !== null
      ? "Game review"
      : state.ended
        ? "Game complete"
        : state.startCountdown
          ? "Starting…"
          : !state.started
            ? "Ready to begin"
            : state.paused
              ? "Game paused"
              : current
                ? "Your turn"
                : `Waiting for ${escape(state.names[state.turn])}`;
  const actions = `<div class="actions" role="group" aria-label="Move type for ${escape(state.names[seat])}">${["drop", "claim", "challenge", "pass"].map((value) => button("action", value[0].toUpperCase() + value.slice(1), !canMove, `data-value="${value}" aria-pressed="${current && action === value}"`)).join("")}</div>`;
  let controls = "";
  if (state.ended) {
    controls = `<div class="preview-help"><b>${escape(result)}</b>${reviewAt === null ? `<p>Review the turns to explore the game.</p>${button("review", "Review game", !state.history.length)}` : `<p>Turn ${reviewAt} of ${state.history.length}</p><div class="split-review-nav">${button("first", "|←", reviewAt === 0, 'aria-label="Starting position"')}${button("previous", "←", reviewAt === 0, 'aria-label="Previous turn"')}${button("next", "→", reviewAt === state.history.length, 'aria-label="Next turn"')}${button("last", "→|", reviewAt === state.history.length, 'aria-label="Final position"')}</div>${button("live", "Show result")}`}</div>`;
  } else if (!state.started || state.paused) {
    controls = `<div class="preview-help">${!state.started ? "Begin when both players are ready." : "Resume when both players are ready."}</div>${button("commit", !state.started ? "Start game" : "Resume game", !(canStart || canPause), 'class="commit-button"')}`;
  } else {
    controls =
      actions +
      (current
        ? splitActionHTML(content, seat)
        : `<p class="step">Your opponent is making a move. Your reserve stays visible below.</p>`);
    if (current && action === "challenge")
      controls += `<div class="split-keypad" role="group" aria-label="Factor keypad for ${escape(state.names[seat])}">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => factorKeyHTML(d, seat, { split: true, disabled: !canMove })).join("")}${button("delete", "⌫", !canMove, `class="factor-backspace tile-key owner-${seat}" aria-label="Delete last factor digit"`)}</div>`;
    if (current)
      controls += `<p class="move-feedback" aria-live="polite">${escape(feedback)}</p><div class="split-move-buttons">${button("commit", commitLabel, commitDisabled || !canMove, 'class="commit-button"')}${clearVisible ? button("clear", "↶", !canMove, 'class="outline-button" aria-label="Clear selection"') : ""}</div>`;
  }
  const reserveHTML = TYPES.map(
    (type) =>
      `<button class="reserve-tile owner-${seat} ${current && selected === type.id ? "active" : ""} ${reserve[type.id] ? "" : "exhausted"}" data-split-command="tile" data-value="${type.id}" aria-label="${type.digit}, ${type.label}, ${reserve[type.id]} remaining" ${canMove && ["drop", "challenge"].includes(action) && reserve[type.id] > 0 ? "" : "disabled"} title="${type.digit} · ${type.label}">${tileHTML({ type: type.id, owner: seat, face: "digit", rotation: 0 })}<span class="count">×${reserve[type.id]}</span></button>`,
  ).join("");
  const rows = journal
    .map(
      (item, index) =>
        `<li>${button("history", `<span class="turn-num">${index + 1}.</span><span>${escape(item.title)}<small class="move-note">${escape(item.note)}</small></span>`, !state.ended, `data-value="${index + 1}" ${reviewAt === index + 1 ? 'aria-current="step"' : ""}`)}</li>`,
    )
    .join("");
  return `<header class="split-seat-heading owner-${seat}"><div><p class="eyebrow">PLAYER ${seat + 1}</p><h2>${escape(state.names[seat])}</h2><p class="split-status">${status}</p></div><span class="clock" data-clock="${seat}">${formatTime(display.clocks[seat])}</span>${button("panel", phoneOpen ? "Close" : "Moves", false, `class="split-panel-toggle" aria-expanded="${phoneOpen}" aria-controls="split-body-${seat}" aria-label="${phoneOpen ? "Close" : "Open"} controls for ${escape(state.names[seat])}"`)}</header>
 <div id="split-body-${seat}" class="split-body" data-phone-open="${phoneOpen}"><div class="split-score"><span>${points[seat]} points · ${breakdown[seat].territory} territory · ${display.captured[seat].length} captured${breakdown[seat].growing ? ` · ${breakdown[seat].growing} below nine` : ""}</span><span>${mode[0] === null ? "Casual" : state.mode + " · " + mode[0] / 60 + " + " + mode[1]}</span></div><div class="split-opponent-summary"><span>${escape(state.names[1 - seat])} · ${points[1 - seat]} points</span><b data-clock="${1 - seat}">${formatTime(display.clocks[1 - seat])}</b></div><div class="split-session-tools">${button("new", "New game")}${button("pause", !state.started ? "Start" : state.paused ? "Resume" : "Pause", !(canPause || canStart))}${button("rules", "Rules")}${button("sound", muted ? "Sound off" : "Sound on")}${button("resign", "Resign", !canResign)}</div><div class="split-controls">${controls}</div><section class="split-reserve"><div class="section-title"><h3>${current && action === "challenge" ? "Your challenge fee" : "Your reserve"}</h3><span>${total(reserve)} tiles</span></div><div class="reserve">${reserveHTML}</div></section><details class="split-history" ${historyOpen ? "open" : ""}><summary>Turn journal · ${state.history.length}</summary><ol class="journal">${rows || '<li class="subtle">No moves yet.</li>'}</ol>${button("download", "Save game record ↓", !state.history.length, 'class="text-button small"')}</details></div>`;
}
