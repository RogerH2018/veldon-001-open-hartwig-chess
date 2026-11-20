/*
 * 3D Hartwig Chess Set
 * Copyright (c) 2012 Julian Garnier
 * Licensed under the MIT license. See ../LICENSE.txt.
 * Adapted for Veldon Game.
 */

const chess = new Chess();
const openingPosition = chess.fen();
const app = document.getElementById("app");
const board = document.getElementById("board");
const scene = document.getElementById("scene");
const log = document.getElementById("log");
const undo = document.getElementById("undo");
const menu = document.getElementById("menu");
const jails = { w: document.getElementById("w-jail"), b: document.getElementById("b-jail") };
const cells = new Map(chess.SQUARES.map((square) => [square, document.getElementById(square)]));
let selectedSquare = null;
let pointer = null;

function createPiece(type, color) {
  const piece = document.getElementById(type).cloneNode(true);
  piece.removeAttribute("id");
  piece.classList.add(color === "w" ? "white" : "black");
  return piece;
}

function orientBoard(angle, tilt = 0) {
  scene.style.transform = `rotateX(${tilt}deg) rotateZ(${angle}deg)`;
  for (const sphere of board.querySelectorAll(".sphere")) {
    sphere.style.transform = `rotateZ(${-angle}deg) rotateX(${-tilt}deg)`;
  }
}

function updateBoard() {
  for (const [square, cell] of cells) {
    const piece = chess.get(square);
    const key = piece ? piece.color + piece.type : "";
    if (cell.dataset.piece === key) continue;

    cell.replaceChildren();
    if (piece) cell.append(createPiece(piece.type, piece.color));
    cell.dataset.piece = key;
  }

  const whiteTurn = chess.turn() === "w";
  const flat = app.dataset.theme === "flat";
  const white = flat ? "蓝方" : "白方";
  const black = flat ? "红方" : "黑方";
  const current = whiteTurn ? white : black;
  orientBoard(whiteTurn ? 0 : 180);

  if (chess.in_checkmate()) {
    log.textContent = `${whiteTurn ? black : white}胜出`;
  } else if (chess.in_draw()) {
    log.textContent = "和棋";
  } else {
    log.textContent = chess.in_check() ? `${current}被将军` : `轮到${current}`;
  }

  undo.dataset.state = chess.fen() === openingPosition ? "inactive" : "active";
}

function clearSelection() {
  selectedSquare = null;
  for (const cell of board.querySelectorAll(".current, .valid, .captured")) {
    cell.classList.remove("current", "valid", "captured");
  }
}

function selectSquare(square) {
  clearSelection();
  selectedSquare = square;
  cells.get(square).classList.add("current");
  for (const move of chess.moves({ verbose: true })) {
    if (move.from !== square) continue;
    const destination = cells.get(move.to);
    destination.classList.add("valid");
    if (move.captured) destination.classList.add("captured");
  }
}

function playSquare(square) {
  if (square === selectedSquare) {
    clearSelection();
    return;
  }
  if (chess.get(square)?.color === chess.turn()) {
    selectSquare(square);
    return;
  }
  if (!selectedSquare) return;

  const move = chess.move({ from: selectedSquare, to: square, promotion: "q" });
  if (!move) return;

  if (move.captured) {
    const capturedColor = move.color === "w" ? "b" : "w";
    jails[move.color].append(createPiece(move.captured, capturedColor));
  }
  clearSelection();
  updateBoard();
}

function startPointer(event) {
  if (app.dataset.state !== "game" || pointer || !event.isPrimary || event.button !== 0) return;
  const cell = event.target.closest(".square");
  if (!cell) return;

  pointer = {
    id: event.pointerId,
    square: cell.id,
    piece: chess.get(cell.id)?.color === chess.turn() ? cell.firstElementChild : null,
    x: event.clientX,
    y: event.clientY,
    dragging: false,
  };
  board.setPointerCapture(event.pointerId);
}

function movePointer(event) {
  if (pointer?.id !== event.pointerId || !pointer.piece) return;
  const dx = event.clientX - pointer.x;
  const dy = event.clientY - pointer.y;
  if (!pointer.dragging && Math.hypot(dx, dy) < 6) return;
  if (!pointer.dragging) {
    pointer.dragging = true;
    selectSquare(pointer.square);
    pointer.piece.classList.add("grabbed");
  }
  const direction = chess.turn() === "w" ? 1 : -1;
  pointer.piece.style.transform = `translate3d(${dx * direction}px, ${dy * direction}px, 2px)`;
}

function clearPointer() {
  if (pointer?.dragging) {
    pointer.piece.classList.remove("grabbed");
    pointer.piece.style.removeProperty("transform");
  }
  pointer = null;
}

function endPointer(event) {
  if (pointer?.id !== event.pointerId) return;
  const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest(".square");
  clearPointer();
  if (cell) playSquare(cell.id);
}

function continueGame() {
  app.dataset.state = "game";
  updateBoard();
}

function openMenu() {
  clearPointer();
  clearSelection();
  app.dataset.state = "menu";
  app.dataset.menu = "main";
  orientBoard(90, 70);
}

board.addEventListener("pointerdown", startPointer);
board.addEventListener("pointermove", movePointer);
board.addEventListener("pointerup", endPointer);
board.addEventListener("lostpointercapture", (event) => {
  if (pointer?.id === event.pointerId) clearPointer();
});

undo.addEventListener("click", () => {
  clearPointer();
  clearSelection();
  const move = chess.undo();
  if (move?.captured) jails[move.color].lastElementChild?.remove();
  updateBoard();
});

document.getElementById("open-menu").addEventListener("click", openMenu);
document.getElementById("continue").addEventListener("click", continueGame);
document.getElementById("restart").addEventListener("click", () => {
  clearSelection();
  chess.reset();
  jails.w.replaceChildren();
  jails.b.replaceChildren();
  continueGame();
});

document.getElementById("frame-switch").addEventListener("change", (event) => {
  app.dataset.frame = event.target.checked ? "on" : "off";
});

for (const button of menu.querySelectorAll(".menu-nav")) {
  button.addEventListener("click", () => {
    app.dataset.menu = button.dataset.menu;
  });
}

for (const button of menu.querySelectorAll(".set-theme")) {
  button.addEventListener("click", () => {
    app.dataset.theme = button.dataset.theme;
  });
}

continueGame();
