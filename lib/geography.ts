import places from '@/data/geography/places.json';
import regions from '@/data/geography/regions.json';
import { coordinates } from './travel-policy';
export type Place={id:string;name:string;english:string;country:string;region:string;longitude:number;latitude:number};
function view(row:(string|number)[]):Place{return {id:String(row[0]),name:String(row[1]),english:String(row[2]),country:String(row[4]),region:String(row[5]),longitude:Number(row[6]),latitude:Number(row[7])};}
const byId=new Map(places.map(p=>[String(p[0]),p]));
export function findPlace(id:string){const p=byId.get(id);return p?view(p):null;}
const normalize=(s:string)=>s.normalize('NFKC').toLocaleLowerCase().trim();
export function searchPlaces(query:string){
 const q=normalize(query);if(Array.from(q).length<2)return [];
 return places.filter(p=>[1,2,3,8,9].some(i=>normalize(String(p[i])).includes(q))).sort((a,b)=>Number(normalize(String(b[1]))===q)-Number(normalize(String(a[1]))===q)||String(a[1]).localeCompare(String(b[1]))).slice(0,20).map(view);
}
type Ring=number[][];
function inRing(x:number,y:number,ring:Ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){
 const a=ring[i],b=ring[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }return inside;}
function inPolygon(x:number,y:number,poly:Ring[]){return inRing(x,y,poly[0])&&!poly.slice(1).some(r=>inRing(x,y,r));}
export function regionForPoint(longitude:number,latitude:number){
 const p=coordinates(longitude,latitude);
 for(const feature of regions){const g=feature.geometry;const polys=g.type==='Polygon'?[g.coordinates]:g.coordinates;
  if((polys as Ring[][]).some(poly=>inPolygon(p.longitude,p.latitude,poly)))return feature.region;
 }return p.latitude < -60?'antarctica':'ocean';
}
