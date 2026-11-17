import { notFound,redirect } from 'next/navigation';
import { db,waitDb } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { readTravel } from '@/lib/travel-service';
import { UiText } from '@/components/UiText';
import TravelEditor from '@/components/TravelEditor';
export const dynamic='force-dynamic';
export default async function EditTravel({params}:{params:Promise<{id:string}>}){
 await waitDb();const s=await getSession();if(!s)redirect('/login');const {id}=await params,e=await readTravel(db,id,s.uid);if(!e||e.author_id!==s.uid)notFound();
 return <div className="mx-auto max-w-3xl space-y-6"><h1 className="text-3xl"><UiText text="修订游记"/></h1><TravelEditor uid={s.uid} entry={{id,title:String(e.title),body:String(e.body),revision:Number(e.revision),visibility:String(e.visibility),place_id:e.place_id?String(e.place_id):undefined,place_name:String(e.place_name),canonical_name:String(e.canonical_name),country_label:String(e.country_label),region:String(e.region),longitude:Number(e.longitude),latitude:Number(e.latitude)}}/></div>;
}
