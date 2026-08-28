(() => {
  "use strict";
  const canvas = document.getElementById("function-canvas");
  const ctx = canvas.getContext("2d");
  const input = document.getElementById("function-input");
  const message = document.getElementById("input-message");
  const results = document.getElementById("analysis-results");
  const title = document.getElementById("analysis-title");
  const legend = document.getElementById("legend");
  const viewLabel = document.getElementById("view-label");
  const colors = { base: "#5a1c2a", valid: "#1976a3", increase: "#198754", decrease: "#e07a24", positive: "#2474c6", negative: "#8a4bb8", extreme: "#c9364d" };
  const modeNames = { domain: "Domain & Range", motion: "Increasing & Decreasing", sign: "Positive & Negative", extrema: "Extreme Values" };
  const funcs = {
    sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos,
    atan: Math.atan, sqrt: Math.sqrt, abs: Math.abs, exp: Math.exp,
    ln: Math.log, log: Math.log10, floor: Math.floor, ceil: Math.ceil, round: Math.round
  };
  let view = { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };
  let currentMode = "domain";
  let evaluator = null;
  let restriction = { min: -Infinity, max: Infinity, minClosed: false, maxClosed: false };
  let samples = [], extrema = [], dragging = false, dragStart = null;

  function tokenize(source) {
    const raw = source.toLowerCase().replaceAll("π", "pi").replaceAll("√", "sqrt").replace(/[−–]/g, "-");
    const tokens = [];
    let i = 0;
    while (i < raw.length) {
      if (/\s/.test(raw[i])) { i++; continue; }
      const number = raw.slice(i).match(/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/);
      if (number) { tokens.push({ type: "number", value: Number(number[0]) }); i += number[0].length; continue; }
      const name = raw.slice(i).match(/^[a-z]+/);
      if (name) { tokens.push({ type: "name", value: name[0] }); i += name[0].length; continue; }
      if ("+-*/^(),".includes(raw[i])) { tokens.push({ type: raw[i], value: raw[i] }); i++; continue; }
      throw new Error(`I don't recognize “${raw[i]}”.`);
    }
    const expanded = [];
    const canEnd = t => t && (t.type === "number" || t.type === "name" || t.type === ")");
    const canStart = t => t && (t.type === "number" || t.type === "name" || t.type === "(");
    tokens.forEach((token, index) => {
      const prev = expanded.at(-1);
      const isFunctionCall = prev?.type === "name" && funcs[prev.value] && token.type === "(";
      if (canEnd(prev) && canStart(token) && !isFunctionCall) expanded.push({ type: "*", value: "*" });
      expanded.push(token);
    });
    return expanded;
  }

  function compile(source) {
    const tokens = tokenize(source);
    if (!tokens.length) throw new Error("Enter a function first.");
    const output = [], operators = [];
    const precedence = { "+": 1, "-": 1, "*": 2, "/": 2, "u-": 3, "^": 4 };
    const rightAssoc = new Set(["^", "u-"]);
    let previous = null;
    for (const token of tokens) {
      if (token.type === "number") output.push(token);
      else if (token.type === "name") {
        if (token.value === "x" || token.value === "pi" || token.value === "e") output.push(token);
        else if (funcs[token.value]) operators.push({ type: "function", value: token.value });
        else throw new Error(`“${token.value}” is not a supported function.`);
      } else if (token.type === "(") operators.push(token);
      else if (token.type === ")") {
        while (operators.length && operators.at(-1).type !== "(") output.push(operators.pop());
        if (!operators.length) throw new Error("Check the parentheses.");
        operators.pop();
        if (operators.at(-1)?.type === "function") output.push(operators.pop());
      } else if ("+-*/^".includes(token.type)) {
        const unary = token.type === "-" && (!previous || "+-*/^(,".includes(previous.type));
        const op = unary ? { type: "operator", value: "u-" } : { type: "operator", value: token.type };
        while (operators.at(-1)?.type === "operator") {
          const top = operators.at(-1).value;
          if ((rightAssoc.has(op.value) && precedence[op.value] < precedence[top]) || (!rightAssoc.has(op.value) && precedence[op.value] <= precedence[top])) output.push(operators.pop()); else break;
        }
        operators.push(op);
      } else throw new Error("Check the expression.");
      previous = token;
    }
    while (operators.length) { const op = operators.pop(); if (op.type === "(") throw new Error("Check the parentheses."); output.push(op); }
    return x => {
      const stack = [];
      for (const token of output) {
        if (token.type === "number") stack.push(token.value);
        else if (token.type === "name") stack.push(token.value === "x" ? x : token.value === "pi" ? Math.PI : Math.E);
        else if (token.type === "function") stack.push(funcs[token.value](stack.pop()));
        else if (token.value === "u-") stack.push(-stack.pop());
        else { const b = stack.pop(), a = stack.pop(); stack.push(token.value === "+" ? a+b : token.value === "-" ? a-b : token.value === "*" ? a*b : token.value === "/" ? a/b : a**b); }
      }
      return stack.length === 1 ? stack[0] : NaN;
    };
  }

  function parseExpression(raw) {
    const brace = raw.match(/\{([^}]+)\}\s*$/);
    const expression = (brace ? raw.slice(0, brace.index) : raw).trim().replace(/^f\s*\(\s*x\s*\)\s*=|^y\s*=/i, "").trim();
    const nextRestriction = { min: -Infinity, max: Infinity, minClosed: false, maxClosed: false };
    if (brace) {
      const text = brace[1].replace(/[−–]/g, "-").replace(/≤/g, "<=").replace(/≥/g, ">=").replace(/\s/g, "");
      let match = text.match(/^(-?\d*\.?\d+)(<=|<)x(<=|<)(-?\d*\.?\d+)$/i);
      if (match) { nextRestriction.min = Number(match[1]); nextRestriction.max = Number(match[4]); nextRestriction.minClosed = match[2] === "<="; nextRestriction.maxClosed = match[3] === "<="; }
      else if ((match = text.match(/^x(<=|<|>=|>)(-?\d*\.?\d+)$/i))) {
        const value = Number(match[2]);
        if (match[1].startsWith("<")) { nextRestriction.max = value; nextRestriction.maxClosed = match[1] === "<="; }
        else { nextRestriction.min = value; nextRestriction.minClosed = match[1] === ">="; }
      } else throw new Error("Use a restriction like {−2 <= x <= 3}, {x < 4}, or {x >= 0}.");
      if (nextRestriction.min > nextRestriction.max) throw new Error("The lower domain limit must come first.");
    }
    return { fn: compile(expression), restriction: nextRestriction };
  }

  function allowed(x) { return x > restriction.min && x < restriction.max || x === restriction.min && restriction.minClosed || x === restriction.max && restriction.maxClosed; }
  function valueAt(x) { if (!allowed(x)) return NaN; const y = evaluator(x); return Number.isFinite(y) ? y : NaN; }
  const xPixel = x => (x - view.xMin) / (view.xMax - view.xMin) * canvas.width;
  const yPixel = y => (view.yMax - y) / (view.yMax - view.yMin) * canvas.height;
  const pixelX = px => view.xMin + px / canvas.width * (view.xMax - view.xMin);
  const pixelY = py => view.yMax - py / canvas.height * (view.yMax - view.yMin);

  function niceStep(span) { const rough = span / 10, power = 10 ** Math.floor(Math.log10(rough)), ratio = rough / power; return (ratio >= 5 ? 5 : ratio >= 2 ? 2 : 1) * power; }
  function format(n) { if (!Number.isFinite(n)) return n < 0 ? "−∞" : "∞"; const value = Math.abs(n) < 1e-7 ? 0 : Math.round(n * 100) / 100; return String(value).replace("-", "−"); }
  function interval(a, b, leftClosed = false, rightClosed = false) { return `${leftClosed ? "[" : "("}${format(a)}, ${format(b)}${rightClosed ? "]" : ")"}`; }

  function resample() {
    samples = [];
    const count = Math.max(900, Math.floor(canvas.width * 1.7));
    for (let i = 0; i <= count; i++) { const x = view.xMin + i / count * (view.xMax - view.xMin), y = valueAt(x); samples.push({ x, y, valid: Number.isFinite(y) }); }
    extrema = [];
    for (let i = 2; i < samples.length - 2; i++) {
      const a=samples[i-2], b=samples[i], c=samples[i+2];
      if (!a.valid || !b.valid || !c.valid) continue;
      const left=b.y-a.y, right=c.y-b.y;
      if (left > 0 && right < 0 || left < 0 && right > 0) {
        if (!extrema.length || Math.abs(b.x-extrema.at(-1).x) > (view.xMax-view.xMin)/100) extrema.push({ x:b.x, y:b.y, type:left>0?"Maximum":"Minimum" });
      }
    }
  }

  function drawGrid() {
    ctx.clearRect(0,0,canvas.width,canvas.height); ctx.fillStyle="#fff"; ctx.fillRect(0,0,canvas.width,canvas.height);
    const sx=niceStep(view.xMax-view.xMin), sy=niceStep(view.yMax-view.yMin);
    ctx.font=`${Math.max(10,canvas.width/75)}px Manrope`; ctx.lineWidth=1; ctx.textAlign="center"; ctx.textBaseline="top";
    for(let x=Math.ceil(view.xMin/sx)*sx;x<=view.xMax;x+=sx){const px=xPixel(x);ctx.strokeStyle=Math.abs(x)<1e-9?"#766965":"#eee8e2";ctx.beginPath();ctx.moveTo(px,0);ctx.lineTo(px,canvas.height);ctx.stroke();if(Math.abs(x)>1e-9){ctx.fillStyle="#80736e";ctx.fillText(format(x),px,Math.min(canvas.height-16,Math.max(3,yPixel(0)+4)));}}
    ctx.textAlign="right";ctx.textBaseline="middle";
    for(let y=Math.ceil(view.yMin/sy)*sy;y<=view.yMax;y+=sy){const py=yPixel(y);ctx.strokeStyle=Math.abs(y)<1e-9?"#766965":"#eee8e2";ctx.beginPath();ctx.moveTo(0,py);ctx.lineTo(canvas.width,py);ctx.stroke();if(Math.abs(y)>1e-9){ctx.fillStyle="#80736e";ctx.fillText(format(y),Math.min(canvas.width-3,Math.max(24,xPixel(0)-5)),py);}}
  }

  function segmentColor(a,b) {
    if (currentMode === "motion") return b.y > a.y ? colors.increase : colors.decrease;
    if (currentMode === "sign") return (a.y+b.y)/2 >= 0 ? colors.positive : colors.negative;
    return currentMode === "domain" ? colors.valid : colors.base;
  }
  function drawGraph() {
    drawGrid(); ctx.lineWidth=Math.max(2.5,canvas.width/300);ctx.lineCap="round";ctx.lineJoin="round";
    for(let i=1;i<samples.length;i++){const a=samples[i-1],b=samples[i];if(!a.valid||!b.valid)continue;const pyA=yPixel(a.y),pyB=yPixel(b.y);if(Math.abs(pyB-pyA)>canvas.height*.65)continue;ctx.strokeStyle=segmentColor(a,b);ctx.beginPath();ctx.moveTo(xPixel(a.x),pyA);ctx.lineTo(xPixel(b.x),pyB);ctx.stroke();}
    if(currentMode==="extrema"){extrema.forEach(p=>{const px=xPixel(p.x),py=yPixel(p.y);if(py<0||py>canvas.height)return;ctx.fillStyle=colors.extreme;ctx.beginPath();ctx.arc(px,py,6,0,Math.PI*2);ctx.fill();ctx.strokeStyle="#fff";ctx.lineWidth=2;ctx.stroke();});}
    [restriction.min,restriction.max].forEach((x,index)=>{if(!Number.isFinite(x)||x<view.xMin||x>view.xMax)return;const y=evaluator(x);if(!Number.isFinite(y))return;ctx.fillStyle=(index===0?restriction.minClosed:restriction.maxClosed)?colors.base:"#fff";ctx.strokeStyle=colors.base;ctx.lineWidth=3;ctx.beginPath();ctx.arc(xPixel(x),yPixel(y),6,0,Math.PI*2);ctx.fill();ctx.stroke();});
  }

  function groupsBy(predicate) {
    const groups=[];let start=null,last=null;
    for(let i=0;i<samples.length;i++){const p=samples[i],yes=p.valid&&predicate(p,i);if(yes&&start===null)start=p.x;if(yes)last=p.x;if(!yes&&start!==null){groups.push([start,last]);start=null;}}
    if(start!==null)groups.push([start,last]); return groups.filter(g=>g[1]-g[0]>(view.xMax-view.xMin)/400);
  }
  function intervalList(groups) { return groups.length ? groups.map(g=>interval(g[0],g[1])).join(" ∪ ") : "None on the visible window"; }
  function resultGroup(label,value,color){return `<div class="result-group"><h3>${color?`<span class="result-dot" style="background:${color}"></span>`:""}${label}</h3><p>${value}</p></div>`;}
  function analyze() {
    const valid=samples.filter(p=>p.valid), visible=valid.length?groupsBy(()=>true):[], ys=valid.map(p=>p.y).filter(y=>y>=view.yMin&&y<=view.yMax);
    let html="";
    if(currentMode==="domain"){
      let domain=intervalList(visible); if(Number.isFinite(restriction.min)||Number.isFinite(restriction.max)) domain=interval(restriction.min,restriction.max,restriction.minClosed,restriction.maxClosed);
      html+=resultGroup("Domain",domain,colors.valid);
      html+=resultGroup("Visible range",ys.length?`≈ ${interval(Math.min(...ys),Math.max(...ys),true,true)}`:"No visible values");
    } else if(currentMode==="sign"){
      html+=resultGroup("Positive: f(x) > 0",intervalList(groupsBy(p=>p.y>0)),colors.positive);
      html+=resultGroup("Negative: f(x) < 0",intervalList(groupsBy(p=>p.y<0)),colors.negative);
      const roots=[];for(let i=1;i<samples.length;i++){const a=samples[i-1],b=samples[i];if(a.valid&&b.valid&&a.y*b.y<=0){const x=a.x+(b.x-a.x)*(-a.y)/(b.y-a.y);if(!roots.length||Math.abs(x-roots.at(-1))>.01)roots.push(x);}}
      html+=resultGroup("Visible zeros",roots.length?roots.map(x=>`x ≈ ${format(x)}`).join(", "):"None");
    } else if(currentMode==="motion"){
      html+=resultGroup("Increasing",intervalList(groupsBy((p,i)=>i>0&&samples[i-1].valid&&p.y>samples[i-1].y)),colors.increase);
      html+=resultGroup("Decreasing",intervalList(groupsBy((p,i)=>i>0&&samples[i-1].valid&&p.y<samples[i-1].y)),colors.decrease);
    } else {
      html+=extrema.length?extrema.map(p=>resultGroup(`Local ${p.type.toLowerCase()}`,`≈ (${format(p.x)}, ${format(p.y)})`,colors.extreme)).join(""):resultGroup("Local extrema","None detected on the visible window");
    }
    results.innerHTML=html; title.textContent=modeNames[currentMode];
    const keys=currentMode==="motion"?[["Increasing",colors.increase],["Decreasing",colors.decrease]]:currentMode==="sign"?[["Positive",colors.positive],["Negative",colors.negative]]:currentMode==="extrema"?[["Function",colors.base],["Local extrema",colors.extreme]]:[["Function in its domain",colors.valid]];
    legend.innerHTML=keys.map(([label,color])=>`<span class="legend-item"><span class="legend-swatch" style="background:${color}"></span>${label}</span>`).join("");
  }
  function update() { resample(); drawGraph(); analyze(); viewLabel.textContent=`x: ${format(view.xMin)} to ${format(view.xMax)} · y: ${format(view.yMin)} to ${format(view.yMax)}`; }
  function resize() { const rect=canvas.getBoundingClientRect(),ratio=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.round(rect.width*ratio);canvas.height=Math.round(rect.height*ratio);update(); }
  function submit() { try { const parsed=parseExpression(input.value);evaluator=parsed.fn;restriction=parsed.restriction;const test=[-1,0,1].some(x=>Number.isFinite(valueAt(x)))||Number.isFinite(restriction.min)||Number.isFinite(restriction.max);if(!test) throw new Error("This function has no real values near the current view.");message.textContent="";update(); } catch(error){message.textContent=error.message;} }

  document.getElementById("function-form").addEventListener("submit",e=>{e.preventDefault();submit();});
  document.querySelectorAll(".example-chip").forEach(b=>b.addEventListener("click",()=>{input.value=b.dataset.expression;submit();}));
  document.querySelectorAll(".feature-button").forEach(b=>b.addEventListener("click",()=>{currentMode=b.dataset.mode;document.querySelectorAll(".feature-button").forEach(x=>{const on=x===b;x.classList.toggle("active",on);x.setAttribute("aria-pressed",String(on));});drawGraph();analyze();}));
  function zoom(factor,centerX=(view.xMin+view.xMax)/2,centerY=(view.yMin+view.yMax)/2){const hw=(view.xMax-view.xMin)*factor/2,hh=(view.yMax-view.yMin)*factor/2;view={xMin:centerX-hw,xMax:centerX+hw,yMin:centerY-hh,yMax:centerY+hh};update();}
  document.getElementById("zoom-in").addEventListener("click",()=>zoom(.75));document.getElementById("zoom-out").addEventListener("click",()=>zoom(1.35));document.getElementById("reset-view").addEventListener("click",()=>{view={xMin:-10,xMax:10,yMin:-10,yMax:10};update();});
  document.getElementById("reveal-button").addEventListener("click",e=>{const hidden=results.classList.toggle("results-hidden");e.currentTarget.textContent=hidden?"Reveal results":"Hide results";e.currentTarget.setAttribute("aria-expanded",String(!hidden));});
  canvas.addEventListener("wheel",e=>{e.preventDefault();const rect=canvas.getBoundingClientRect(),px=(e.clientX-rect.left)*canvas.width/rect.width,py=(e.clientY-rect.top)*canvas.height/rect.height;zoom(e.deltaY>0?1.14:.88,pixelX(px),pixelY(py));},{passive:false});
  canvas.addEventListener("pointerdown",e=>{dragging=true;canvas.setPointerCapture(e.pointerId);dragStart={x:e.clientX,y:e.clientY,view:{...view}};});
  canvas.addEventListener("pointermove",e=>{if(!dragging)return;const rect=canvas.getBoundingClientRect(),dx=(e.clientX-dragStart.x)/rect.width*(dragStart.view.xMax-dragStart.view.xMin),dy=(e.clientY-dragStart.y)/rect.height*(dragStart.view.yMax-dragStart.view.yMin);view={xMin:dragStart.view.xMin-dx,xMax:dragStart.view.xMax-dx,yMin:dragStart.view.yMin+dy,yMax:dragStart.view.yMax+dy};update();});
  canvas.addEventListener("pointerup",()=>{dragging=false;});canvas.addEventListener("pointercancel",()=>{dragging=false;});
  window.addEventListener("resize",resize); evaluator=compile("x^3-3x"); requestAnimationFrame(resize);
})();
