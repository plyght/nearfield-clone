var e=Math.PI*2,t=521,n={base:[.949,.314,.047],speed:.055,waves:[{opacity:.85,lineWidth:96,frequency:1.485,amplitude:.535,falloff:0,verticalPosition:.499,phaseOffset:-.48,overscanFraction:238/939},{opacity:.329,lineWidth:76,frequency:1.485,amplitude:.535,falloff:0,verticalPosition:.499,phaseOffset:-3.62,overscanFraction:238/939}]},r={base:[1,.353,.078],speed:1.093,waves:[{opacity:.85,lineWidth:26,frequency:2.085,amplitude:.335,falloff:.314,verticalPosition:.499,phaseOffset:-.48,overscanFraction:83.3/939},{opacity:.329,lineWidth:17.833,frequency:2.085,amplitude:.335,falloff:.314,verticalPosition:.499,phaseOffset:-3.62,overscanFraction:83.3/939}]},i=[1,.92,.82],a=[.96,.84,1],o=[.482,0,.969],s=[.588,.075,1],ee=45.25,te=4.99,ne=.03,re=.16,ie=`[data-wave-trigger], .buy-btn`,ae=150,oe=850,se=`
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`,ce=`
precision highp float;

uniform vec2  uRes;
uniform float uPhase;
uniform vec3  uBase;
uniform vec3  uInk;
uniform float uMaxBlur;
uniform float uBlurExp;
uniform float uStrongLeft;
uniform float uGrain;

uniform float uOpacity[2];
uniform float uLineW[2];
uniform float uFreq[2];
uniform float uAmp[2];
uniform float uFalloff[2];
uniform float uVPos[2];
uniform float uPhaseOff[2];
uniform float uOverscan[2];

const float TAU = 6.2831853071795864;

vec3 softLight(vec3 b, vec3 s) {
  vec3 d = mix(((16.0 * b - 12.0) * b + 4.0) * b, sqrt(b), step(0.25, b));
  vec3 lo = b - (1.0 - 2.0 * s) * b * (1.0 - b);
  vec3 hi = b + (2.0 * s - 1.0) * (d - b);
  return mix(lo, hi, step(0.5, s));
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// Soft coverage of one wave stroke at a fragment. The edge softness 'e' grows
// across the width to emulate the app's variable-radius progressive blur.
float coverage(vec2 frag, float W, float H,
               float O, float lineW, float freq, float amp,
               float falloff, float vpos, float phaseOff, float opacity) {
  float T = W + 2.0 * O;
  float midY = H * vpos;
  float A = H * amp;
  float k = freq * TAU / T;
  float x = frag.x;
  float angle = (x + O) * k - uPhase - phaseOff;
  float s = sin(angle);
  float c = cos(angle);
  float visible = clamp(x / W, 0.0, 1.0);
  float env = max(1.0 - falloff * visible, 0.0);
  float envD = (x > 0.0 && x < W) ? (-falloff / W) : 0.0;
  float y = midY + s * A * env;
  // perpendicular distance to the curve (slope-corrected vertical distance)
  float slope = A * (envD * s + env * c * k);
  float perp = abs(frag.y - y) / sqrt(1.0 + slope * slope);
  float hw = lineW * 0.5;
  float leftAmount = (uStrongLeft > 0.5) ? (1.0 - x / W) : (x / W);
  float e = 0.8 + uMaxBlur * pow(clamp(leftAmount, 0.0, 1.0), uBlurExp);
  float cov = 1.0 - smoothstep(hw - e, hw + e, perp);
  return cov * opacity;
}

void main() {
  float W = uRes.x;
  float H = uRes.y;
  vec2 frag = vec2(gl_FragCoord.x, H - gl_FragCoord.y); // top-left origin

  float a0 = coverage(frag, W, H, uOverscan[0], uLineW[0], uFreq[0], uAmp[0], uFalloff[0], uVPos[0], uPhaseOff[0], uOpacity[0]);
  float a1 = coverage(frag, W, H, uOverscan[1], uLineW[1], uFreq[1], uAmp[1], uFalloff[1], uVPos[1], uPhaseOff[1], uOpacity[1]);
  float a = a0 + a1 * (1.0 - a0); // source-over composite of the two strokes

  vec3 col = mix(uBase, softLight(uBase, uInk), a);
  col += (hash21(frag) - 0.5) * uGrain;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;function c(e,t,n){let r=e.createShader(t);if(e.shaderSource(r,n),e.compileShader(r),!e.getShaderParameter(r,e.COMPILE_STATUS)){let t=e.getShaderInfoLog(r);throw e.deleteShader(r),Error(`Wave shader compile error: `+t)}return r}var l=(e,t,n)=>e+(t-e)*n;function u(u,d){let f=u.getContext(`webgl`,{antialias:!0,alpha:!1,depth:!1,stencil:!1,premultipliedAlpha:!1,powerPreference:`low-power`})||u.getContext(`experimental-webgl`);if(!f)return()=>{};let p;try{let e=c(f,f.VERTEX_SHADER,se),t=c(f,f.FRAGMENT_SHADER,ce);if(p=f.createProgram(),f.attachShader(p,e),f.attachShader(p,t),f.linkProgram(p),!f.getProgramParameter(p,f.LINK_STATUS))throw Error(`Wave program link error: `+f.getProgramInfoLog(p))}catch(e){return console.warn(e),()=>{}}f.useProgram(p);let le=f.createBuffer();f.bindBuffer(f.ARRAY_BUFFER,le),f.bufferData(f.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),f.STATIC_DRAW);let m=f.getAttribLocation(p,`aPos`);f.enableVertexAttribArray(m),f.vertexAttribPointer(m,2,f.FLOAT,!1,0,0);let h=e=>f.getUniformLocation(p,e),ue=h(`uRes`),de=h(`uPhase`),fe=h(`uBase`),pe=h(`uInk`),me=h(`uMaxBlur`),he=h(`uBlurExp`),ge=h(`uStrongLeft`),_e=h(`uGrain`),ve=h(`uOpacity`),ye=h(`uLineW`),be=h(`uFreq`),xe=h(`uAmp`),Se=h(`uFalloff`),Ce=h(`uVPos`),we=h(`uPhaseOff`),Te=h(`uOverscan`),g=d.dataset.waveVariant===`settings`,_=g?o:n.base,v=g?s:r.base;f.uniform3fv(pe,g?a:i),f.uniform1f(he,te),f.uniform1f(ge,1),f.uniform1f(_e,ne);let y=new Float32Array(2),b=new Float32Array(2),x=new Float32Array(2),S=new Float32Array(2),C=new Float32Array(2),w=new Float32Array(2),T=new Float32Array(2),E=new Float32Array(2),D=new Float32Array(3),O=1,k=1;function A(){let e=d.getBoundingClientRect(),t=Math.min(window.devicePixelRatio||1,2),n=Math.max(1,Math.round(e.width*t)),r=Math.max(1,Math.round(e.height*t));(n!==O||r!==k)&&(O=n,k=r,u.width=n,u.height=r,f.viewport(0,0,n,r),L||B(M))}let j=window.matchMedia(`(prefers-reduced-motion: reduce)`),Ee=performance.now();function De(){return j.matches?1:1-(1-Math.min(Math.max((performance.now()-Ee-ae)/oe,0),1))**3}let M=0,N=0,P=0,F=performance.now(),I=0,L=!1,R=!0;function z(){let e=N,i=k/t,a=De();for(let t=0;t<2;t++){let o=n.waves[t],s=r.waves[t];y[t]=l(o.opacity,s.opacity,e),b[t]=l(o.lineWidth,s.lineWidth,e)*i*(.3+.7*a),x[t]=l(o.frequency,s.frequency,e),S[t]=l(o.amplitude,s.amplitude,e)*a,C[t]=l(o.falloff,s.falloff,e),w[t]=l(o.verticalPosition,s.verticalPosition,e),T[t]=l(o.phaseOffset,s.phaseOffset,e),E[t]=l(o.overscanFraction,s.overscanFraction,e)*O}D[0]=l(_[0],v[0],e),D[1]=l(_[1],v[1],e),D[2]=l(_[2],v[2],e),f.uniform2f(ue,O,k),f.uniform1f(de,M),f.uniform3fv(fe,D),f.uniform1f(me,ee*i),f.uniform1fv(ve,y),f.uniform1fv(ye,b),f.uniform1fv(be,x),f.uniform1fv(xe,S),f.uniform1fv(Se,C),f.uniform1fv(Ce,w),f.uniform1fv(we,T),f.uniform1fv(Te,E),f.drawArrays(f.TRIANGLES,0,3)}function B(e){M=e,z()}function V(t){let i=Math.min(Math.max((t-F)/1e3,0),.1);F=t,N+=(P-N)*(1-Math.exp(-i/re));let a=l(n.speed,r.speed,N);M+=i*a*e,z(),Math.abs(P-N)<.001&&(N=P),I=requestAnimationFrame(V)}function H(){L||!R||document.hidden||j.matches||(L=!0,F=performance.now(),I=requestAnimationFrame(V))}function U(){L=!1,I&&cancelAnimationFrame(I),I=0}let W=new ResizeObserver(()=>A());W.observe(d);let G=new IntersectionObserver(e=>{R=e[0]?.isIntersecting??!0,R?H():U()},{threshold:0});G.observe(d);let K=()=>document.hidden?U():H();document.addEventListener(`visibilitychange`,K);let q=e=>e instanceof Element?e.closest(ie):null,J=()=>{d.dataset.waveHover=`true`,P=1,H()},Y=()=>{d.dataset.waveHover=`false`,P=0,H()};d.dataset.waveHover=`false`;let X=e=>{let t=q(e.target);if(!t)return;let n=e.relatedTarget instanceof Node?e.relatedTarget:null;t.contains(n)||J()},Z=e=>{let t=q(e.target);if(!t)return;let n=e.relatedTarget instanceof Node?e.relatedTarget:null;t.contains(n)||Y()},Q=e=>{q(e.target)&&J()},Oe=e=>{q(e.target)&&Y()};document.addEventListener(`pointerover`,X),document.addEventListener(`pointerout`,Z),document.addEventListener(`focusin`,Q),document.addEventListener(`focusout`,Oe);let $=()=>{j.matches?(U(),B(M)):H()};return j.addEventListener?.(`change`,$),A(),B(0),H(),function(){U(),W.disconnect(),G.disconnect(),document.removeEventListener(`visibilitychange`,K),document.removeEventListener(`pointerover`,X),document.removeEventListener(`pointerout`,Z),document.removeEventListener(`focusin`,Q),document.removeEventListener(`focusout`,Oe),delete d.dataset.waveHover,j.removeEventListener?.(`change`,$)}}function d(){let e=document.querySelector(`[data-hero-headline]`),t=window.matchMedia(`(prefers-reduced-motion: reduce)`).matches;if(!e||t)return;e.setAttribute(`aria-label`,(e.textContent??``).replace(/\s+/g,` `).trim());let n=0,r=e=>{let t=document.createElement(`span`);return t.className=`hero-char`,t.style.setProperty(`--char-d`,`${180+n*11}ms`),t.setAttribute(`aria-hidden`,`true`),typeof e==`string`?t.textContent=e:t.append(e),n++,t},i=[...e.childNodes];e.textContent=``;for(let t of i)if(t.nodeType===Node.TEXT_NODE)for(let n of(t.textContent??``).split(/(\s+)/)){if(!n)continue;if(/^\s+$/.test(n)){e.append(` `);continue}let t=document.createElement(`span`);t.className=`hero-word`;for(let e of n)t.append(r(e));e.append(t)}else t instanceof Element&&e.append(r(t))}var f=[];document.querySelectorAll(`canvas[data-wave]`).forEach(e=>{let t=e.closest(`[data-wave-host]`)??e.parentElement;t&&f.push(u(e,t))}),d(),document.addEventListener(`astro:before-swap`,()=>{for(;f.length;)f.pop()?.()});