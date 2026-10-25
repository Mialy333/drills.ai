import { cvLayout } from "./cv-layout";
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';

/** Small CV editor: plain-text paste, restricted formatting, safe link protocols. */
export function cleanCvHtml(html: string): DocumentFragment {
  const source = new DOMParser().parseFromString(html, 'text/html');
  const fragment = document.createDocumentFragment();
  const allowed = new Set(['DIV','P','BR','STRONG','B','EM','I','U','A','S','SPAN','UL','OL','LI','H2','H3']);
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
    const style = (node as HTMLElement).style;
    if (style) {
      if (/^(Arial|Georgia|Verdana|Times New Roman|sans-serif|serif)$/i.test(style.fontFamily.replace(/["']/g,''))) output.style.fontFamily = style.fontFamily;
      if (/^(?:[89]|[12][0-9]|3[0-6])pt$/.test(style.fontSize)) output.style.fontSize = style.fontSize;
      if (/^(?:#[0-9a-f]{3,8}|rgba?\([0-9.,% ]+\))$/i.test(style.color)) output.style.color = style.color;
      if (/^(1|1\.2|1\.5|1\.8|2)$/.test(style.lineHeight)) output.style.lineHeight = style.lineHeight;
    }
    for (const child of node.childNodes) copy(child, output);
    parent.appendChild(output);
  }
  for (const node of source.body.childNodes) copy(node, fragment);
  return fragment;
}
export function createCvEditor(element: HTMLElement, field: HTMLTextAreaElement, toolbar: HTMLElement) {
  const fr = document.documentElement.lang === 'fr';
  const note = document.getElementById('cv-editor-note');
  const linkInput = document.getElementById('cv-link-url') as HTMLInputElement;
  let editor: Editor;
  editor = new Editor({
    element,
    extensions: [StarterKit.configure({codeBlock:false, code:false, blockquote:false, horizontalRule:false,
      link:{openOnClick:false, autolink:false, linkOnPaste:false, protocols:['http','https','mailto']}}),
      TextStyleKit, TextAlign.configure({types:['paragraph','heading']})],
    editorProps: {
      attributes: {role:'textbox','aria-multiline':'true','aria-label':fr ? 'CV modifiable' : 'Editable CV'},
      transformPastedHTML: value => safeHtml(value),
    },
    onUpdate: () => { field.value = editor.getText(); field.dispatchEvent(new Event('input',{bubbles:true})); updateControls(); },
    onSelectionUpdate: () => updateControls(),
    onTransaction: () => updateControls(),
  });
  function safeHtml(value: string): string {
    const container = document.createElement('div'); container.append(cleanCvHtml(value));
    for (const div of container.querySelectorAll('div')) {
      if (!div.querySelector('p,div,ul,ol,h2,h3')) {
        const paragraph=document.createElement('p'); paragraph.style.cssText=div.style.cssText;
        paragraph.append(...div.childNodes); div.replaceWith(paragraph);
      }
    }
    return container.innerHTML;
  }
  function updateControls(): void {
    if (!editor || editor.isDestroyed) return;
    for (const button of toolbar.querySelectorAll<HTMLButtonElement>('button[data-command]')) {
      const name=button.dataset.command!;
      const active=['bold','italic','underline','strike','bulletList','orderedList','link'].includes(name)
        ? editor.isActive(name) : ['left','center','right','justify'].includes(name) && editor.isActive({textAlign:name});
      if (['bold','italic','underline','strike','bulletList','orderedList','left','center','right','justify'].includes(name)) button.setAttribute('aria-pressed',String(active));
      if (name==='undo') button.disabled=!editor.can().undo();
      if (name==='redo') button.disabled=!editor.can().redo();
    }
    if (document.activeElement !== linkInput) linkInput.value=editor.getAttributes('link').href ?? '';
    const attrs=editor.getAttributes('textStyle');
    for (const [id,key,fallback] of [['cv-font','fontFamily','Arial'],['cv-size','fontSize','11pt'],['cv-line-height','lineHeight','1.5']]) {
      const input=document.getElementById(id) as HTMLSelectElement;
      if (input && document.activeElement!==input) input.value=attrs[key] || fallback;
    }
  }
  toolbar.addEventListener('mousedown',event=>{ if ((event.target as Element).closest('button')) event.preventDefault(); });
  toolbar.addEventListener('click',event=>{
    const button=(event.target as Element).closest<HTMLButtonElement>('button[data-command]');
    if (!button) return;
    const command=button.dataset.command!;
    const chain=editor.chain();
    const actions: Record<string,()=>void>={
      bold:()=>{chain.toggleBold().run();}, italic:()=>{chain.toggleItalic().run();}, underline:()=>{chain.toggleUnderline().run();},
      strike:()=>{chain.toggleStrike().run();}, bulletList:()=>{chain.toggleBulletList().run();}, orderedList:()=>{chain.toggleOrderedList().run();},
      undo:()=>{chain.undo().run();}, redo:()=>{chain.redo().run();}, clear:()=>{chain.unsetAllMarks().clearNodes().run();},
      unlink:()=>{chain.extendMarkRange('link').unsetLink().run();},
    };
    if (command==='link') {
      let url=linkInput.value.trim();
      if (/^www\./i.test(url)) url='https://'+url;
      if (!/^(https?:\/\/|mailto:)/i.test(url)) { if(note) note.textContent=fr?'Indique une adresse https://, http:// ou mailto:.':'Enter an https://, http:// or mailto: address.';return; }
      if (editor.state.selection.empty && !editor.isActive('link')) { if(note) note.textContent=fr?'Sélectionne le texte à transformer en lien.':'Select the text to link.';return; }
      chain.extendMarkRange('link').setLink({href:url}).run();
    } else if (['left','center','right','justify'].includes(command)) chain.setTextAlign(command).run();
    else actions[command]?.();
    updateControls();
    if(note) note.textContent='';
  });
  toolbar.addEventListener('change',event=>{
    const input=event.target as HTMLInputElement;
    const chain=editor.chain();
    if(input.id==='cv-font') chain.setFontFamily(input.value).run();
    if(input.id==='cv-size') chain.setFontSize(input.value).run();
    if(input.id==='cv-color') chain.setColor(input.value).run();
    if(input.id==='cv-line-height') chain.setLineHeight(input.value).run();
    updateControls();
  });
  return {
    setSections(sections: {heading:string;text:string}[]) {
      const container=document.createElement('div');
      container.innerHTML=cvLayout(sections.map(section=>section.heading+'\n'+section.text).join('\n\n'),sections.map(section=>section.heading));
      editor.commands.setContent(container.innerHTML,{emitUpdate:false}); field.value=editor.getText(); updateControls();
    },
    reformat(headings:string[], emitUpdate=true) {
      editor.commands.setContent(cvLayout(editor.getText(),headings),{emitUpdate}); updateControls();
    },
    setText(value:string) {
      const paragraphs=value.split('\n').map(line=>({type:'paragraph',content:line?[{type:'text',text:line}]:[]}));
      editor.commands.setContent({type:'doc',content:paragraphs},{emitUpdate:false}); field.value=value; updateControls();
    },
    setHtml(value:string, headings:string[] = []) {
      const container=document.createElement('div'); container.append(cleanCvHtml(value));
      if(!container.querySelector('h3,ul,ol,strong,b,em,i,a,u,s') && headings.length) {
        const plain=Array.from(container.childNodes).map(node=>node.textContent ?? '').join('\n');
        container.innerHTML=cvLayout(plain,headings);
      }
      for(const node of container.querySelectorAll('p,div')) {
        if(headings.includes(node.textContent?.trim() ?? '') && !node.querySelector('p,div')) {
          const heading=document.createElement('h3'); heading.append(...node.childNodes); node.replaceWith(heading);
        }
      }
      editor.commands.setContent(safeHtml(container.innerHTML),{emitUpdate:false});field.value=editor.getText();updateControls(); },
    html:()=>safeHtml(editor.getHTML()),
  };
}
