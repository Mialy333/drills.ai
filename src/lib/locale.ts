export type Locale = 'fr' | 'en';
export const locale = (value: string | null | undefined): Locale => value?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
const headings = [
 ['Target Title','Titre cible'], ['Short Profile','Profil'], ['Professional Experience','Expérience professionnelle'],
 ['Projects','Projets'], ['Education','Formation'], ['Skills','Compétences'], ['Personal project','Projet personnel'],
];
export function cvHeading(value:string, language:Locale):string {
 const pair=headings.find(pair=>pair.some(label=>label.toLocaleLowerCase()===value.trim().toLocaleLowerCase()));
 return pair ? pair[language==='fr'?1:0] : value;
}
export const translator = (language: Locale) => (french:string, english:string):string => language==='fr' ? french : english;
