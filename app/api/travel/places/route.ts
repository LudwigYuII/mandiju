import { NextRequest,NextResponse } from 'next/server';
import { searchPlaces } from '@/lib/geography';
export async function GET(req:NextRequest){
 const q=req.nextUrl.searchParams.get('q')||'';
 if(q.length>80)return NextResponse.json({error:'query_too_long'},{status:400});
 return NextResponse.json({places:searchPlaces(q)},{headers:{'Cache-Control':'public, max-age=86400'}});
}
