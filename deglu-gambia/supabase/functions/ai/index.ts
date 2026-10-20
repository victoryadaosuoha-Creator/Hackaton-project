// Runtime entrypoint; request handling is dependency-injected and tested without real credentials.
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { createHandler } from './handler.ts';
const env=(key:string)=>Deno.env.get(key);
Deno.serve(createHandler({
  env,
  client:(mode,authorization)=>createClient(env('SUPABASE_URL')!,mode==='service'?env('SUPABASE_SERVICE_ROLE_KEY')!:env('SUPABASE_ANON_KEY')!,{
    auth:{persistSession:false,autoRefreshToken:false},
    global:{headers:mode==='user'?{Authorization:authorization!}:{},fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(12000)})},
  }),
  log:(event)=>console.log(JSON.stringify(event)),
}));
