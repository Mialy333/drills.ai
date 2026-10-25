export function applicationUrl(value:string):string|null{
 try{const url=new URL(value.trim());return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;}catch{return null;}
}
export function profileWithEligibility(profile:string,residence:string,country:string,authorization:string):string{
 const lines:string[]=[];
 if(residence.trim())lines.push(`Candidate-declared residence: ${residence.trim()}.`);
 const statuses:Record<string,string>={yes:'I declare that I have the right to work in this country without employer sponsorship.',restricted:'My right to work has restrictions that must be checked for this contract.',sponsorship:'I need employer sponsorship or work authorization.',unknown:'My right to work in this country is not yet confirmed.'};
 if(country.trim())lines.push(`Candidate-declared work country: ${country.trim()}. ${statuses[authorization]??statuses.unknown}`);
 return [profile.trim(),...lines].filter(Boolean).join('\n\n');
}
