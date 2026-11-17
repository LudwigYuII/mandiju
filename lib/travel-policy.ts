export const TRAVEL_REGIONS:Record<string,string>={asia:'亚洲',europe:'欧洲',africa:'非洲','north-america':'北美洲','south-america':'南美洲',oceania:'大洋洲',antarctica:'南极洲',ocean:'海域与其他'};
export function coordinates(lon:unknown,lat:unknown){
  if(String(lon??'').trim()===''||String(lat??'').trim()==='')throw new Error('请先在地图上选点，或选择资料库地点');
  const x=Number(lon),y=Number(lat);
  if(!Number.isFinite(x)||!Number.isFinite(y)||x < -180||x>180||y < -90||y>90)throw new Error('经纬度超出范围');
  return {longitude:Math.round(x*100)/100,latitude:Math.round(y*100)/100};
}
