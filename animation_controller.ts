import {
  DecodeChar,
  MatchDecodeChar,
  MatchDecodeItem,
  DecodeCharType,
  CharController
} from './app';
import {
  BPS_INPUT_ID,
  BPS_DISPLAY_ID,
  HTML_ANIM_CHAR_ACTIVE,
  HTML_ANIM_SRC_CHAR_ACTIVE,
  HTML_ANIM_MATCH_SRC_ACTIVE,
  HTML_ANIM_MATCH_DEST_ACTIVE
} from './html';
import { findEl, addAllClass, removeAllClass } from './utils';
export default class AnimationController {
  controller: CharController;
  curIndex: number;
  elapsed: number;
  bpsInput: HTMLInputElement;
  bpsDisplay: HTMLElement;
  bitsPerSecond: number;
  chars: DecodeChar[];
  matches: MatchDecodeItem[];
  stats: object;
  running: boolean;
  constructor(controller: CharController) {
    this.controller = controller;
    this.chars = controller.chars;
    this.matches = controller.matches;
    this.curIndex = this.elapsed = 0;
    let bpsInput = document.getElementById(BPS_INPUT_ID);
    if (!bpsInput) throw `No bps input`;
    this.bpsInput = bpsInput as HTMLInputElement;

    let bpsDisplay = document.getElementById(BPS_DISPLAY_ID);
    if (!bpsDisplay) throw `No bps input`;
    this.bpsDisplay = bpsDisplay as HTMLElement;

    this.running = false;
    this.stats = {
      startAt: undefined,
      totalBits: 0,
      totalSec: 0
    };
    this.bitsPerSecond = parseInt(this.bpsInput.value, 10);
    this.addListeners();
    this.updateUI();
  }

  addListeners() {
    this.bpsInput.addEventListener('input', () => {
      this.bitsPerSecond = parseInt(this.bpsInput.value);
      this.updateUI();
    });
  }

  updateUI() {
    this.bpsDisplay.innerText = '' + this.bitsPerSecond;
  }

  run() {
    this.running = true;
    requestAnimationFrame(() => this.tick());
  }

  tick(bitsToReveal = 0, lastRun = new Date().getTime()) {
    if (!this.running) {
      return;
    }
    let { bitsPerSecond } = this;
    let now = new Date().getTime();
    let elapsedSec = (now - lastRun) / 1000;
    bitsToReveal += bitsPerSecond * elapsedSec;
    while (true) {
      let char = this.controller.chars[this.curIndex];
      if (!char) {
        return; // stop animating
      }
      if (char.bitLength <= bitsToReveal) {
        this.curIndex += 1;
        bitsToReveal -= char.bitLength;
        this.reveal(char);
        this.updateStats(char);
      } else {
        break;
      }
    }
    requestAnimationFrame(() => this.tick(bitsToReveal, now));
  }

  stop() {
    this.running = false;
  }

  updateStats(char: DecodeChar) {
    if (this.stats.startAt === undefined) {
      this.stats.startAt = new Date().getTime();
    }
    this.stats.totalSec = (new Date().getTime() - this.stats.startAt) / 1000;
    this.stats.totalBits += char.bitLength;
    this.stats.avgBps = this.stats.totalBits / this.stats.totalSec;
  }

  reveal(char: DecodeChar) {
    removeAllClass([
      HTML_ANIM_CHAR_ACTIVE,
      HTML_ANIM_SRC_CHAR_ACTIVE,
      HTML_ANIM_MATCH_DEST_ACTIVE,
      HTML_ANIM_MATCH_SRC_ACTIVE
    ]);
    this.controller.reveal(char);
    this.activate(char);
    this.highlightMatch(char);
  }

  activate(char: DecodeChar) {
    let el = this.controller.findEl(char.index);
    el.classList.add(HTML_ANIM_CHAR_ACTIVE);
  }

  highlightMatch(char: DecodeChar) {
    if (char.type !== DecodeCharType.Match) {
      return;
    }
    let matchChar = char as MatchDecodeChar;

    // Find all src chars for this match, light them up
    let srcChars = Array.from(
      document.querySelectorAll(
        `[data-dest-match-index-${matchChar.matchIndex}]`
      )
    );
    addAllClass(srcChars, [HTML_ANIM_MATCH_SRC_ACTIVE]);

    // Find the src char for this char, light it up specially
    let srcChar = findEl(`[data-index="${matchChar.srcIndex}"]`);
    addAllClass([srcChar], [HTML_ANIM_SRC_CHAR_ACTIVE]);

    // Light up this entire match
    let matchChars = Array.from(
      document.querySelectorAll(`[data-match-index="${matchChar.matchIndex}"]`)
    );
    addAllClass(matchChars, [HTML_ANIM_MATCH_DEST_ACTIVE]);
  }
}
