/** Deterministic layout of supplied text; no facts are generated. */
export function cvLayout(value: string, headings: string[]): string {
  const defaults=['Target Title','Short Profile','Professional Experience','Personal project','Projects','Education','Skills','Profil','Projets','Expérience professionnelle','Expériences professionnelles','Formation','Formations','Compétences','Titre cible'];
  const labels=[...new Set([...headings,...defaults])].sort((a,b)=>b.length-a.length);
  const escape=(v:string)=>v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const boundary=new RegExp(`(^|[\\s])(${labels.map(escape).join('|')})(?=[:\\s]|$)`,'gi');
  const normalized=value.replace(/\r\n/g,'\n').replace(boundary,'\n$2\n').replace(/([^\n])\s+[-•]\s+(?=[A-ZÀ-ÖØ-Þ])/g,'$1\n- ');
  const container=document.createElement('div');let list:HTMLUListElement|null=null;
  for(const raw of normalized.split(/\n+/)) {
    const line=raw.trim();if(!line)continue;
    const heading=labels.some(label=>label.toLowerCase()===line.replace(/:$/,'').toLowerCase());
    const bullet=/^[-•]\s+/.test(line);
    const node=document.createElement(heading?'h3':bullet?'li':'p');
    // Only a minimal inline emphasis syntax; raw HTML stays plain text.
    const parts=line.replace(/^[-•]\s+/,'').split(/(\*{2,3}[^*]+\*{2,3})/g);
    for(const part of parts) {
      if(/^\*{2,3}[^*]+\*{2,3}$/.test(part)) {const strong=document.createElement('strong');strong.textContent=part.replace(/^\*+|\*+$/g,'');node.append(strong);}
      else node.append(document.createTextNode(part));
    }
    if(bullet) {if(!list){list=document.createElement('ul');container.append(list);}list.append(node);}
    else {list=null;container.append(node);}
  }
  return container.innerHTML;
}
