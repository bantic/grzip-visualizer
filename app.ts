import {
  HTML_CHAR_ACTIVE_CLASS,
  HTML_CHAR_EL_CLASSES,
  HTML_CHAR_CLASS,
  HTML_HIDDEN
} from './html';
import { findEl, removeAllClass, quantize } from './utils';

interface DecodeData {
  bits: boolean[];
  block_id: number;
}

interface RawDecodeItem {
  type: DecodeItemType;
  data: DecodeData;
}

interface RawLiteralDecodeItem extends RawDecodeItem {
  value: number; // byte value
}

interface RawMatchDecodeItem extends RawDecodeItem {
  length: number;
  distance: number;
}

enum DecodeItemType {
  Literal = 'Literal',
  Match = 'Match'
}
export enum DecodeCharType {
  Literal = DecodeItemType.Literal,
  Match = DecodeItemType.Match
}

interface DecodeItem extends RawDecodeItem {
  chars: string[];
}

interface LiteralDecodeItem extends DecodeItem {}
export interface MatchDecodeItem extends DecodeItem {
  length: number;
  distance: number;
}

export interface DecodeChar {
  type: DecodeCharType;
  char: string;
  index: number;
  item: DecodeItem;
  bits: boolean[];
  bitLength: number;
  destMatchIndices: number[]; // The indices of all match(es) that reference this char
}

interface LiteralDecodeChar extends DecodeChar {}

export interface MatchDecodeChar extends DecodeChar {
  srcIndex: number; // The index of the DecodeChar this was copied from
  matchIndex: number; // The index of the match that produced this DecodeChar
}

class DecodeItemParser {
  rawData: RawDecodeItem[];
  parsedData: DecodeItem[];
  curIndex: number;
  bytes: number[];
  constructor(data: RawDecodeItem[]) {
    this.rawData = data;
    this.parsedData = [];
    this.curIndex = 0;
    this.bytes = [];
  }
  parse(): DecodeItem[] {
    this.curIndex = 0;
    for (let item of this.rawData) {
      this.parsedData.push(this.parseItem(item));
    }
    return this.parsedData;
  }

  parseItem(item: RawDecodeItem): DecodeItem {
    if (item.type === DecodeItemType.Literal) {
      return this.parseLiteral(item as RawLiteralDecodeItem);
    } else if (item.type === DecodeItemType.Match) {
      return this.parseMatch(item as RawMatchDecodeItem);
    } else {
      throw `Unexpected item type ${item.type}`;
    }
  }

  parseLiteral(item: RawLiteralDecodeItem): LiteralDecodeItem {
    let value = item.value;
    this.bytes.push(value);
    this.curIndex += 1;
    return {
      type: item.type,
      data: item.data,
      chars: [this.stringValue(value)]
    };
  }

  parseMatch(item: RawMatchDecodeItem): MatchDecodeItem {
    let { length, distance } = item;
    let srcIndex = this.curIndex - distance;
    let chars = [];
    for (let i = 0; i < length; i++) {
      let byte = this.bytes[srcIndex + i];
      this.bytes.push(byte);
      chars.push(this.stringValue(byte));
      this.curIndex += 1;
    }
    return {
      type: item.type,
      data: item.data,
      length,
      distance,
      chars
    };
  }

  stringValue(byte: number): string {
    const NEW_LINE = 0x0a;

    if (byte >= 0x20 && byte <= 0x7e) {
      return String.fromCharCode(byte);
    } else if (byte == NEW_LINE) {
      return '\\n';
    } else {
      return `0x${byte.toString(16).padStart(2, '0')}`;
    }
  }
}

class DecodeCharParser {
  items: DecodeItem[];
  curIndex: number;
  parsedItems: DecodeChar[];
  matches: MatchDecodeItem[];
  constructor(items: DecodeItem[]) {
    this.items = items;
    this.curIndex = 0;
    this.matches = [];
    this.parsedItems = [];
  }
  parse(): DecodeChar[] {
    for (let item of this.items) {
      this.parseItem(item);
    }
    return this.parsedItems;
  }

  parseItem(item: DecodeItem) {
    if (item.type === DecodeItemType.Literal) {
      this.decodeLiteralItem(item as LiteralDecodeItem);
    } else if (item.type === DecodeItemType.Match) {
      return this.decodeMatchItem(item as MatchDecodeItem);
    } else {
      throw `Unexpected item type ${item.type}`;
    }
  }

  decodeLiteralItem(item: LiteralDecodeItem) {
    this.parsedItems.push({
      type: DecodeCharType.Literal,
      char: item.chars[0],
      index: this.curIndex,
      item,
      bits: item.data.bits,
      bitLength: item.data.bits.length,
      destMatchIndices: []
    });
    this.curIndex += 1;
  }
  decodeMatchItem(item: MatchDecodeItem) {
    let { distance, length } = item;
    if (length !== item.chars.length) {
      throw `Error with length`;
    }
    let srcIndex = this.curIndex - distance;
    let bitLengthPerChar = item.data.bits.length / item.chars.length;

    this.matches.push(item);
    let matchIndex = this.matches.length - 1;
    for (let i = 0; i < item.chars.length; i++) {
      let result: MatchDecodeChar = {
        type: DecodeCharType.Match,
        char: item.chars[i],
        index: this.curIndex,
        item,
        bits: item.data.bits,
        bitLength: bitLengthPerChar,
        srcIndex,
        matchIndex,
        destMatchIndices: []
      };
      this.parsedItems.push(result);
      let srcItem = this.parsedItems[srcIndex];
      srcItem.destMatchIndices.push(matchIndex);
      this.curIndex += 1;
      srcIndex += 1;
    }
  }
}

export class CharController {
  el: HTMLElement;
  matches: MatchDecodeItem[];
  chars: DecodeChar[];
  animator: AnimationController | null;
  constructor(
    el: HTMLElement,
    chars: DecodeChar[],
    matches: MatchDecodeItem[]
  ) {
    this.el = el;
    this.matches = matches;
    this.chars = chars;
    this.animator = null;
  }

  run() {
    this.addListeners();
    this.updateUI();
  }

  addListeners() {
    this.addMouseOverListener();
    findEl(`#reveal`).addEventListener('click', () => this.revealAll());
    findEl(`#color-code`).addEventListener('click', () => {
      this.revealColorCodes();
    });
    findEl(`#compression-code`).addEventListener('click', () => {
      this.revealCompressionCodes();
    });
    findEl(`#animate`).addEventListener('click', () => {
      this.animate();
    });
  }

  revealCompressionCodes() {
    this.revealAll();
    this.el.classList.add('reveal-compression-codes');
  }

  revealColorCodes() {
    this.revealAll();
    this.el.classList.add('reveal-color-codes');
  }

  updateUI() {}

  addMouseOverListener() {
    this.el.addEventListener('mouseover', (evt: Event) =>
      this.handleMouseOver(evt as MouseEvent)
    );
  }

  handleMouseOver(evt: MouseEvent) {
    let target = evt.target as HTMLElement;
    if (!target.classList.contains(HTML_CHAR_CLASS)) {
      return;
    }
    evt.stopPropagation();
    let index = parseInt('' + target.dataset['index']);
    let char = this.chars[index];
  }

  activate(char: DecodeChar) {
    Array.from(document.querySelectorAll('.' + HTML_CHAR_ACTIVE_CLASS)).forEach(
      el => el.classList.remove(HTML_CHAR_ACTIVE_CLASS)
    );
    let el = this.findEl(char.index);
    el.classList.add(HTML_CHAR_ACTIVE_CLASS);
  }

  reveal(char: DecodeChar) {
    let el = this.findEl(char.index);
    el.classList.remove(HTML_HIDDEN);
  }

  animate() {
    if (this.animator) {
      this.animator.stop();
      this.animator = null;
    }
    this.animator = new AnimationController(this);
    this.animator.run();
  }

  revealAll() {
    if (this.animator) {
      this.animator.stop();
      this.animator = null;
    }
    this.el.classList.add('reveal-all');
  }

  findEl(index: number): Element {
    let el = document.querySelector(`[data-index="${index}"]`);
    if (!el) {
      throw `could not find src el`;
    }
    return el;
  }
}

import AnimationController from './animation_controller';

class App {
  path: string;
  items: DecodeItem[];
  chars: DecodeChar[];
  matches: MatchDecodeItem[];
  el: HTMLElement;
  constructor(path: string, el: HTMLElement) {
    this.path = path;
    this.items = this.chars = this.matches = [];
    this.el = el;
  }

  async run() {
    let rawData = await this.loadData();
    this.items = new DecodeItemParser(rawData).parse();
    let charParser = new DecodeCharParser(this.items);
    this.chars = charParser.parse();
    this.matches = charParser.matches;

    this.render();
    let controller = new CharController(this.el, this.chars, this.matches);
    controller.run();
  }

  render() {
    let { el, chars } = this;
    for (let char of chars) {
      el.appendChild(this.makeEl(char));
      if (char.char === '\\n') {
        el.appendChild(document.createElement('br'));
      }
    }
  }

  makeEl(char: DecodeChar): HTMLElement {
    let el = document.createElement('span');
    el.innerText = char.char;
    if (char.char === ' ') {
      el.innerHTML = '&nbsp;';
    }
    el.classList.add(...HTML_CHAR_EL_CLASSES);
    this.addAttributes(el, char);
    return el;
  }

  addAttributes(el: HTMLElement, char: DecodeChar) {
    el.classList.add(DecodeCharType[char.type]);
    el.dataset['index'] = '' + char.index;
    el.dataset['bitLength'] = '' + char.bitLength;
    el.dataset['quantizedBitLength'] = '' + quantize(char.bitLength);
    el.dataset[`destMatchIndices`] = char.destMatchIndices.join(',');
    for (let matchIndex of char.destMatchIndices) {
      el.dataset[`destMatchIndex-${matchIndex}`] = '1';
    }
    if (char.type === DecodeCharType.Match) {
      el.dataset[`srcIndex`] = '' + (char as MatchDecodeChar).srcIndex;
      el.dataset[`matchIndex`] = '' + (char as MatchDecodeChar).matchIndex;
    }
  }

  appendChar(char: string) {
    const CLASSES = 'character';
    let el = document.createElement('span');
    el.innerText = char;
    el.setAttribute('class', CLASSES);
    this.el.appendChild(el);
  }

  async loadData() {
    let resp = await fetch(this.path);
    return await resp.json();
  }
}

export default App;
