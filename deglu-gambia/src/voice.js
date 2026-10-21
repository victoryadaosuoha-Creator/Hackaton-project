// Browser speech services vary. No recording is uploaded by this application.
export function createVoiceInput({onTranscript,onState,onError},host=window) {
  const Recognition=host.SpeechRecognition||host.webkitSpeechRecognition;
  let recognition=null,listening=false,interim='';
  const state=()=>onState({listening,interim});
  const stop=()=>{try{recognition?.stop();}catch{ /* already stopped */ }};
  return {
    supported:!!Recognition,
    get listening(){return listening;},
    stop,
    start(){
      if(!Recognition){onError('Speech recognition is unavailable in this browser. Type your report instead.');return;}
      if(listening)return;
      const rec=new Recognition();recognition=rec;rec.lang='en-GB';rec.continuous=false;rec.interimResults=true;
      rec.onresult=(event)=>{
        const finals=[];interim='';
        for(let i=event.resultIndex;i<event.results.length;i++){
          const text=event.results[i][0]?.transcript||'';
          if(event.results[i].isFinal)finals.push(text);else interim+=text;
        }
        if(finals.length)onTranscript(finals.join(' '));state();
      };
      rec.onerror=(event)=>{const messages={'not-allowed':'Microphone permission was denied. You can type instead.','service-not-allowed':'The browser speech service is unavailable. You can type instead.','no-speech':'No speech was detected. Try again or type instead.','network':'Speech recognition needs a working connection to your browser speech service.','audio-capture':'No microphone is available. You can type instead.','language-not-supported':'English speech recognition is unavailable on this device. Type your report instead.'};onError(messages[event.error]||'Speech recognition could not complete. You can type instead.');};
      rec.onend=()=>{listening=false;interim='';recognition=null;state();};
      try{listening=true;state();rec.start();}catch{listening=false;recognition=null;state();onError('Voice input could not start. You can type instead.');}
    },
  };
}
