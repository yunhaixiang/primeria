import {
  RULES_VERSION,
  TILES_PER_PLAYER,
  TYPES,
  TYPE_MAP,
  MODES,
  newGame,
  total,
  coordinate,
  direction,
  graph,
  isEndpoint,
  claimPreview,
  segments,
  segmentNumber,
  applyMove,
  tick,
  setRunning,
  beginGameCountdown,
  finishGameCountdown,
  resign,
  scores,
  reviewPosition,
  isSupportedState,
  clone,
} from "./engine.js?v=78502c4ec6";
import {
  tileHTML,
  factorKeyHTML,
  tileLabel,
  escapeHTML as esc,
} from "./tiles.js?v=78502c4ec6";
import { orientPath } from "./paths.js?v=78502c4ec6";
import {
  extendChallenge,
  challengeReady,
} from "./challenge-selection.js?v=78502c4ec6";
import { gameResult } from "./review.js?v=78502c4ec6";
import { RULES_HTML } from "./rules-content.js?v=78502c4ec6";
import {
  logicalIndex as boardIndex,
  boardLabels,
} from "./board-view.js?v=78502c4ec6";
import { splitPanelHTML, splitPermissions } from "./split-view.js?v=78502c4ec6";
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];
const SAVE = `primeria.owned-paths.v${RULES_VERSION}`,
  ONLINE = 3;
let state = newGame(),
  action = "drop",
  selected = "j1",
  dropAt = null,
  claim = [],
  editing = null,
  path = [],
  factor = "",
  rotation = 0,
  reviewAt = null,
  role = null,
  peer = null,
  connection = null,
  networkLost = false,
  lastReceived = 0,
  heartbeatAt = 0,
  worker = null,
  botJob = null,
  botKey = null,
  toastTimer,
  syncAt = 0,
  savedAt = 0,
  muted = true,
  splitPreference = false,
  splitView = false,
  splitLastTurn = null;
const splitPhoneOpen = [true, false],
  splitHistoryOpen = [false, false];
try {
  const saved = JSON.parse(localStorage.getItem(SAVE));
  if (isSupportedState(saved)) {
    state = saved;
    delete state.startCountdown;
    state.paused = state.started && !state.ended;
    state.lastTick = Date.now();
  }
  muted = localStorage.getItem("primeria.sound") !== "on";
  splitPreference = localStorage.getItem("primeria.splitView") === "true";
} catch {}
function save() {
  if (role !== 1)
    try {
      localStorage.setItem(SAVE, JSON.stringify(state));
    } catch {}
}
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 4500);
}
function sound() {
  if (muted) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)(),
      o = ctx.createOscillator(),
      g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 430;
    g.gain.setValueAtTime(0.035, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    o.start();
    o.stop(ctx.currentTime + 0.13);
    o.onended = () => ctx.close();
  } catch {}
}
function ask(title, text) {
  $("#confirm-title").textContent = title;
  $("#confirm-text").textContent = text;
  $("#confirm-dialog").showModal();
  return new Promise((resolve) => {
    const done = (value) => {
      $("#confirm-dialog").close();
      $("#confirm-yes").onclick = null;
      $("#confirm-no").onclick = null;
      $("#confirm-dialog").oncancel = null;
      resolve(value);
    };
    $("#confirm-yes").onclick = () => done(true);
    $("#confirm-no").onclick = () => done(false);
    $("#confirm-dialog").oncancel = (e) => {
      e.preventDefault();
      done(false);
    };
  });
}
function shown() {
  return reviewAt === null ? state : reviewPosition(state, reviewAt);
}
function viewer() {
  return role ?? (state.bot ? 0 : state.turn);
}
function isBotTurn() {
  return !!state.bot && state.turn === state.bot.player;
}
function permitted() {
  return (
    reviewAt === null &&
    !state.ended &&
    state.started &&
    !state.startCountdown &&
    !state.paused &&
    !isBotTurn() &&
    (role === null || (connection?.open && state.turn === role))
  );
}
function reset() {
  dropAt = null;
  claim = [];
  editing = null;
  path = [];
  factor = "";
  if (!state.reserves[viewer()][selected])
    selected =
      TYPES.find((t) => state.reserves[viewer()][t.id] > 0)?.id ?? "j1";
}
function formatTime(seconds) {
  if (seconds === null) return "∞";
  const n = Math.ceil(seconds);
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
}
function buttonLabel(button, text) {
  const label = button.querySelector("[data-label]");
  if (label) label.textContent = text;
  else button.textContent = text;
}
function renderClocks() {
  const s = shown();
  let display = s;
  if (role === 1 && reviewAt === null) {
    display = clone(s);
    tick(display);
  }
  $$("[data-clock]").forEach((e) => {
    const p = Number(e.dataset.clock);
    e.textContent = formatTime(display.clocks[p]);
    e.classList.toggle(
      "low",
      display.clocks[p] !== null && display.clocks[p] < 60,
    );
    e.classList.toggle("paused", s.paused || !s.started);
  });
}
function renderPlayers() {
  const s = shown(),
    points = scores(s);
  $("#players").innerHTML = [0, 1]
    .map(
      (p) =>
        `<div class="player owner-${p} ${!s.ended && s.turn === p ? "active" : ""}"><div><div class="player-name"><span class="player-dot"></span>${esc(s.names[p])}${state.bot?.player === p ? " · CPU" : ""}</div><div class="player-meta">${points[p]} points · ${s.captured[p].length} captured</div></div><span class="clock" data-clock="${p}">${formatTime(s.clocks[p])}</span></div>`,
    )
    .join("");
  renderClocks();
}
function logicalIndex(r, c) {
  return boardIndex(r, c, rotation);
}
function renderBoard() {
  const s = shown(),
    owner = viewer(),
    allowed = permitted(),
    g = graph(s.board),
    indices =
      action === "claim"
        ? claim.map((t) => t.at)
        : action === "challenge"
          ? path
          : dropAt !== null
            ? [dropAt]
            : [];
  const labels = boardLabels(rotation);
  $("#columns").innerHTML = labels.columns
    .map((x) => `<span>${x}</span>`)
    .join("");
  $("#rows").innerHTML = labels.rows.map((x) => `<span>${x}</span>`).join("");
  $("#columns-bottom").innerHTML = $("#columns").innerHTML;
  $("#rows-right").innerHTML = $("#rows").innerHTML;
  const last = state.history.at(-1);
  const lastCells =
    last?.type === "drop"
      ? [last.at]
      : last?.type === "claim"
        ? last.tiles.map((t) => t.at)
        : (last?.path ?? []);
  $("#board").innerHTML = Array.from({ length: 225 }, (_, visual) => {
    const i = logicalIndex(Math.floor(visual / 15), visual % 15),
      actual = s.board[i],
      draft = claim.find((t) => t.at === i),
      tile = draft
        ? { ...actual, face: "arrow", rotation: draft.rotation }
        : actual,
      order = indices.indexOf(i);
    let next = false,
      clickable = false;
    if (allowed) {
      if (action === "drop") clickable = !actual;
      else if (action === "claim")
        clickable = actual?.owner === owner && actual.face === "digit";
      else if (action === "challenge") {
        clickable = actual?.owner === 1 - owner && actual.face === "arrow";
        next =
          clickable &&
          (path.length
            ? g.out[path.at(-1)].includes(i)
            : isEndpoint(s.board, g, i));
      }
    }
    const label = `${coordinate(i)}${actual ? `, ${tileLabel(actual)}` : ", empty square"}${order >= 0 ? `, selected ${order + 1}` : ""}`;
    const renderedTile = tile
      ? { ...tile, rotation: (tile.rotation + rotation) % 4 }
      : null;
    return `<button class="square ${(Math.floor(i / 15) + (i % 15)) % 2 ? "alt" : ""} ${actual ? "occupied" : "empty"} owner-${actual?.owner ?? owner} ${order >= 0 ? "selected" : ""} ${next ? "path-next" : ""} ${lastCells.includes(i) ? "last-move" : ""} ${editing === i ? "inspect" : ""}" data-at="${i}" data-order="${order + 1}" aria-label="${esc(label)}" title="${esc(label)}" ${clickable ? "" : "disabled"}>${renderedTile ? tileHTML(renderedTile) : allowed && action === "drop" && TYPE_MAP[selected] ? tileHTML({ type: selected, owner, face: "digit", rotation: 0 }).replace('class="tile', 'class="tile ghost') : ""}</button>`;
  }).join("");
}
function reserveHTML(p, interactive, display = shown()) {
  return TYPES.map(
    (t) =>
      `<button class="reserve-tile owner-${p} ${interactive && selected === t.id ? "active" : ""}" data-tile="${t.id}" ${!interactive || !display.reserves[p][t.id] ? "disabled" : ""} aria-label="${t.digit}, ${t.label}, ${display.reserves[p][t.id]} remaining${interactive && action === "challenge" ? ", challenge fee" : ""}" title="${t.digit} · ${t.label}">${tileHTML({ type: t.id, owner: p, face: "digit", rotation: 0 })}<span class="count">×${display.reserves[p][t.id]}</span></button>`,
  ).join("");
}
function renderReserve() {
  const p = viewer(),
    display = shown();
  $("#reserve-heading").textContent =
    action === "challenge" ? "Challenge fee" : `${state.names[p]}’s reserve`;
  $("#reserve-total").textContent = `${total(display.reserves[p])} tiles`;
  $("#reserve-caption").textContent =
    action === "challenge"
      ? "Your chosen tile goes to the opponent, even if the challenge fails."
      : "Small arrows are unclaimed. Large arrows are claimed.";
  $("#reserve").innerHTML = reserveHTML(
    p,
    permitted() && ["drop", "challenge"].includes(action),
  );
  $("#opponent-reserve").innerHTML = reserveHTML(1 - p, false);
  $("#opponent-total").textContent = `${total(display.reserves[1 - p])} tiles`;
}
function draftStatus() {
  if (action === "drop")
    return {
      okay: dropAt !== null && state.reserves[viewer()][selected] > 0,
      text:
        dropAt !== null
          ? `Ready to place ${TYPE_MAP[selected].digit} at ${coordinate(dropAt)}.`
          : "Select an empty square on the board.",
    };
  if (action === "claim") {
    try {
      const p = claimPreview(state.board, claim, viewer());
      return {
        okay: true,
        text: `Legal claim · part of a ${p.length}-tile path.`,
      };
    } catch (e) {
      return {
        okay: false,
        text: claim.length
          ? e.message
          : "Select your unclaimed tiles in arrow order.",
      };
    }
  }
  if (action === "challenge") {
    const result = challengeReady(state.board, path, 1 - viewer());
    if (result.error)
      return {
        okay: false,
        text: path.length
          ? result.error
          : "Choose a junction or end tile, then follow its arrows.",
      };
    if (!state.reserves[viewer()][selected])
      return {
        okay: false,
        text: "A challenge needs one unused tile as its fee.",
      };
    if (!/^\d+$/.test(factor) || factor.length > TILES_PER_PLAYER)
      return { okay: false, text: "Enter the factor you want to test." };
    const f = BigInt(factor),
      n = BigInt(result.number);
    return {
      okay: f > 1n && f < n,
      text:
        f <= 1n || f >= n
          ? "Use a factor greater than 1 and smaller than the number."
          : "The fee is paid for either outcome.",
    };
  }
  return {
    okay: true,
    text: state.passCount
      ? "A second consecutive pass ends the game. All unclaimed tiles will be captured."
      : "Passing leaves your reserve untouched.",
  };
}
function renderFeedback() {
  const status = draftStatus(),
    feedback = $("#move-feedback");
  feedback.textContent =
    reviewAt !== null
      ? "Reviewing a past position. Return to the game to play."
      : status.text;
  feedback.classList.toggle("valid", status.okay);
  const button = $("#commit-button");
  button.textContent = state.ended
    ? "Game complete"
    : state.startCountdown
      ? "Starting…"
      : !state.started
        ? "Start game"
        : state.paused
          ? "Resume game"
          : isBotTurn()
            ? "Computer is thinking…"
            : role !== null && state.turn !== role
              ? "Waiting for opponent…"
              : action === "drop"
                ? "Place tile"
                : action === "claim"
                  ? `Claim ${claim.length || ""} tiles`
                  : action === "challenge"
                    ? "Test factor"
                    : state.passCount
                      ? "Pass & finish"
                      : "Pass turn";
  button.disabled =
    !!state.ended ||
    !!state.startCountdown ||
    reviewAt !== null ||
    (state.started && !state.paused && !permitted()) ||
    (permitted() && !status.okay) ||
    (role !== null && !connection?.open);
  $("#clear-button").hidden = !indicesSelected();
  buttonLabel($("#pause-button"), state.paused ? "Resume" : "Pause");
  $("#pause-button").hidden = !state.started || !!state.ended;
  $("#pause-button").disabled =
    !!state.ended ||
    !!state.startCountdown ||
    reviewAt !== null ||
    (role !== null && !connection?.open);
  renderMobile();
  renderSplit();
  renderSession();
}
function splitAvailable() {
  return role === null && !state.bot;
}
function orientDialogs(seat = 0) {
  $$("dialog").forEach((d) =>
    d.classList.toggle("opposite-dialog", splitView && seat === 1),
  );
}
function renderSplit() {
  splitView = splitPreference && splitAvailable();
  document.body.classList.toggle("split-view", splitView);
  const button = $("#split-button");
  button.setAttribute("aria-pressed", String(splitView));
  button.disabled = !splitAvailable();
  button.title = splitAvailable()
    ? "Opposite-facing controls for one-device play"
    : "Split view is available when two people play on one device";
  buttonLabel($("#online-button"), role === null ? "Online" : "Online room");
  if (!splitView) orientDialogs();
  if (splitLastTurn !== state.turn && !state.ended) {
    splitPhoneOpen[0] = state.turn === 0;
    splitPhoneOpen[1] = state.turn === 1;
  }
  splitLastTurn = state.turn;
  const display = shown();
  const activeContent = $("#action-content").cloneNode(true);
  activeContent.querySelector("#factor-input")?.setAttribute("value", factor);
  for (const seat of [0, 1]) {
    const panel = $("#split-panel-" + seat);
    panel.hidden = !splitView;
    if (!splitView) continue;
    panel.setAttribute("aria-label", state.names[seat] + " player controls");
    const focused = panel.contains(document.activeElement)
        ? document.activeElement
        : null,
      field = focused?.dataset.splitField,
      command = focused?.dataset.splitCommand,
      value = focused?.dataset.value;
    const selection =
      field === "factor"
        ? [focused.selectionStart, focused.selectionEnd]
        : null;
    const scroll = panel.scrollTop,
      bodyScroll = panel.querySelector(".split-body")?.scrollTop ?? 0,
      journalScroll = panel.querySelector(".journal")?.scrollTop ?? 0;
    panel.innerHTML = splitPanelHTML(state, {
      seat,
      display,
      formatTime,
      action,
      selected,
      content: activeContent.innerHTML,
      feedback: $("#move-feedback").textContent,
      commitLabel: $("#commit-button").textContent,
      commitDisabled: $("#commit-button").disabled,
      clearVisible: !!indicesSelected(),
      phoneOpen: splitPhoneOpen[seat],
      historyOpen: splitHistoryOpen[seat],
      reviewAt,
      result: gameResult(state),
      journal: state.history.map(entryText),
      role,
      connected: !!connection?.open,
      botPlayer: state.bot?.player ?? null,
      networkLost,
      muted,
    });
    panel.scrollTop = scroll;
    panel.querySelector(".split-body").scrollTop = bodyScroll;
    panel.querySelector(".journal").scrollTop = journalScroll;
    const replacement = field
      ? panel.querySelector(`[data-split-field="${field}"]`)
      : command
        ? panel.querySelector(
            `[data-split-command="${command}"]${value === undefined ? "" : `[data-value="${value}"]`}`,
          )
        : null;
    if (replacement && !replacement.disabled) {
      replacement.focus({ preventScroll: true });
      if (selection) replacement.setSelectionRange(...selection);
    }
  }
}
$("#split-button").onclick = () => {
  if (!splitAvailable()) return;
  splitPreference = !splitPreference;
  try {
    localStorage.setItem("primeria.splitView", String(splitPreference));
  } catch {}
  render();
};
for (const panel of $$(".split-player-panel")) {
  panel.addEventListener(
    "toggle",
    (e) => {
      if (e.target.matches(".split-history"))
        splitHistoryOpen[Number(panel.dataset.seat)] = e.target.open;
    },
    true,
  );
  panel.addEventListener("input", (e) => {
    if (e.target.dataset.splitField !== "factor") return;
    const seat = Number(panel.dataset.seat);
    if (!splitPermissions(state, seat, { reviewAt }).canMove) return;
    factor = e.target.value.replace(/\D/g, "").slice(0, TILES_PER_PLAYER);
    e.target.value = factor;
    const main = $("#factor-input");
    if (main) main.value = factor;
    renderFeedback();
  });
  panel.addEventListener("change", (e) => {
    if (e.target.dataset.splitField !== "segment") return;
    const seat = Number(panel.dataset.seat);
    if (!splitPermissions(state, seat, { reviewAt }).canMove) return;
    const choice = segments(state.board, 1 - seat, 2000)[
      Number(e.target.value)
    ];
    path = e.target.value !== "" && choice ? [...choice.path] : [];
    renderBoard();
    renderControls();
  });
  panel.addEventListener("click", async (e) => {
    const button = e.target.closest("button");
    if (!button || button.disabled || !splitView) return;
    const seat = Number(panel.dataset.seat),
      command = button.dataset.splitCommand,
      permissions = splitPermissions(state, seat, { reviewAt });
    orientDialogs(seat);
    if (command === "panel") {
      splitPhoneOpen[seat] = !splitPhoneOpen[seat];
      renderSplit();
      return;
    }
    if (command === "new") return openSetup(seat);
    if (command === "rules") return openRules(seat);
    if (command === "pause" && (permissions.canPause || permissions.canStart))
      return dispatch({ type: "run", running: !state.started || state.paused });
    if (command === "download") return $("#download-button").click();
    if (command === "sound") return $("#sound-button").click();
    if (command === "resign" && permissions.canResign) {
      if (
        await ask(
          "Resign this game?",
          `${state.names[1 - seat]} will win. You can still review the game.`,
        )
      )
        dispatch({ type: "resign", player: seat });
      return;
    }
    if (command === "review") return selectReview(state.history.length);
    if (command === "history")
      return selectReview(Number(button.dataset.value));
    if (command === "first") return selectReview(0);
    if (command === "previous") return selectReview(reviewAt - 1);
    if (command === "next") return selectReview(reviewAt + 1);
    if (command === "last") return selectReview(state.history.length);
    if (command === "live") {
      reviewAt = null;
      render();
      return;
    }
    if (
      command === "commit" &&
      (permissions.canMove || permissions.canStart || permissions.canPause)
    )
      return $("#commit-button").click();
    if (!permissions.canMove) return;
    if (command === "action") {
      action = button.dataset.value;
      reset();
      render();
    } else if (command === "tile") {
      selected = button.dataset.value;
      renderControls();
      renderReserve();
      renderBoard();
    } else if (command === "clear") {
      reset();
      render();
    } else if (command === "align") $("#auto-orient")?.click();
    else if (command === "factor" || command === "delete") {
      factor =
        command === "delete"
          ? factor.slice(0, -1)
          : (factor + button.dataset.value).slice(0, TILES_PER_PLAYER);
      renderControls();
    } else if (button.matches("[data-edit],[data-rotate]"))
      $("#action-content").onclick(e);
  });
}
function renderCountdown() {
  const active = !!state.startCountdown;
  $("#start-countdown").hidden = !active;
  if (active) {
    const seconds = Math.max(
      1,
      Math.ceil((state.startCountdown.finishAt - Date.now()) / 1000),
    );
    $$("[data-countdown-text]").forEach(
      (n) => (n.textContent = `Game starts in ${seconds}…`),
    );
  }
}
function renderSession() {
  const inReview = reviewAt !== null,
    ended = !!state.ended,
    paused = state.started && state.paused && !ended,
    bot = isBotTurn() && state.started && !state.paused && !ended;
  $("#quick-start").hidden =
    state.started ||
    ended ||
    !!state.startCountdown ||
    (role !== null && !connection?.open);
  $("#game-end").hidden = !ended || inReview;
  $$("[data-result-title]").forEach((n) => (n.textContent = gameResult(state)));
  $("#board-turn-label").textContent =
    reviewAt !== null
      ? `TURN ${String(reviewAt).padStart(2, "0")}`
      : state.ended
        ? `${state.history.length} MOVES`
        : `TURN ${String(state.history.length + 1).padStart(2, "0")}`;
  $("#board-note").textContent = inReview
    ? `Review · Turn ${reviewAt} of ${state.history.length}`
    : state.startCountdown
      ? "Game is starting."
      : ended
        ? gameResult(state)
        : paused
          ? "Game is paused."
          : !state.started
            ? `Quick Start · ${state.mode} · 15 × 15`
            : bot
              ? "Bot is thinking…"
              : draftStatus().text;
  const session = $("#session-panel"),
    show = ended || paused || bot;
  session.hidden = !show;
  $("#move-options").hidden = show;
  const b = (command, label, primary = false) =>
    `<button data-session-command="${command}" class="${primary ? "primary-button" : "outline-button"}">${label}</button>`;
  if (ended)
    session.innerHTML = `<div><h2>${inReview ? "Review Game" : esc(gameResult(state))}</h2><p>${inReview ? `Turn ${reviewAt} of ${state.history.length}` : "Claimed tiles and captured tiles determine the score."}</p>${inReview ? `<div class="review-navigation">${b("first", "|←")}${b("previous", "←")}${b("next", "→")}${b("last", "→|")}</div>` : ""}<div class="session-actions">${b(inReview ? "result" : "review", inReview ? "Game Result" : "Review Game")}${b("new", "New Game")}</div></div>`;
  else if (paused)
    session.innerHTML = `<div><h2>Game is Paused</h2><div class="session-actions">${b("resume", "Resume", true)}${b("new", "New Game")}</div></div>`;
  else if (bot)
    session.innerHTML = `<div><h2>Bot is thinking…</h2><p>${state.bot.strength === "advanced" ? "Advanced" : state.bot.strength === "beginner" ? "Beginner" : "Intermediate"}</p><div class="session-actions">${b("pause", "Pause")}${b("resign", "Resign")}</div></div>`;
  renderCountdown();
}
$$("[data-quick-start]").forEach(
  (b) => (b.onclick = () => dispatch({ type: "run", running: true })),
);
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-session-command]");
  if (!b) return;
  const command = b.dataset.sessionCommand;
  if (command === "new") openSetup(b.closest(".split-facing") ? 1 : 0);
  if (command === "resume") dispatch({ type: "run", running: true });
  if (command === "pause") dispatch({ type: "run", running: false });
  if (command === "resign") $("#resign-button").click();
  if (command === "review") selectReview(state.history.length);
  if (command === "result") {
    reviewAt = null;
    render();
  }
  if (command === "first") selectReview(0);
  if (command === "previous") selectReview(reviewAt - 1);
  if (command === "next") selectReview(reviewAt + 1);
  if (command === "last") selectReview(state.history.length);
});
window.addEventListener("resize", () =>
  document.body.classList.toggle(
    "phone-layout",
    matchMedia("(max-width:780px)").matches,
  ),
);
function indicesSelected() {
  return dropAt !== null || claim.length || path.length;
}
function renderControls() {
  const p = viewer();
  $$("[data-action]").forEach((b) => {
    b.setAttribute("aria-pressed", b.dataset.action === action);
    b.disabled = !!state.ended || reviewAt !== null;
  });
  let content = "";
  if (action === "drop") content = "";
  if (action === "claim") {
    content =
      '<p class="step">Select at least <b>2 unclaimed tiles</b> in path order. The result must belong to a path of <b>9 or more tiles</b>.</p>';
    if (claim.length) {
      content += `<div class="selected-path">${claim.map((t) => `<button class="path-chip ${editing === t.at ? "selected-edit" : ""}" data-edit="${t.at}" aria-label="Edit ${coordinate(t.at)}">${tileHTML({ ...state.board[t.at], face: "arrow", rotation: t.rotation })}<span class="path-coordinate">${coordinate(t.at)}</span></button>`).join("")}</div><div class="rotation-controls"><span>${editing === null ? "Select a tile" : coordinate(editing)}</span><button data-rotate="-1" aria-label="Rotate selected tile counterclockwise">↶</button><button data-rotate="1" aria-label="Rotate selected tile clockwise">↷</button><button id="auto-orient">Align path</button></div>`;
    } else
      content +=
        '<div class="preview-help">Click tiles from tail to head. Arrows align automatically when their printed shapes allow it. You can adjust a tile’s rotation.</div>';
  }
  if (action === "challenge") {
    const all = segments(state.board, 1 - p, 2000),
      ready = challengeReady(state.board, path, 1 - p);
    content = `<p class="step">Choose an opponent’s <b>segment</b>, from a junction or end tile to another. Follow the highlighted arrows.</p><select class="segment-picker" id="segment-picker" aria-label="Choose an opponent segment"><option value="">Choose on board or select a segment…</option>${all.map((s, i) => `<option value="${i}" ${path.join(",") === s.path.join(",") ? "selected" : ""}>${coordinate(s.path[0])} → ${coordinate(s.path.at(-1))} · ${s.path.length} tiles · ${esc(s.number)}</option>`).join("")}</select><div class="number-preview"><p class="eyebrow">${ready.number ? "NUMBER TO CHALLENGE" : "READ FROM LAST TILE TO FIRST"}</p><output>${ready.number ?? (path.length > 1 ? esc(segmentNumber(state.board, path)) : "—")}</output><small>Arrows run from the ones digit toward higher places.</small></div><div class="factor-display-row"><label class="factor-label">YOUR PROPOSED FACTOR<input id="factor-input" inputmode="numeric" pattern="[0-9]*" maxlength="${TILES_PER_PLAYER}" autocomplete="off" value="${esc(factor)}" placeholder="Enter a factor" aria-label="Proposed factor"></label><button id="factor-backspace" class="factor-backspace tile-key owner-${p}" aria-label="Delete last factor digit">⌫</button></div><div id="factor-keypad" class="factor-keypad" data-standalone-only role="group" aria-label="Factor digits">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => factorKeyHTML(d, p)).join("")}</div><p class="inline-note">Fee: <b>${TYPE_MAP[selected].digit} · ${TYPE_MAP[selected].label}</b>. Choose a different fee in your reserve below.</p>`;
  }
  if (action === "pass")
    content = `<div class="preview-help">${state.passCount ? "<b>Your opponent passed.</b> Pass now to finish the game." : "Take no action this turn. Two consecutive passes finish the game."}<br><br>At the end, unclaimed tiles go to the opponent as captured tiles. Unused reserve tiles do not score.</div>`;
  $("#action-content").innerHTML = content;
  renderFeedback();
}
function entryText(e) {
  if (e.type === "drop")
    return {
      title: `Drop ${TYPE_MAP[e.tile].digit} · ${coordinate(e.at)}`,
      note: TYPE_MAP[e.tile].label,
    };
  if (e.type === "claim")
    return {
      title: `Claim ${e.tiles.length} tiles`,
      note: `${coordinate(e.tiles[0].at)} → ${coordinate(e.tiles.at(-1).at)} · ${e.length}-tile path`,
    };
  if (e.type === "challenge")
    return {
      title: e.success
        ? `Capture ${e.removed.length} tiles`
        : "Challenge failed",
      note: `${e.number} ÷ ${e.factor}${e.success ? " = " + (BigInt(e.number) / BigInt(e.factor)).toString() : ""} · fee ${TYPE_MAP[e.fee].digit}`,
    };
  return {
    title: "Pass",
    note: e.unclaimed ? "Two passes · game complete" : "",
  };
}
function renderJournal() {
  const previous = $("#journal").scrollTop,
    atBottom =
      $("#journal").scrollHeight - previous < $("#journal").clientHeight + 40;
  $("#journal").innerHTML = state.history
    .map((e, i) => {
      const text = entryText(e);
      return `<li><button data-review="${i + 1}" class="owner-${e.player} ${reviewAt === i + 1 ? "selected-review" : ""}" aria-label="Review turn ${i + 1}: ${esc(text.title)}"><span class="turn-num">${i + 1}.</span><span class="move-dot"></span><span>${esc(text.title)}<small class="move-note">${esc(text.note)}</small></span></button></li>`;
    })
    .join("");
  $("#journal").scrollTop = atBottom ? $("#journal").scrollHeight : previous;
  $("#empty-journal").hidden = !!state.history.length;
  $("#turn-count").textContent =
    `${state.history.length} ${state.history.length === 1 ? "move" : "moves"}`;
  $("#download-button").disabled = !state.history.length;
}
function render() {
  document.body.classList.toggle(
    "phone-layout",
    matchMedia("(max-width:780px)").matches,
  );
  const mode = MODES[state.mode];
  $("#mode-label").textContent =
    state.mode[0].toUpperCase() +
    state.mode.slice(1) +
    (mode[0] === null ? "" : ` · ${mode[0] / 60} + ${mode[1]}`);
  $("#turn-caption").textContent =
    reviewAt !== null
      ? "GAME REVIEW"
      : state.ended
        ? "FINAL POSITION"
        : !state.started
          ? "READY WHEN YOU ARE"
          : state.paused
            ? "GAME PAUSED"
            : isBotTurn()
              ? "COMPUTER’S TURN"
              : role !== null && state.turn !== role
                ? "OPPONENT’S TURN"
                : "NEXT MOVE";
  $("#turn-title").textContent =
    reviewAt !== null ? "Game Review" : state.ended ? "Game Over" : "Your move";
  $("#move-owner").textContent = state.names[state.turn].toUpperCase();
  $("#opponent-name").textContent =
    state.names[1 - viewer()].toUpperCase() + "’S RESERVE";
  $("#turn-description").textContent = state.ended
    ? "The board tells the story. Review any turn below."
    : !state.started
      ? "Build a path. Find a factor. Claim your ground."
      : state.paused
        ? "Resume when both players are ready."
        : state.passCount
          ? "One pass. Another consecutive pass will end the game."
          : "Drop, flip, or find a factor. Every turn shapes the board.";
  $("#result").hidden = !state.ended;
  if (state.ended) {
    const point = scores(state);
    $("#result").innerHTML =
      `<strong>${esc(state.names[0])} ${point[0]} — ${point[1]} ${esc(state.names[1])}</strong>${state.ended.reason === "passes" ? "Unclaimed tiles have been captured." : state.ended.reason === "time" ? "The active player ran out of time." : "The opponent resigned."}`;
  }
  buttonLabel($("#sound-button"), muted ? "Sound off" : "Sound on");
  $("#sound-button").setAttribute("aria-pressed", !muted);
  $("#resign-button").disabled =
    !state.started || !!state.ended || reviewAt !== null;
  $("#review-bar").hidden = reviewAt === null;
  if (reviewAt !== null) {
    $("#review-range").max = state.history.length;
    $("#review-range").value = reviewAt;
    $("#review-label").textContent = `${reviewAt} / ${state.history.length}`;
  }
  renderPlayers();
  renderBoard();
  renderControls();
  renderReserve();
  renderJournal();
}
$("#board").addEventListener("click", (e) => {
  const button = e.target.closest("[data-at]");
  if (!button || !permitted()) return;
  const at = Number(button.dataset.at);
  if (action === "drop") dropAt = at;
  if (action === "claim") {
    const pos = claim.findIndex((t) => t.at === at);
    if (pos >= 0) {
      claim = claim.slice(0, pos);
      editing = claim.at(-1)?.at ?? null;
    } else {
      if (claim.length && direction(claim.at(-1).at, at) < 0)
        return toast(
          "Choose a tile sharing an edge with the last selected tile.",
        );
      const indices = [...claim.map((t) => t.at), at],
        aligned = orientPath(state.board, indices, viewer());
      claim = aligned ?? [...claim, { at, rotation: 0 }];
      editing = at;
    }
  }
  if (action === "challenge") {
    const next = extendChallenge(state.board, path, at, 1 - viewer());
    if (next === path)
      return toast(
        path.length
          ? "Follow an arrow into the next tile, or clear the selection."
          : "Start at a junction or a regular end tile.",
      );
    path = next;
  }
  renderBoard();
  renderControls();
});
$$("[data-action]").forEach(
  (button) =>
    (button.onclick = () => {
      action = button.dataset.action;
      reset();
      render();
    }),
);
$("#reserve").onclick = (e) => {
  const tile = e.target.closest("[data-tile]");
  if (!tile || tile.disabled) return;
  selected = tile.dataset.tile;
  renderControls();
  renderReserve();
  renderBoard();
};
$("#action-content").addEventListener("input", (e) => {
  if (e.target.id === "factor-input") {
    factor = e.target.value.replace(/\D/g, "").slice(0, TILES_PER_PLAYER);
    e.target.value = factor;
    renderFeedback();
  }
});
$("#action-content").addEventListener("change", (e) => {
  if (e.target.id === "segment-picker") {
    const seg = segments(state.board, 1 - viewer(), 2000)[
      Number(e.target.value)
    ];
    path = e.target.value !== "" && seg ? [...seg.path] : [];
    renderBoard();
    renderControls();
  }
});
$("#action-content").onclick = (e) => {
  const key = e.target.closest("[data-factor-digit],#factor-backspace");
  if (key && permitted()) {
    factor =
      key.id === "factor-backspace"
        ? factor.slice(0, -1)
        : (factor + key.dataset.factorDigit).slice(0, TILES_PER_PLAYER);
    renderControls();
    return;
  }
  const edit = e.target.closest("[data-edit]"),
    rotate = e.target.closest("[data-rotate]");
  if (edit) {
    editing = Number(edit.dataset.edit);
    renderControls();
    renderBoard();
  }
  if (rotate && editing !== null) {
    const item = claim.find((t) => t.at === editing);
    item.rotation = (item.rotation + Number(rotate.dataset.rotate) + 4) % 4;
    renderControls();
    renderBoard();
  }
  if (e.target.id === "auto-orient") {
    const aligned = orientPath(
      state.board,
      claim.map((t) => t.at),
      viewer(),
    );
    if (aligned) claim = aligned;
    else toast("These tile shapes cannot connect in that order.");
    renderControls();
    renderBoard();
  }
};
$("#clear-button").onclick = () => {
  reset();
  render();
};
function renderMobile() {
  const dock = $("#mobile-dock");
  dock.hidden = !!state.ended || reviewAt !== null;
  $$("[data-mobile-action]").forEach((b) => {
    b.setAttribute("aria-pressed", b.dataset.mobileAction === action);
    b.disabled = !permitted();
  });
  $("#mobile-feedback").textContent = !state.started
    ? "Start when both players are ready."
    : state.paused
      ? "Game paused."
      : isBotTurn()
        ? "Computer is thinking…"
        : draftStatus().text;
  const tile = $("#mobile-tile");
  tile.hidden = !["drop", "challenge"].includes(action);
  tile.disabled = !permitted();
  tile.innerHTML =
    tileHTML({ type: selected, owner: viewer(), face: "digit", rotation: 0 }) +
    `<span>${action === "challenge" ? "Fee" : "Tile"}<b>${TYPE_MAP[selected].digit}</b></span>`;
  $("#mobile-rotate").hidden = action !== "claim" || editing === null;
  $("#mobile-clear").hidden = !indicesSelected();
  const commit = $("#mobile-commit"),
    needsFactor =
      permitted() &&
      action === "challenge" &&
      !!challengeReady(state.board, path, 1 - viewer()).number &&
      state.reserves[viewer()][selected] > 0;
  commit.textContent = needsFactor
    ? "Enter factor"
    : $("#commit-button").textContent;
  commit.disabled = needsFactor ? false : $("#commit-button").disabled;
}
$$("[data-mobile-action]").forEach(
  (b) =>
    (b.onclick = () => {
      action = b.dataset.mobileAction;
      reset();
      render();
    }),
);
$("#mobile-tile").onclick = () => {
  $("#tile-dialog-title").textContent =
    action === "challenge" ? "Choose your fee" : "Choose a tile";
  $("#tile-dialog-note").textContent =
    action === "challenge"
      ? "This tile goes to the opponent, for either outcome."
      : "The tilted arrow previews the route on the back.";
  $("#mobile-reserve").innerHTML = reserveHTML(viewer(), true);
  $("#tile-dialog").showModal();
};
$("#mobile-reserve").onclick = (e) => {
  const b = e.target.closest("[data-tile]");
  if (!b || b.disabled) return;
  selected = b.dataset.tile;
  $("#tile-dialog").close();
  render();
};
$("#mobile-rotate").onclick = () => {
  if (editing !== null) {
    const t = claim.find((t) => t.at === editing);
    t.rotation = (t.rotation + 1) % 4;
    renderControls();
    renderBoard();
  }
};
$("#mobile-clear").onclick = () => {
  reset();
  render();
};
$("#mobile-commit").onclick = () => {
  if (permitted() && action === "challenge") {
    const ready = challengeReady(state.board, path, 1 - viewer());
    if (!ready.number) return;
    $("#mobile-number").textContent = ready.number;
    $("#mobile-factor-input").value = factor;
    $("#mobile-factor-keypad").innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]
      .map((d) => factorKeyHTML(d, viewer()))
      .join("");
    $("#mobile-factor-backspace").className =
      `factor-backspace tile-key owner-${viewer()}`;
    $("#mobile-fee-note").textContent =
      `Fee: ${TYPE_MAP[selected].digit} · ${TYPE_MAP[selected].label}. Paid for either outcome.`;
    $("#mobile-test").disabled = !draftStatus().okay;
    $("#factor-dialog").showModal();
    $("#mobile-factor-input").focus();
  } else $("#commit-button").click();
};
$("#mobile-factor-input").oninput = (e) => {
  factor = e.target.value.replace(/\D/g, "").slice(0, TILES_PER_PLAYER);
  e.target.value = factor;
  const field = $("#factor-input");
  if (field) field.value = factor;
  renderFeedback();
  $("#mobile-test").disabled = !draftStatus().okay;
};
function mobileFactorKey(e) {
  const key = e.target.closest("[data-factor-digit],#mobile-factor-backspace");
  if (!key || !permitted()) return;
  const input = $("#mobile-factor-input");
  input.value =
    key.id === "mobile-factor-backspace"
      ? factor.slice(0, -1)
      : (factor + key.dataset.factorDigit).slice(0, TILES_PER_PLAYER);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}
$("#mobile-factor-keypad").onclick = mobileFactorKey;
$("#mobile-factor-backspace").onclick = mobileFactorKey;
$("#mobile-test").onclick = () => {
  $("#factor-dialog").close();
  $("#commit-button").click();
};

function sendState() {
  if (role === 0 && connection?.open)
    connection.send({
      type: "state",
      version: ONLINE,
      rulesVersion: RULES_VERSION,
      state,
      countdownRemaining: state.startCountdown
        ? Math.max(0, state.startCountdown.finishAt - Date.now())
        : null,
    });
}
function apply(command, actor = state.turn) {
  if (command.type === "run") {
    if (role !== null && !connection?.open)
      throw Error("Connect both players first.");
    if (command.running && !state.started) beginGameCountdown(state);
    else setRunning(state, command.running);
  } else if (command.type === "resign") {
    if (actor !== 0 && actor !== 1) throw Error("Choose a player.");
    resign(state, actor);
  } else if (command.type === "move") {
    if (actor !== state.turn) throw Error("Wait for your turn.");
    const event = applyMove(state, command.move);
    if (event.type === "challenge")
      toast(
        event.success
          ? `Verified: ${event.number} = ${event.factor} × ${BigInt(event.number) / BigInt(event.factor)}. Captured ${event.removed.length} tiles.`
          : "The factor does not divide the number. The fee stays with your opponent.",
      );
  } else throw Error("Unknown action.");
  reset();
  save();
  sendState();
  render();
  sound();
}
function dispatch(command) {
  try {
    if (role === 1) {
      if (!connection?.open) throw Error("Your opponent is disconnected.");
      connection.send({ type: "command", revision: state.revision, command });
    } else apply(command, role ?? viewer());
  } catch (e) {
    toast(e.message);
    render();
  }
}
$("#commit-button").onclick = async () => {
  if (!state.started || state.paused)
    return dispatch({ type: "run", running: true });
  if (!permitted()) return;
  let move;
  if (action === "drop") move = { type: "drop", at: dropAt, tile: selected };
  if (action === "claim") move = { type: "claim", tiles: clone(claim) };
  if (action === "challenge")
    move = { type: "challenge", fee: selected, path: [...path], factor };
  if (action === "pass") {
    if (
      state.passCount &&
      !(await ask(
        "Finish the game?",
        "Both players will have passed. Unclaimed tiles will be captured and the final score counted.",
      ))
    )
      return;
    move = { type: "pass" };
  }
  dispatch({ type: "move", move });
};
$("#pause-button").onclick = () =>
  dispatch({ type: "run", running: !state.started || state.paused });
$("#resign-button").onclick = async () => {
  if (
    await ask(
      "Resign this game?",
      "Your opponent will win. You can still review the game.",
    )
  )
    dispatch({ type: "resign", player: viewer() });
};
$("#rotate-board").onclick = () => {
  rotation = (rotation + 1) % 4;
  renderBoard();
};
$("#zoom-button").onclick = () => {
  const zoom = $("#board-scroll").classList.toggle("zoomed");
  $("#zoom-button").setAttribute("aria-pressed", zoom);
  buttonLabel($("#zoom-button"), zoom ? "Full board" : "Zoom");
};
$("#sound-button").onclick = () => {
  muted = !muted;
  try {
    localStorage.setItem("primeria.sound", muted ? "off" : "on");
  } catch {}
  render();
  sound();
};
function selectReview(at) {
  if (!state.ended)
    return toast("The turn journal becomes a review board when the game ends.");
  reviewAt = Math.max(0, Math.min(state.history.length, at));
  reset();
  render();
}
$("#journal").onclick = (e) => {
  const b = e.target.closest("[data-review]");
  if (b) selectReview(Number(b.dataset.review));
};
$("#review-range").oninput = (e) => selectReview(Number(e.target.value));
$("#review-prev").onclick = () => selectReview(reviewAt - 1);
$("#review-next").onclick = () => selectReview(reviewAt + 1);
$("#review-live").onclick = () => {
  reviewAt = null;
  render();
};
$("#download-button").onclick = () => {
  const record = {
    format: "Primeria owned paths",
    rulesVersion: RULES_VERSION,
    names: state.names,
    mode: state.mode,
    result: state.ended,
    moves: state.history.map((e, i) => ({
      turn: i + 1,
      player: state.names[e.player],
      ...e,
      description: entryText(e),
    })),
    state,
  };
  const url = URL.createObjectURL(
      new Blob([JSON.stringify(record, null, 2)], { type: "application/json" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = `primeria-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
$("#rules-body").innerHTML = RULES_HTML;
function openRules(seat = 0) {
  orientDialogs(seat);
  $("#rules-dialog").showModal();
}
$("#rules-button").onclick = () => openRules();
$$("[data-close]").forEach(
  (b) => (b.onclick = () => b.closest("dialog").close()),
);
const setup = $("#setup-form");
function setupOptions() {
  const location = setup.elements.location.value;
  $("#bot-options").hidden = location !== "bot";
  $("#online-options").hidden = location !== "online";
  $("#view-options").hidden = location !== "local";
  $("#room-code-label").hidden = setup.elements.roomAction.value !== "join";
  $("#setup-submit").textContent =
    location === "online"
      ? setup.elements.roomAction.value === "join"
        ? "Join game"
        : "Create invitation"
      : "Create game";
}
setup.addEventListener("change", setupOptions);
function openSetup(seat = 0, where = null) {
  orientDialogs(seat);
  setup.elements.location.value =
    where ?? (role !== null ? "online" : state.bot ? "bot" : "local");
  setup.elements.mode.value = state.mode;
  setup.elements.one.value = state.names[0];
  setup.elements.two.value = state.names[1];
  setup.elements.view.value = splitPreference ? "split" : "standard";
  $("#setup-dialog").showModal();
  setupOptions();
}
$("#new-button").onclick = () => openSetup();
$("#online-button").onclick = () => openSetup(0, "online");
function cancelBot() {
  worker?.terminate();
  worker = null;
  botJob = null;
  botKey = null;
}
setup.onsubmit = async (e) => {
  e.preventDefault();
  const data = new FormData(setup),
    where = data.get("location");
  if (
    state.started &&
    !state.ended &&
    !(await ask(
      "Start a new game?",
      "Replace the current game with a fresh board?",
    ))
  )
    return;
  if (where === "online" && !window.Peer)
    return toast(
      "The connection library is unavailable. Reload or play on one device.",
    );
  let roomCode = null;
  if (where === "online" && data.get("roomAction") === "join") {
    const raw = String(data.get("roomCode")).trim();
    try {
      roomCode = new URL(raw).searchParams.get("room");
    } catch {
      roomCode = raw;
    }
    if (!/^primeria-paths-[a-z0-9]{12}$/.test(roomCode ?? ""))
      return toast("Paste a Primeria invitation link or room code.");
  }
  leaveRoom(false);
  cancelBot();
  state = newGame({
    mode: data.get("mode"),
    names: [data.get("one"), data.get("two")],
    first:
      data.get("first") === "random"
        ? crypto.getRandomValues(new Uint8Array(1))[0] % 2
        : Number(data.get("first")),
    bot:
      where === "bot"
        ? {
            player: 1,
            strength: data.get("strength"),
            seed: crypto.getRandomValues(new Uint32Array(1))[0],
            id: crypto.randomUUID(),
          }
        : null,
  });
  if (where === "local") {
    splitPreference = data.get("view") === "split";
    try {
      localStorage.setItem("primeria.splitView", String(splitPreference));
    } catch {}
  }
  rotation = 0;
  reviewAt = null;
  action = "drop";
  reset();
  if (where === "online") {
    connectRoom(roomCode);
    render();
  } else {
    beginGameCountdown(state);
    $("#setup-dialog").close();
    save();
    render();
  }
};
function status(text) {
  $("#connection-status").replaceChildren();
  const dot = document.createElement("i");
  $("#connection-status").append(dot, document.createTextNode(text));
}
function leaveRoom(show = true) {
  const c = connection,
    p = peer;
  connection = null;
  peer = null;
  role = null;
  delete state.startCountdown;
  networkLost = false;
  lastReceived = 0;
  c?.close();
  p?.destroy();
  $("#leave-button").hidden = true;
  if (state.started && !state.ended) {
    tick(state);
    state.paused = true;
    state.lastTick = Date.now();
  }
  const url = new URL(location.href);
  url.searchParams.delete("room");
  history.replaceState(null, "", url);
  status("One device");
  $("#room-info").textContent = "";
  if (show) {
    save();
    render();
  }
}
function disconnect() {
  if (role === null || networkLost) return;
  networkLost = true;
  tick(state);
  state.paused = true;
  state.lastTick = Date.now();
  state.revision++;
  connection?.close();
  save();
  status("Disconnected · paused");
  $("#room-info").textContent =
    "Connection lost. Leave the room to continue on one device, or start a new online game.";
  toast("Connection lost. The game is paused.");
  render();
}
function bind(conn) {
  connection = conn;
  conn.on("open", () => {
    if (conn !== connection) return;
    networkLost = false;
    lastReceived = Date.now();
    status("Online · connected");
    $("#leave-button").hidden = false;
    if (role === 0) {
      if (!state.started && !state.ended) beginGameCountdown(state);
      else if (!state.ended) setRunning(state, true);
      sendState();
    }
    $("#setup-dialog").close();
    render();
  });
  conn.on("data", (data) => {
    if (conn !== connection || !data || typeof data !== "object") return;
    lastReceived = Date.now();
    if (role === 0 && data.type === "command") {
      if (data.revision !== state.revision) return sendState();
      try {
        if (!["run", "resign", "move"].includes(data.command?.type))
          throw Error("Unknown action.");
        apply(data.command, 1);
      } catch (e) {
        conn.send({ type: "error", message: e.message });
        sendState();
      }
    } else if (role === 1 && data.type === "state") {
      if (
        data.version !== ONLINE ||
        data.rulesVersion !== RULES_VERSION ||
        !isSupportedState(data.state)
      ) {
        toast("This room uses incompatible rules. Both players should reload.");
        return;
      }
      const changed = state.revision !== data.state.revision;
      state = data.state;
      if (state.startCountdown && Number.isFinite(data.countdownRemaining))
        state.startCountdown.finishAt =
          Date.now() + Math.max(0, Math.min(3000, data.countdownRemaining));
      state.lastTick = Date.now();
      if (changed) {
        reset();
        render();
        sound();
      } else renderClocks();
    } else if (data.type === "error") toast(String(data.message).slice(0, 200));
  });
  conn.on("close", () => {
    if (conn === connection) disconnect();
  });
  conn.on("error", () => {
    if (conn === connection) disconnect();
  });
}
function connectRoom(code) {
  role = code ? 1 : 0;
  const room =
    code ??
    `primeria-paths-${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
  status(code ? "Joining room…" : "Waiting for a friend");
  $("#room-info").textContent = "Connecting…";
  const active = (peer = code ? new Peer() : new Peer(room));
  $("#leave-button").hidden = false;
  active.on("open", () => {
    if (peer !== active) return;
    if (code)
      bind(
        active.connect(code, {
          reliable: true,
          metadata: { version: ONLINE, rulesVersion: RULES_VERSION },
        }),
      );
    else {
      const url = new URL(location.href);
      url.searchParams.set("room", room);
      history.replaceState(null, "", url);
      $("#room-info").innerHTML =
        `<strong>Your invitation is ready.</strong><p>Send this link to your friend. Keep this tab open.</p><input id="invite-link" readonly aria-label="Invitation link" value="${esc(url.href)}"><button id="copy-link" type="button" class="outline-button">Copy invitation ↗</button>`;
      $("#copy-link").onclick = async () => {
        try {
          await navigator.clipboard.writeText(url.href);
          toast("Invitation copied.");
        } catch {
          $("#invite-link").select();
        }
      };
    }
  });
  active.on("connection", (incoming) => {
    if (role !== 0 || connection) {
      incoming.on("open", () => incoming.close());
      return;
    }
    if (
      incoming.metadata?.version !== ONLINE ||
      incoming.metadata?.rulesVersion !== RULES_VERSION
    ) {
      incoming.on("open", () => {
        incoming.send({
          type: "error",
          message:
            "Both players need the latest Primeria. Reload and create a fresh room.",
        });
        setTimeout(() => incoming.close(), 300);
      });
      return;
    }
    bind(incoming);
  });
  active.on("error", (error) => {
    if (peer === active) {
      $("#room-info").textContent =
        `Unable to connect (${error.type ?? "network error"}). Try another network or play on one device.`;
      if (connection?.open) disconnect();
    }
  });
}
$("#leave-button").onclick = async () => {
  if (
    await ask(
      "Leave the online room?",
      "The game will be paused. You can continue on this device.",
    )
  )
    leaveRoom();
};
function updateBot() {
  if (
    !state.bot ||
    role !== null ||
    !state.started ||
    state.paused ||
    state.ended ||
    !isBotTurn()
  ) {
    if (botJob) {
      cancelBot();
    }
    return;
  }
  if (botJob) return;
  const id = `${state.bot.id}:${state.revision}`;
  botJob = id;
  try {
    if (!worker || botKey !== state.bot.id) {
      cancelBot();
      botJob = id;
      worker = new Worker(
        new URL("./bot-worker.js?v=78502c4ec6", import.meta.url),
        {
          type: "module",
        },
      );
      botKey = state.bot.id;
      worker.onmessage = ({ data }) => {
        if (data.id !== botJob) return;
        if (data.error) return botFailure(data.error);
        setTimeout(() => {
          if (botJob !== data.id) return;
          botJob = null;
          try {
            apply(
              { type: "move", move: data.result.command },
              state.bot.player,
            );
          } catch (e) {
            botFailure(e.message);
          }
        }, 450);
      };
      worker.onerror = (e) => {
        e.preventDefault();
        botFailure("The computer could not finish its search.");
      };
    }
    worker.postMessage({
      id,
      key: state.bot.id,
      state: clone(state),
      seed: state.bot.seed,
    });
  } catch (e) {
    botFailure(e.message);
  }
}
function botFailure(message) {
  cancelBot();
  state.paused = true;
  state.revision++;
  save();
  render();
  toast(`${message} Resume to retry.`);
}
setInterval(() => {
  const now = Date.now();
  if (role !== null && connection?.open && !networkLost) {
    if (lastReceived && now - lastReceived > 15000) disconnect();
    else if (role === 1 && now - heartbeatAt > 1000) {
      connection.send({ type: "ping" });
      heartbeatAt = now;
    }
  }
  if (role !== 1) {
    if (state.startCountdown && finishGameCountdown(state, now)) {
      reset();
      save();
      sendState();
      render();
    }
    const ended = state.ended;
    tick(state);
    if (!ended && state.ended) {
      reset();
      save();
      sendState();
      render();
    }
    updateBot();
    if (Date.now() - syncAt > 1000) {
      sendState();
      syncAt = Date.now();
    }
    if (Date.now() - savedAt > 2000) {
      save();
      savedAt = Date.now();
    }
  }
  renderClocks();
  renderCountdown();
}, 200);
window.addEventListener("pagehide", () => {
  save();
  cancelBot();
  connection?.close();
  peer?.destroy();
});
document.addEventListener("keydown", (e) => {
  if (e.target.matches("input,select,textarea") || $("dialog[open]")) return;
  if (e.key === "Escape") {
    reset();
    render();
  }
  if (
    e.key.toLowerCase() === "r" &&
    action === "claim" &&
    editing !== null &&
    permitted()
  ) {
    const t = claim.find((t) => t.at === editing);
    t.rotation = (t.rotation + 1) % 4;
    renderControls();
    renderBoard();
  }
  if (reviewAt !== null && ["ArrowLeft", "ArrowRight"].includes(e.key)) {
    e.preventDefault();
    selectReview(reviewAt + (e.key === "ArrowLeft" ? -1 : 1));
  }
});
render();
const invitation = new URL(location.href).searchParams.get("room");
if (invitation) {
  setup.elements.location.value = "online";
  setup.elements.roomAction.value = "join";
  setup.elements.roomCode.value = invitation;
  setupOptions();
  $("#setup-dialog").showModal();
}
