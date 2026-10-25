/** Small CV editor: plain-text paste, restricted formatting, safe link protocols. */
export function cleanCvHtml(html: string): DocumentFragment {
  const source = new DOMParser().parseFromString(html, 'text/html');
  const fragment = document.createDocumentFragment();
  const allowed = new Set(['DIV','P','BR','STRONG','B','EM','I','U','A']);
  function copy(node: Node, parent: Node): void {
    if (node.nodeType === 3) { parent.appendChild(document.createTextNode(node.textContent ?? '')); return; }
    if (!(node instanceof Element)) return;
    if (['SCRIPT','STYLE','IFRAME','OBJECT'].includes(node.tagName)) return;
    const output = allowed.has(node.tagName) ? document.createElement(node.tagName.toLowerCase()) : document.createElement('span');
    if (node.tagName === 'A') {
      const url = node.getAttribute('href') ?? '';
      if (/^(https?:\/\/|mailto:)/i.test(url)) { output.setAttribute('href', url); output.setAttribute('rel','noopener noreferrer'); }
    }
    const alignment = (node as HTMLElement).style?.textAlign;
    if (['left','center','right','justify'].includes(alignment)) output.style.textAlign = alignment;
    for (const child of node.childNodes) copy(child, output);
    parent.appendChild(output);
  }
  for (const node of source.body.childNodes) copy(node, fragment);
  return fragment;
}
export function createCvEditor(editor: HTMLElement, field: HTMLTextAreaElement, toolbar: HTMLElement) {
  let selection: Range | null = null;
  const sync = () => {
    field.value = editor.innerText ?? editor.textContent ?? '';
    field.dispatchEvent(new Event('input', {bubbles:true}));
  };
  const setText = (value: string) => { field.value = value; editor.style.textAlign = 'left'; editor.textContent = value; };
  const setHtml = (value: string) => {
    const fragment = cleanCvHtml(value);
    const wrapper = fragment.firstChild;
    if (fragment.childNodes.length === 1 && wrapper instanceof HTMLElement && wrapper.tagName === 'DIV') {
      editor.style.textAlign = wrapper.style.textAlign || 'left'; editor.replaceChildren(...wrapper.childNodes);
    } else editor.replaceChildren(fragment);
    field.value = editor.innerText ?? editor.textContent ?? '';
  };
  document.addEventListener('selectionchange', () => {
    const current = window.getSelection();
    if (current?.rangeCount && editor.contains(current.getRangeAt(0).commonAncestorContainer)) selection = current.getRangeAt(0).cloneRange();
  });
  editor.addEventListener('input', sync);
  editor.addEventListener('paste', event => {
    event.preventDefault();
    const text = (event as ClipboardEvent).clipboardData?.getData('text/plain') ?? '';
    const current = window.getSelection();
    if (!current?.rangeCount || !editor.contains(current.getRangeAt(0).commonAncestorContainer)) return;
    const range = current.getRangeAt(0); range.deleteContents();
    const node = document.createTextNode(text); range.insertNode(node); range.setStartAfter(node); range.collapse(true);
    current.removeAllRanges(); current.addRange(range); sync();
  });
  editor.addEventListener('drop', event => event.preventDefault());
  toolbar.addEventListener('mousedown', event => { if ((event.target as Element).closest('button')) event.preventDefault(); });
  toolbar.addEventListener('click', event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-command]');
    if (!button) return;
    const command = button.dataset.command!;
    if (['left','center','right','justify'].includes(command)) {
      // Alignment applies to the full CV, clearly labelled in the toolbar.
      editor.style.textAlign = command; sync(); return;
    }
    const note = document.getElementById('cv-editor-note');
    const fr = document.documentElement.lang === 'fr';
    if (!selection || selection.collapsed || !editor.contains(selection.commonAncestorContainer)) {
      if (note) note.textContent = fr ? 'Sélectionne le texte à mettre en forme.' : 'Select the text to format.';
      return;
    }
    let wrapper: HTMLElement;
    if (command === 'link') {
      const input = document.getElementById('cv-link-url') as HTMLInputElement;
      const url = input.value.trim();
      if (!/^(https?:\/\/|mailto:)/i.test(url)) { if (note) note.textContent = fr ? 'Utilise un lien https://, http:// ou mailto:.' : 'Use an https://, http:// or mailto: link.'; return; }
      wrapper = document.createElement('a'); wrapper.setAttribute('href',url); wrapper.setAttribute('rel','noopener noreferrer');
    } else {
      const tag = {bold:'strong',italic:'em',underline:'u'}[command];
      if (!tag) return;
      wrapper = document.createElement(tag);
    }
    wrapper.appendChild(selection.extractContents()); selection.insertNode(wrapper);
    const current = window.getSelection(); selection.selectNodeContents(wrapper); current?.removeAllRanges(); current?.addRange(selection);
    if (note) note.textContent = fr ? 'Mise en forme appliquée.' : 'Formatting applied.';
    sync();
  });
  return {setText, setHtml, html: () => {
    const container = document.createElement('div'); container.style.textAlign = editor.style.textAlign;
    container.append(cleanCvHtml(editor.innerHTML)); return container.outerHTML;
  }};
}
