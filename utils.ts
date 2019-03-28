export function findEl(selector: string): Element {
  let el = document.querySelector(selector);
  if (!el) {
    throw `Failed to find el for ${selector}`;
  }
  return el;
}

export function addAllClass(els: Element[], classNames: string[]) {
  els.forEach(el => el.classList.add(...classNames));
}

// Will return a value in the range 0-22 by 1
// TODO this will vary by input -- some inputs will have a wider range of
// bit lengths
export function quantize(val: number): number {
  if (val > 11) {
    throw `Bad val`;
  }
  return Math.round(val * 2);
}
