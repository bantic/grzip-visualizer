import {
  DecodeChar,
  MatchDecodeChar,
  MatchDecodeItem,
  DecodeCharType,
  CharController,
  App
} from './app';
import {
  BPS_INPUT_ID,
  BPS_DISPLAY_ID,
  HTML_ANIM_CHAR_ACTIVE,
  HTML_ANIM_SRC_CHAR_ACTIVE,
  HTML_ANIM_MATCH_SRC_ACTIVE,
  HTML_ANIM_MATCH_DEST_ACTIVE
} from './html';
import { addAllClass } from './utils';
interface HtmlChange {
  els: HTMLElement[];
  classNames: string[];
}
export default class AnimationController {
  app: App;
  controller: CharController;
  curIndex: number;
  elapsed: number;
  bpsInput: HTMLInputElement;
  bpsDisplay: HTMLElement;
  bitsPerSecond: number;
  chars: DecodeChar[];
  matches: MatchDecodeItem[];
  stats: {
    startAt: null | number;
    totalBits: number;
    totalSec: number;
    avgBps: number;
  };
  running: boolean;
  pendingHtmlChanges: HtmlChange[];
  constructor(controller: CharController, app: App) {
    this.app = app;
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

    this.pendingHtmlChanges = [];

    this.running = false;
    this.stats = {
      startAt: null,
      totalBits: 0,
      totalSec: 0,
      avgBps: 0
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
    let chars = [];
    while (true) {
      let char = this.controller.chars[this.curIndex];
      if (!char) {
        return; // stop animating
      }
      if (char.bitLength <= bitsToReveal) {
        this.curIndex += 1;
        bitsToReveal -= char.bitLength;
        chars.push(char);
        this.updateStats(char);
      } else {
        break;
      }
    }

    for (let char of chars) {
      this.controller.reveal(char);
    }
    if (chars.length) {
      this.reveal(chars[chars.length - 1]);
    }
    requestAnimationFrame(() => this.tick(bitsToReveal, now));
  }

  stop() {
    this.running = false;
    this.clearClasses();
  }

  clearClasses() {
    for (let change of this.pendingHtmlChanges) {
      for (let el of change.els) {
        el.classList.remove(...change.classNames);
      }
    }
    this.pendingHtmlChanges = [];
  }

  updateStats(char: DecodeChar) {
    if (this.stats.startAt === null) {
      this.stats.startAt = new Date().getTime();
    }
    this.stats.totalSec = (new Date().getTime() - this.stats.startAt) / 1000;
    this.stats.totalBits += char.bitLength;
    this.stats.avgBps = this.stats.totalBits / this.stats.totalSec;
  }

  reveal(char: DecodeChar) {
    this.clearClasses();
    this.controller.reveal(char);
    this.activate(char);
    this.highlightMatch(char);
  }

  activate(char: DecodeChar) {
    let el = this.app.charEls[char.index];
    el.classList.add(HTML_ANIM_CHAR_ACTIVE);
    this.pendingHtmlChanges.push({
      els: [el],
      classNames: [HTML_ANIM_CHAR_ACTIVE]
    });
  }

  highlightMatch(char: DecodeChar) {
    if (char.type !== DecodeCharType.Match) {
      return;
    }
    let matchChar = char as MatchDecodeChar;

    // Find all src chars for this match, light them up
    let srcEls = this.app.matchEls[matchChar.matchIndex].srcEls;
    let srcElsClasses = [HTML_ANIM_MATCH_SRC_ACTIVE];
    addAllClass(srcEls, srcElsClasses);
    this.pendingHtmlChanges.push({
      els: srcEls,
      classNames: srcElsClasses
    });

    // Find the src char for this char, light it up specially
    let srcEl = this.app.charEls[matchChar.srcIndex];
    let srcElClasses = [HTML_ANIM_SRC_CHAR_ACTIVE];
    addAllClass([srcEl], srcElClasses);
    this.pendingHtmlChanges.push({
      els: [srcEl],
      classNames: srcElClasses
    });

    // Light up this entire match
    let matchEls = this.app.matchEls[matchChar.matchIndex].destEls;
    let matchElsClasses = [HTML_ANIM_MATCH_DEST_ACTIVE];
    addAllClass(matchEls, matchElsClasses);
    this.pendingHtmlChanges.push({
      els: matchEls,
      classNames: matchElsClasses
    });
  }
}
