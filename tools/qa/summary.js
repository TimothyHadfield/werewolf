let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const i=d.indexOf("{");let j;try{j=JSON.parse(d.slice(i))}catch(e){console.log("RAW",d.slice(0,800));return}
let ev=j.evalResult;try{ev=JSON.parse(ev)}catch(e){}
console.log(JSON.stringify({console:j.console,exceptions:j.exceptions,failed:j.failedRequests,overflow:j.horizontalOverflow,winner:ev&&ev.winner,last:ev&&ev.trail&&ev.trail.slice(-3),hints:ev&&ev.hints&&ev.hints.slice(-1)}))})
