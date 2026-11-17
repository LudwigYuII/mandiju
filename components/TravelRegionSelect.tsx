"use client";
import { useLanguage } from './LanguageProvider';
import { TRAVEL_REGIONS } from '@/lib/travel-policy';
const hant:Record<string,string>={asia:'亞洲',europe:'歐洲',africa:'非洲','north-america':'北美洲','south-america':'南美洲',oceania:'大洋洲',antarctica:'南極洲',ocean:'海域與其他'};
export default function TravelRegionSelect({value}:{value:string}){const {locale}=useLanguage();return <select name="region" defaultValue={value} className="input"><option value="">全球</option>{Object.entries(TRAVEL_REGIONS).map(([id,label])=><option key={id} value={id}>{locale==='zh-Hant'?hant[id]:label}</option>)}</select>;}
