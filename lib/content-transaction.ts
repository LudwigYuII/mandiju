import type { Client } from '@libsql/client';
/** Short contention retries for idempotent calendar provisioning, never for user mutations. */
export async function contentTransaction(client:Client){
  for(let attempt=0;;attempt++){
    try{return await client.transaction('write');}
    catch(e){
      if(attempt>=5 || !e || typeof e!=='object' || !('code' in e) || e.code!=='SQLITE_BUSY')throw e;
      await new Promise(resolve=>setTimeout(resolve,20*2**attempt));
    }
  }
}
