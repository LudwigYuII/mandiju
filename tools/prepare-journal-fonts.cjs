// Uses only already installed OFL Noto fonts; no network download.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),{Font}=require('fonteditor-core');
const result=[];const seen=new Set();
for(const family of ['noto-serif-tc','noto-serif-sc']){
 const root=path.dirname(require.resolve('@fontsource/'+family+'/package.json'));
 for(const file of fs.readdirSync(path.join(root,'files')).filter(f=>f.endsWith('-400-normal.woff')).sort()){
  const font=Font.create(fs.readFileSync(path.join(root,'files',file)),{type:'woff',inflate:b=>zlib.inflateSync(Buffer.from(b)),compound2simple:true});
  const points=Object.keys(font.get().cmap).map(Number).filter(c=>!seen.has(c));for(const c of points)seen.add(c);
  if(points.length)result.push({file:family+'/files/'+file,points});
 }
}
fs.writeFileSync('data/journal-fonts.json',JSON.stringify(result));
fs.mkdirSync('public/fonts/journal',{recursive:true});fs.copyFileSync('node_modules/@fontsource/noto-serif-tc/LICENSE','public/fonts/journal/OFL.txt');
console.log('Journal font index:',seen.size,'codepoints across',result.length,'subsets');
