interface Literal {
  type: string;
  value: number;
  stringValue: string[];
  data: DecodeData;
  index: number;
  matchIndices: number[];
}

interface DecodeData {
  bits: Boolean[];
  block_id: number;
}

interface Match {
  type: string;
  length: number;
  distance: number;
  data: DecodeData;
  stringValue: string[];
  literalIndex: number;
}

type DecodeItem = Literal | Match;

class DecodeItemParser {
  data: DecodeItem[];
  decodedBytes: number[];
  index: number;
  constructor(data: DecodeItem[]) {
    this.data = data;
    this.decodedBytes = [];
    this.index = 0;
  }
  parse(): number[] {
    this.index = 0;
    for (let item of this.data) {
      this.parseItem(item);
    }
    return this.decodedBytes;
  }

  parseItem(item: DecodeItem) {
    if (item.type === 'Literal') {
      this.parseLiteral(item as Literal);
    } else if (item.type === 'Match') {
      this.parseMatch(item as Match);
    } else {
      throw `Unexpected item type ${item.type}`;
    }
  }

  parseLiteral(item: Literal) {
    let value = item.value;
    this.decodedBytes.push(value);
    this.index += 1;

    item.stringValue = [this.stringValue(value)];
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

  parseMatch(item: Match) {
    let { length, distance } = item;
    let srcIndex = this.index - distance;
    let stringValue = [];
    for (let i = 0; i < length; i++) {
      let byte = this.decodedBytes[srcIndex + i];
      this.decodedBytes.push(byte);
      stringValue.push(this.stringValue(byte));
      this.index += 1;
    }
    item.stringValue = stringValue;
  }
}

class App {
  path: string;
  data: DecodeItem[];
  el: Element;
  constructor(path: string, el: Element) {
    this.path = path;
    this.data = [];
    this.el = el;
  }

  async run() {
    this.data = await this.loadData();
    let parser = new DecodeItemParser(this.data);
    parser.parse();
    this.data = parser.data;

    this.printInRealtime();
  }

  printInRealtime(index = 0) {
    let bits_per_second = 16;
    let item = this.data[index];
    if (!item) {
      return;
    }
    let compressed_bit_length = item.data.bits.length;
    let duration = 1000 * (compressed_bit_length / bits_per_second);

    if (item.stringValue.length === 1) {
      console.log(item.stringValue.join(''), duration);
      this.appendChar(item.stringValue.join(''));
      setTimeout(() => this.printInRealtime(index + 1), duration);
    } else {
      let chars = item.stringValue.slice();
      chars.reverse();
      let duration_per_char = duration / chars.length;
      let next = () => {
        let char = chars.pop();
        if (!char) {
          return this.printInRealtime(index + 1);
        }
        console.log(
          'match ',
          char,
          duration_per_char,
          duration,
          item.stringValue.join('')
        );
        this.appendChar(char);
        setTimeout(() => next(), duration_per_char);
      };
      next();
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
