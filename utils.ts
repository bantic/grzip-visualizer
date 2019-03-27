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

export function removeAllClass(classNames: string[]) {
  let selector = classNames.map(cname => `.${cname}`).join(',');
  Array.from(document.querySelectorAll(selector)).forEach(e =>
    e.classList.remove(...classNames)
  );
}
