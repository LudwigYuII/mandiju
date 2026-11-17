import fs from 'node:fs';
import path from 'node:path';
import {deflateSync,inflateSync} from 'node:zlib';
import {Font,type TTF} from 'fonteditor-core';
import index from '@/data/journal-fonts.json';
import {annotationParts} from './literary-policy';
export type JournalPdfBook={title:string;period:string;foreword:string;proof?:boolean;entries:{title:string;body:string;byline:string;section:string}[]};
type Line={text:string;size:number;x:number;y:number};
function utf16(text:string){const bytes=Buffer.from(text,'utf16le');bytes.swap16();return bytes.toString('hex').toUpperCase();}
/** A standalone PDF with a subset embedded TrueType font, text extraction map, and no external fetches. */
export function journalPdf(book:JournalPdfBook){
 const bodyText=(body:string)=>{const notes:string[]=[];const main=annotationParts(body).map(p=>{if(!p.note)return p.text;notes.push(p.note);return p.text+'〔'+notes.length+'〕';}).join('');return main+(notes.length?'\n\n自注\n'+notes.map((n,i)=>'〔'+(i+1)+'〕'+n).join('\n'):'');};
 const entries=book.entries.map(e=>({...e,body:bodyText(e.body)}));
 const banner=book.proof?'校样 · 未刊行':'慢递局 · 文学季刊';
 const staticText='刊首语目录第页字库未收录以下字码，原文请参照在线版本。字体：Noto Serif TC / SC · SIL OFL 1.1 abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789[]+U.,:;?（）　□\n';
 const all=[book.title,book.period,book.foreword,banner,staticText,...entries.flatMap(e=>[e.title,e.byline,e.section,e.body])].join('\n');
 const chars=Array.from(new Set(Array.from(all.replace(/[\r\n\t]/g,''))));if(chars.length>30000)throw Error('本期文字种类过多，请分期编排');
 const locations=new Map<number,string>();for(const group of index)for(const c of group.points)locations.set(c,group.file);
 const needs=new Map<string,number[]>(),missing:string[]=[];
 for(const ch of chars){const c=ch.codePointAt(0)!,f=locations.get(c);if(f){if(!needs.has(f))needs.set(f,[]);needs.get(f)!.push(c);}else missing.push(ch);}
 let base:TTF.TTFObject|undefined;const glyphs:TTF.Glyph[]=[],widths=new Map<number,number>();
 for(const [file,points]of needs){
  const source=Font.create(fs.readFileSync(path.join(process.cwd(),'node_modules','@fontsource',file)),{type:'woff',subset:points,hinting:false,compound2simple:true,inflate:(b:number[])=>Array.from(inflateSync(Buffer.from(b)))}).get();
  if(!base){base=source;glyphs.push(source.glyf[0]);}
  const units=source.head.unitsPerEm||1000;
  for(const c of points){const g=source.glyf.find(g=>g.unicode?.includes(c));if(!g)continue;glyphs.push({...g,unicode:[c]});widths.set(c,g.advanceWidth*1000/units);}
 }
 if(!base)throw Error('季刊字库不可用');base.glyf=glyphs;const font=new Font().set(base);const bytes=Buffer.from(font.write({type:'ttf',toBuffer:true,hinting:false}));const parsed=Font.create(bytes,{type:'ttf'}).get();
 const codes=new Map(chars.map((c,i)=>[c,i+1]));
 const pages:Line[][]=[[]];let y=760;
 const newPage=()=>{if(pages.length>=500)throw Error('本期超过五百页，请分期编排');pages.push([]);y=760;};
 const width=(ch:string,size:number)=>(widths.get(ch.codePointAt(0)!)||1000)*size/1000;
 const line=(text:string,size=13,x=60)=>{if(y<65)newPage();pages[pages.length-1].push({text,size,x,y});y-=size*1.9;};
 const text=(s:string,size=13)=>{for(const paragraph of s.replace(/\r\n?/g,'\n').replace(/\t/g,'    ').split('\n')){let str='',w=0;for(const c of paragraph){const cw=width(c,size);if(w+cw>475&&str){line(str,size);str='';w=0;}str+=c;w+=cw;}line(str,size);}};
 y=640;text(book.period,14);y-=30;text(book.title,26);y-=40;text(banner,14);
 if(book.foreword){newPage();text('刊首语',20);y-=12;text(book.foreword);}
 newPage();text('目录',20);y-=15;for(const e of entries){text((e.section?e.section+' · ':'')+e.title+' / '+e.byline,13);}
 for(const e of entries){newPage();if(e.section)text(e.section,11);text(e.title,21);text(e.byline,12);y-=15;text(e.body);}
 if(missing.length){newPage();text('字库未收录以下字码，原文请参照在线版本。',13);text(missing.map(ch=>'U+'+ch.codePointAt(0)!.toString(16).toUpperCase()).join('  '),11);}
 line('字体：Noto Serif TC / SC · SIL OFL 1.1',9);
 // Footer numbers and missing-character notice use the same pre-indexed character repertoire.
 const objects:Buffer[]=[];const reserve=()=>{objects.push(Buffer.alloc(0));return objects.length;};
 const put=(n:number,value:string|Buffer)=>{objects[n-1]=typeof value==='string'?Buffer.from(value,'binary'):value;};
 const stream=(data:Buffer,extra='')=>{const zip=deflateSync(data);return Buffer.concat([Buffer.from(`<< /Length ${zip.length} /Filter /FlateDecode ${extra} >>\nstream\n`),zip,Buffer.from('\nendstream')]);};
 const catalog=reserve(),pageTree=reserve(),type0=reserve(),cidFont=reserve(),descriptor=reserve(),fontFile=reserve(),mapping=reserve(),unicode=reserve();
 put(fontFile,stream(bytes,`/Length1 ${bytes.length}`));
 const cidMap=Buffer.alloc((chars.length+1)*2);const widthArray:number[]=[1000];
 chars.forEach((ch,i)=>{cidMap.writeUInt16BE(Number(parsed.cmap[ch.codePointAt(0)!]||0),2*(i+1));widthArray.push(Math.round(widths.get(ch.codePointAt(0)!)||1000));});put(mapping,stream(cidMap));
 let cmap='/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /JournalUnicode def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n';
 for(let i=0;i<chars.length;i+=100){const slice=chars.slice(i,i+100);cmap+=slice.length+' beginbfchar\n'+slice.map((ch,j)=>'<'+(i+j+1).toString(16).padStart(4,'0')+'> <'+utf16(ch)+'>').join('\n')+'\nendbfchar\n';}
 cmap+='endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend';put(unicode,stream(Buffer.from(cmap)));
 put(descriptor,`<< /Type /FontDescriptor /FontName /JournalNotoSerif /Flags 4 /FontBBox [-1000 -1000 2000 2000] /ItalicAngle 0 /Ascent 1000 /Descent -300 /CapHeight 880 /StemV 80 /FontFile2 ${fontFile} 0 R >>`);
 put(cidFont,`<< /Type /Font /Subtype /CIDFontType2 /BaseFont /JournalNotoSerif /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${descriptor} 0 R /DW 1000 /W [0 [${widthArray.join(' ')}]] /CIDToGIDMap ${mapping} 0 R >>`);
 put(type0,`<< /Type /Font /Subtype /Type0 /BaseFont /JournalNotoSerif /Encoding /Identity-H /DescendantFonts [${cidFont} 0 R] /ToUnicode ${unicode} 0 R >>`);
 const kids:number[]=[];
 pages.forEach((lines,i)=>{const page=reserve(),content=reserve();kids.push(page);const encode=(s:string)=>Array.from(s).map(ch=>(codes.get(ch)||codes.get('?')||0).toString(16).padStart(4,'0')).join('');const data=lines.concat({text:'第 '+(i+1)+' 页',size:9,x:272,y:35}).map(l=>`BT /F1 ${l.size} Tf 1 0 0 1 ${l.x} ${l.y} Tm <${encode(l.text)}> Tj ET`).join('\n');put(content,stream(Buffer.from(data)));put(page,`<< /Type /Page /Parent ${pageTree} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${type0} 0 R >> >> /Contents ${content} 0 R >>`);});
 put(pageTree,`<< /Type /Pages /Kids [${kids.map(n=>n+' 0 R').join(' ')}] /Count ${kids.length} >>`);put(catalog,`<< /Type /Catalog /Pages ${pageTree} 0 R /Lang (zh) >>`);
 const chunks=[Buffer.from('%PDF-1.7\n%\xE2\xE3\xCF\xD3\n','binary')],offsets=[0];let offset=chunks[0].length;
 objects.forEach((obj,i)=>{offsets.push(offset);const b=Buffer.concat([Buffer.from(`${i+1} 0 obj\n`),obj,Buffer.from('\nendobj\n')]);chunks.push(b);offset+=b.length;});
 chunks.push(Buffer.from(`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(n=>n.toString().padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length+1} /Root ${catalog} 0 R >>\nstartxref\n${offset}\n%%EOF\n`));return Buffer.concat(chunks);
}
