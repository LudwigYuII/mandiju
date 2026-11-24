import { siteDateKey,SITE_TIME_ZONE } from './time';
import {gatheringTime} from './gathering-policy';

export function quietSchedule(now: number) {
  const date = siteDateKey(new Date(now));
  const local = new Date(date + 'T12:00:00Z');
  const hour = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: SITE_TIME_ZONE,
    hour:'numeric',hourCycle:'h23',
  }).format(now));
  const monday = new Date(local);
  monday.setUTCDate(local.getUTCDate()-((local.getUTCDay()+6)%7));
  if (hour<1) local.setUTCDate(local.getUTCDate()-1);
  return {week:monday.toISOString().slice(0,10),night:local.toISOString().slice(0,10),open:hour>=22||hour<1};
}

export function teaTime(date:string,time:string) {
  return gatheringTime(date+'T'+time);
}
