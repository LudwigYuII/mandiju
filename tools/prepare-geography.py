"""Build self-hosted map assets from the pinned Natural Earth public-domain sources.
Inputs are local downloads; no user data is read and no runtime map service is used.
"""
import json,hashlib,pathlib,sys
root=pathlib.Path(__file__).resolve().parents[1]
source=pathlib.Path(sys.argv[1])
lands=json.loads((source/'ne_110m_land.geojson').read_text())
countries=json.loads((source/'ne_110m_admin_0_countries.geojson').read_text())
cities=json.loads((source/'ne_10m_populated_places.geojson').read_text())
labels=json.loads((source/'ne_10m_admin_0_countries.geojson').read_text())
regions={'Asia':'asia','Europe':'europe','Africa':'africa','North America':'north-america','South America':'south-america','Oceania':'oceania','Antarctica':'antarctica','Seven seas (open ocean)':'ocean'}
country={f['properties']['ADM0_A3']:f['properties'] for f in labels['features']}
paths=[]
for f in lands['features']:
 polygons=[f['geometry']['coordinates']] if f['geometry']['type']=='Polygon' else f['geometry']['coordinates']
 for polygon in polygons:
  paths.append(''.join('M'+'L'.join(f'{(x+180)/.36:.2f},{(90-y)/.36:.2f}' for x,y,*_ in ring)+'Z' for ring in polygon))
(root/'public/geography/world-land.json').write_text(json.dumps(paths,separators=(',',':')))
places=[]
for f in cities['features']:
 p=f['properties'];c=country.get(p.get('ADM0_A3'),{});lon,lat=f['geometry']['coordinates'][:2]
 places.append([str(p['NE_ID']),p.get('NAME_ZHT') or p.get('NAME_ZH') or p['NAME'],p['NAME'],p.get('NAMEASCII') or '',c.get('NAME_ZH') or p.get('ADM0NAME') or '',regions.get(c.get('CONTINENT'),'ocean'),round(lon,2),round(lat,2),p.get('NAME_ZH') or '',p.get('NAMEALT') or ''])
places.sort(key=lambda p:p[0])
(root/'data/geography/places.json').write_text(json.dumps(places,ensure_ascii=False,separators=(',',':')))
# Used only to classify a manual point into broad regions; no political boundaries are drawn.
polygons=[{'region':regions.get(f['properties'].get('CONTINENT'),'ocean'),'geometry':f['geometry']} for f in countries['features']]
(root/'data/geography/regions.json').write_text(json.dumps(polygons,separators=(',',':')))
meta={'provider':'Natural Earth','license':'Public domain','license_url':'https://www.naturalearthdata.com/about/terms-of-use/','retrieved_at':'2026-11-17','upstream_commit':'ca96624a56bd078437bca8184e78163e5039ad19','places':len(places),'derivation':'Selected names and rounded coordinates; simplified land SVG paths; broad region polygons. No user data.','sources':[{'name':n,'sha256':hashlib.sha256((source/n).read_bytes()).hexdigest()} for n in ['ne_110m_land.geojson','ne_110m_admin_0_countries.geojson','ne_10m_populated_places.geojson','ne_10m_admin_0_countries.geojson']]}
(root/'data/geography/sources.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
for p in [root/'public/geography/world-land.json',root/'data/geography/places.json',root/'data/geography/regions.json']:print(p.relative_to(root),p.stat().st_size)
