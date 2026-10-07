(() => {
const q = (root, selector) => root?.querySelector(selector);
const qa = (root, selector) => (root ? Array.from(root.querySelectorAll(selector)) : []);
function hide(elements) {
if (!elements) return;
gsap.set(elements, {
autoAlpha: 0,
});
}
function resetTransforms(elements) {
if (!elements) return;
gsap.set(elements, {
clearProps: 'transform',
});
}
function createAutomateTimeline(root){
if(!root)return null;const messages=qa(root,'[data-ui-message]');if(!messages.length)return null;const GAP=10,MAX=3;let visible=[];
messages.forEach(m=>gsap.set(m,{autoAlpha:0,y:18,scale:.98}));
function setupMorph(name){const morph=q(root,`[data-ui-morph="${name}"]`);if(!morph)return null;const from=q(morph,'.hero-ui_morph-from'),to=q(morph,'.hero-ui_morph-to');if(from)gsap.set(from,{display:'block',autoAlpha:1});if(to)gsap.set(to,{display:'none',autoAlpha:0});return{root:morph,from,to,owner:morph.closest('[data-ui-message]'),before:0}}
const availability=setupMorph('availability'),confirmation=setupMorph('confirmation'),tl=gsap.timeline({paused:true});
function addMessage(message,time){if(!message)return;gsap.set(message,{display:'block'});const shift=message.offsetHeight+GAP,oldest=visible.length>=MAX?visible[0]:null;visible.forEach(m=>{if(m!==oldest)tl.to(m,{y:`-=${shift}`,duration:.55,ease:'power3.inOut'},time)});if(oldest){tl.to(oldest,{autoAlpha:0,y:`-=${shift+12}`,duration:.4,ease:'power2.in'},time);visible.shift()}tl.fromTo(message,{autoAlpha:0,y:18,scale:.98},{autoAlpha:1,y:0,scale:1,duration:.48,ease:'power3.out'},time+.08);visible.push(message)}
function morphState(state,time,older){if(!state?.from||!state?.to)return;tl.call(()=>{state.before=state.owner?.offsetHeight||0},null,time+.18);tl.to(state.from,{autoAlpha:0,y:-3,duration:.2,ease:'power2.in'},time);tl.set(state.from,{display:'none'},time+.2);tl.set(state.to,{display:'block'},time+.2);tl.call(()=>{const after=state.owner?.offsetHeight||state.before,delta=after-state.before;if(Math.abs(delta)>.5&&older?.length)gsap.to(older,{y:`-=${delta}`,duration:.3,ease:'power2.inOut'})},null,time+.21);tl.fromTo(state.to,{autoAlpha:0,y:4},{autoAlpha:1,y:0,duration:.3,ease:'power2.out'},time+.2)}
addMessage(messages[0],1);addMessage(messages[1],3);addMessage(messages[2],5.1);morphState(availability,6.6,[messages[0],messages[1]]);addMessage(messages[3],8.3);addMessage(messages[4],10.5);addMessage(messages[5],12.6);addMessage(messages[6],14.5);morphState(confirmation,16,[messages[4],messages[5]]);tl.to({},{duration:2});return tl}
function createAugmentTimeline(root){
if(!root)return null;const messages=qa(root,'.hero-ui_augment-column.is-left [data-ui-message]'),cards=qa(root,'.hero-ui_augment-column.is-right .hero-ui_assist-card'),knowledge=cards[0],summary=cards[1],isMobile=matchMedia('(max-width: 767px)').matches,knowledgeResult=knowledge?q(knowledge,'.hero-ui_result'):null,summaryFields=summary?qa(summary,'.hero-ui_summary-field'):[],claimDone=summary?q(summary,'.hero-ui_claim-done'):null;
gsap.set(messages,{autoAlpha:0,y:12});if(knowledge)gsap.set(knowledge,{autoAlpha:0,y:14,scale:.98});if(summary)gsap.set(summary,{autoAlpha:0,y:14,scale:.98});if(knowledgeResult)gsap.set(knowledgeResult,{autoAlpha:0,y:5});if(summaryFields.length)gsap.set(summaryFields,{autoAlpha:0,y:5});if(claimDone)gsap.set(claimDone,{autoAlpha:0});const tl=gsap.timeline({paused:true});
if(isMobile){const GAP=10;let visible=[];function add(m,t){if(!m)return;gsap.set(m,{display:'block'});const shift=m.offsetHeight+GAP;visible.forEach(x=>tl.to(x,{y:`-=${shift}`,duration:.5,ease:'power3.inOut'},t));tl.fromTo(m,{autoAlpha:0,y:14,scale:.98},{autoAlpha:1,y:0,scale:1,duration:.45,ease:'power3.out'},t+.05);visible.push(m)}function hideAll(t){visible.forEach((m,i)=>tl.to(m,{autoAlpha:0,y:'-=12',duration:.35,ease:'power2.in'},t+i*.04));visible=[]}add(messages[0],.4);add(messages[1],2.2);hideAll(4.5);if(knowledge)tl.fromTo(knowledge,{autoAlpha:0,y:14,scale:.98},{autoAlpha:1,y:0,scale:1,duration:.5,ease:'power2.out'},5);if(knowledgeResult)tl.to(knowledgeResult,{autoAlpha:1,y:0,duration:.4,ease:'power2.out'},6.8);if(knowledge)tl.to(knowledge,{autoAlpha:0,y:-12,duration:.4,ease:'power2.in'},8.5);add(messages[2],9);add(messages[3],10.8);hideAll(13);if(summary)tl.fromTo(summary,{autoAlpha:0,y:14,scale:.98},{autoAlpha:1,y:0,scale:1,duration:.5,ease:'power2.out'},13.5);if(summaryFields.length)tl.to(summaryFields,{autoAlpha:1,y:0,duration:.35,stagger:.25,ease:'power2.out'},14.8);if(claimDone)tl.to(claimDone,{autoAlpha:1,duration:.35},16.6);tl.to({},{duration:2.2});return tl}
const GAP=10;let visible=[];function addDesktop(m,t){if(!m)return;gsap.set(m,{display:'block'});const shift=m.offsetHeight+GAP,old=visible.length>=2?visible[0]:null;visible.forEach(x=>{if(x!==old)tl.to(x,{y:`-=${shift}`,duration:.5,ease:'power3.inOut'},t)});if(old){tl.to(old,{autoAlpha:0,y:`-=${shift+10}`,duration:.35,ease:'power2.in'},t);visible.shift()}tl.fromTo(m,{autoAlpha:0,y:12,scale:.98},{autoAlpha:1,y:0,scale:1,duration:.4,ease:'power2.out'},t+.05);visible.push(m)}
addDesktop(messages[0],.4);addDesktop(messages[1],2.2);if(knowledge)tl.to(knowledge,{autoAlpha:1,y:0,scale:1,duration:.55,ease:'power2.out'},4.1);if(knowledgeResult)tl.to(knowledgeResult,{autoAlpha:1,y:0,duration:.4,ease:'power2.out'},5.9);if(knowledge)tl.to(knowledge,{autoAlpha:0,y:-8,duration:.4,ease:'power2.in'},8.3);addDesktop(messages[2],8.8);addDesktop(messages[3],10.5);if(summary)tl.to(summary,{autoAlpha:1,y:0,scale:1,duration:.5,ease:'power2.out'},13.2);if(summaryFields.length)tl.to(summaryFields,{autoAlpha:1,y:0,duration:.35,stagger:.25,ease:'power2.out'},14.5);if(claimDone)tl.to(claimDone,{autoAlpha:1,duration:.35},16.3);tl.to({},{duration:2.4});return tl}
function createBottomStack(tl, items, options = {}) {
const GAP = options.gap ?? 8;
const MAX_VISIBLE = options.maxVisible ?? Infinity;
const ENTER_Y = options.enterY ?? 14;
let visible = [];
items.forEach((item) => {
if (!item) return;
gsap.set(item, {
autoAlpha: 0,
y: ENTER_Y,
});
});
function measure(item) {
if (!item) return 0;
const oldDisplay = item.style.display;
const oldVisibility = item.style.visibility;
gsap.set(item, {
display: 'block',
visibility: 'hidden',
});
const height = item.offsetHeight;
item.style.display = oldDisplay;
item.style.visibility = oldVisibility;
return height;
}
function add(item, time, config = {}) {
if (!item) return;
const height = measure(item);
const shift = height + GAP;
const oldest = visible.length >= MAX_VISIBLE ? visible[0] : null;
visible.forEach((oldItem) => {
if (oldItem === oldest) return;
tl.to(
oldItem,
{
y: `-=${shift}`,
duration: config.shiftDuration ?? 0.55,
ease: config.shiftEase ?? 'power3.inOut',
},
time,
);
});
if (oldest) {
tl.to(
oldest,
{
autoAlpha: 0,
y: `-=${shift + 10}`,
duration: 0.4,
ease: 'power2.in',
},
time,
);
visible.shift();
}
tl.fromTo(
item,
{
autoAlpha: 0,
y: ENTER_Y,
scale: config.scaleFrom ?? 0.98,
},
{
autoAlpha: 1,
y: 0,
scale: 1,
duration: config.duration ?? 0.48,
ease: config.ease ?? 'power3.out',
},
time + (config.delay ?? 0.06),
);
visible.push(item);
}
function remove(item, time, config = {}) {
if (!item) return;
const index = visible.indexOf(item);
if (index === -1) {
tl.to(
item,
{
autoAlpha: 0,
y: '-=8',
duration: 0.4,
ease: 'power2.in',
},
time,
);
return;
}
const height = measure(item);
const shift = height + GAP;
for (let i = 0; i < index; i++) {
tl.to(
visible[i],
{
y: `+=${shift}`,
duration: config.duration ?? 0.45,
ease: 'power3.inOut',
},
time,
);
}
tl.to(
item,
{
autoAlpha: 0,
y: '-=8',
duration: 0.4,
ease: 'power2.in',
},
time,
);
visible.splice(index, 1);
}
function compensateHeight(item, delta, time) {
if (!item || Math.abs(delta) < 0.5) return;
const index = visible.indexOf(item);
if (index === -1) return;
for (let i = 0; i < index; i++) {
tl.to(
visible[i],
{
y: `-=${delta}`,
duration: 0.5,
ease: 'power3.inOut',
},
time,
);
}
}
return {
add,
remove,
compensateHeight,
measure,
getVisible: () => [...visible],
};
}
function createAnalyzeTimeline(root) {
if (!root) return null;
const cards = qa(root, '.hero-ui_analyze-card');
const spike = cards[0];
const analyst = cards[1];
const share = cards[2];
const chartPath = spike ? q(spike, '.hero-ui_chart path') : null;
const report = analyst ? q(analyst, '.hero-ui_analyze-expand') : null;
const progress = analyst ? q(analyst, '.hero-ui_progress-fill') : null;
const shareMessage = share ? q(share, '.hero-ui_share-message') : null;
const analyzeButton = q(root, '[data-ui-click-target="analyze"]');
const shareButton = q(root, '[data-ui-click-target="share"]');
const sendButton = q(root, '[data-ui-click-target="send"]');
const sentState = q(root, '[data-ui-sent]');
const cursor = q(root, '[data-ui-cursor]');
const ripple = q(root, '[data-ui-ripple]');
const isMobile = window.matchMedia('(max-width: 767px)').matches;
function pointFor(target, xRatio = 0.5, yRatio = 0.5) {
if (!target) return { x: 0, y: 0 };
const rootRect = root.getBoundingClientRect();
const targetRect = target.getBoundingClientRect();
return {
x: targetRect.left - rootRect.left + targetRect.width * xRatio,
y: targetRect.top - rootRect.top + targetRect.height * yRatio,
};
}
function moveCursorTo(target, time, options = {}) {
if (!cursor || !target) return;
const {
duration = 0.7,
xRatio = 0.5,
yRatio = 0.5,
ease = 'power2.inOut',
} = options;
tl.to(
cursor,
{
x: () => pointFor(target, xRatio, yRatio).x,
y: () => pointFor(target, xRatio, yRatio).y,
duration,
ease,
},
time,
);
}
function clickCursor(time) {
if (!cursor) return;
tl.to(
cursor,
{ scale: 0.82, duration: 0.08, ease: 'power2.in' },
time,
);
tl.to(
cursor,
{ scale: 1, duration: 0.14, ease: 'back.out(2)' },
time + 0.08,
);
if (ripple) {
tl.set(
ripple,
{
x: () => Number(gsap.getProperty(cursor, 'x')) - ripple.offsetWidth / 2,
y: () => Number(gsap.getProperty(cursor, 'y')) - ripple.offsetHeight / 2,
autoAlpha: 1,
scale: 0,
},
time,
);
tl.to(
ripple,
{
scale: 2.2,
autoAlpha: 0,
duration: 0.42,
ease: 'power2.out',
},
time,
);
}
}
if (report) {
gsap.set(report, {
height: 0,
autoAlpha: 0,
overflow: 'hidden',
});
}
if (progress) {
gsap.set(progress, {
scaleX: 0,
transformOrigin: 'left center',
});
}
if (chartPath) {
try {
const length = chartPath.getTotalLength();
gsap.set(chartPath, {
strokeDasharray: length,
strokeDashoffset: length,
});
} catch (error) {
console.warn("[Hero UI] Couldn't prepare chart path.", error);
}
}
const sendState = sendButton?.parentElement;
if (sendState && sendButton && sentState) {
gsap.set(sendState, {
position: 'relative',
minWidth: Math.max(sendButton.offsetWidth, sentState.offsetWidth || 0),
minHeight: Math.max(sendButton.offsetHeight, sentState.offsetHeight || 0),
});
gsap.set([sendButton, sentState], {
position: 'absolute',
right: 0,
top: 0,
marginTop: 0,
});
gsap.set(sendButton, {
display: 'flex',
autoAlpha: 1,
scale: 1,
});
gsap.set(sentState, {
display: 'flex',
autoAlpha: 0,
scale: 0.92,
pointerEvents: 'none',
});
}
if (cursor) {
gsap.set(cursor, {
left: 0,
top: 0,
bottom: 'auto',
right: 'auto',
autoAlpha: 0,
x: 0,
y: 0,
scale: 1,
transformOrigin: '2px 2px',
});
}
if (ripple) {
gsap.set(ripple, {
left: 0,
top: 0,
bottom: 'auto',
right: 'auto',
autoAlpha: 0,
scale: 0,
transformOrigin: 'center center',
});
}
const tl = gsap.timeline({ paused: true });
const stack = createBottomStack(tl, [spike, analyst, share], {
gap: isMobile ? 12 : 8,
maxVisible: 2,
enterY: 14,
});
stack.add(spike, 0.5, { duration: 0.5 });
if (chartPath) {
tl.to(
chartPath,
{
strokeDashoffset: 0,
duration: 1.5,
ease: 'power1.inOut',
},
1.3,
);
}
stack.add(analyst, 3.5, { duration: 0.5 });
if (cursor && analyzeButton) {
tl.set(
cursor,
{
x: () => pointFor(analyzeButton).x + (isMobile ? 35 : 70),
y: () => pointFor(analyzeButton).y + (isMobile ? 28 : 55),
},
4.45,
);
tl.to(cursor, { autoAlpha: 1, duration: 0.25 }, 4.45);
moveCursorTo(analyzeButton, 4.7, { duration: 0.75 });
clickCursor(5.5);
}
if (isMobile) {
stack.remove(spike, 5.58, { duration: 0.32 });
}
if (report && analyst) {
gsap.set(report, { height: 0, autoAlpha: 0 });
const collapsedHeight = analyst.offsetHeight;
gsap.set(report, { height: 'auto', autoAlpha: 1 });
const expandedHeight = analyst.offsetHeight;
gsap.set(report, { height: 0, autoAlpha: 0 });
const delta = Math.max(0, expandedHeight - collapsedHeight);
if (!isMobile) {
stack.compensateHeight(analyst, delta, 5.65);
}
tl.to(
report,
{
height: delta,
autoAlpha: 1,
duration: 0.65,
ease: 'power2.inOut',
},
5.65,
);
}
if (progress) {
tl.to(
progress,
{ scaleX: 1, duration: 1, ease: 'power2.out' },
6.15,
);
}
if (cursor && shareButton) {
moveCursorTo(shareButton, 7.55, { duration: 0.7 });
clickCursor(8.3);
}
if (!isMobile) {
stack.remove(spike, 8.45);
}
stack.add(share, 8.9, { duration: 0.5 });
if (shareMessage) {
tl.fromTo(
shareMessage,
{ autoAlpha: 0.45 },
{ autoAlpha: 1, duration: 1.2, ease: 'none' },
9.45,
);
}
if (cursor && sendButton) {
moveCursorTo(sendButton, 11.0, { duration: 0.7 });
clickCursor(11.75);
}
if (sendButton && sentState) {
tl.to(
sendButton,
{
autoAlpha: 0,
scale: 0.9,
duration: 0.18,
ease: 'power2.in',
},
11.75,
);
tl.fromTo(
sentState,
{ autoAlpha: 0, scale: 0.92 },
{
autoAlpha: 1,
scale: 1,
duration: 0.32,
ease: 'back.out(1.7)',
},
11.93,
);
}
if (cursor) {
tl.to(
cursor,
{
x: '+=24',
y: '+=20',
autoAlpha: 0,
duration: 0.4,
ease: 'power2.in',
},
12.65,
);
}
tl.to({}, { duration: 2 });
return tl;
}
window.CrestaHeroUIFactories = {
createAutomateTimeline,
createAugmentTimeline,
createAnalyzeTimeline,
};
})();
(() => {
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
function forcePageTop() {
window.scrollTo(0, 0);
document.documentElement.scrollTop = 0;
document.body.scrollTop = 0;
}
forcePageTop();
window.addEventListener('pageshow', () => {
forcePageTop();
requestAnimationFrame(forcePageTop);
});
window.addEventListener('beforeunload', forcePageTop);
function initHomeHero() {
const component = document.querySelector('.home-hero_component');
if (!component || component.dataset.heroInitialized === 'true') {
return;
}
if (typeof gsap === 'undefined') {
console.error('Home Hero: GSAP is not loaded.');
return;
}
if (typeof ScrollTrigger !== 'undefined') {
gsap.registerPlugin(ScrollTrigger);
}
component.dataset.heroInitialized = 'true';
const desktopMedia = window.matchMedia('(min-width: 992px)');
const isDesktop = desktopMedia.matches;
const { createAutomateTimeline, createAugmentTimeline, createAnalyzeTimeline } = window.CrestaHeroUIFactories || {};
if (!createAutomateTimeline || !createAugmentTimeline || !createAnalyzeTimeline) {
console.error('Home Hero: UI timeline factory embed is missing or loaded after the hero controller.');
return;
}
const intro = component.querySelector('.home-hero_intro');
const introHeading = component.querySelector('.home-hero_intro-heading');
const introTexts = Array.from(component.querySelectorAll('.home-hero_intro-text'));
const introLeft = introTexts[0];
const introRight = introTexts[1];
const content = component.querySelector('.home-hero_content');
const slider = component.querySelector('.home-hero_slider');
const track = component.querySelector('.home-hero_track');
const slides = Array.from(component.querySelectorAll('.home-hero_slide'));
const videos = slides.map((slide) => slide.querySelector('.home-hero_video'));
const progressIndicators = slides.map((slide) => slide.querySelector('.home-hero_progress'));
if (!intro || !introHeading || !introLeft || !introRight || !content || !slider || !track || !slides.length) {
console.error('Home Hero: required elements are missing.');
return;
}
const HERO_UI_NAMES = ['automate', 'augment', 'analyze'];
const uiRoots = {
automate: component.querySelector('[data-hero-ui="automate"]'),
augment: component.querySelector('[data-hero-ui="augment"]'),
analyze: component.querySelector('[data-hero-ui="analyze"]'),
};
const uiTimelines = {
automate: createAutomateTimeline(uiRoots.automate),
augment: createAugmentTimeline(uiRoots.augment),
analyze: createAnalyzeTimeline(uiRoots.analyze),
};
let activeUiTimeline = null;
let activeUiIndex = -1;
function setSlideProgress(index, progress) {
const indicator = progressIndicators[index];
if (!indicator) return;
const value = gsap.utils.clamp(0, 1, Number(progress) || 0);
indicator.style.setProperty('--hero-slide-progress', value);
indicator.setAttribute('aria-valuenow', String(Math.round(value * 100)));
}
function resetAllSlideProgress() {
progressIndicators.forEach((indicator, index) => {
if (!indicator) return;
indicator.setAttribute('role', 'progressbar');
indicator.setAttribute('aria-valuemin', '0');
indicator.setAttribute('aria-valuemax', '100');
setSlideProgress(index, 0);
});
}
function stopAllUiTimelines({ resetProgress = true } = {}) {
Object.values(uiTimelines).forEach((tl) => {
if (!tl) return;
tl.eventCallback('onUpdate', null);
tl.eventCallback('onComplete', null);
tl.pause(0);
});
activeUiTimeline = null;
activeUiIndex = -1;
if (resetProgress) {
resetAllSlideProgress();
}
}
function playUiForSlide(index) {
if (!introFinished) return;
const name = HERO_UI_NAMES[index];
const tl = uiTimelines[name];
if (!tl) return;
stopAllUiTimelines();
activeUiTimeline = tl;
activeUiIndex = index;
setSlideProgress(index, 0);
tl.eventCallback('onUpdate', () => {
if (activeUiTimeline !== tl || activeUiIndex !== index) return;
setSlideProgress(index, tl.progress());
});
tl.eventCallback('onComplete', () => {
if (activeUiTimeline !== tl || activeUiIndex !== index || !introFinished) {
return;
}
setSlideProgress(index, 1);
const nextIndex = (index + 1) % slides.length;
goToSlide(nextIndex, {
restartVideoOnChange: true,
playUiAfterMove: true,
});
});
tl.restart();
}
resetAllSlideProgress();
stopAllUiTimelines();
window.CrestaHeroUI = {
timelines: uiTimelines,
play(name) {
const index = HERO_UI_NAMES.indexOf(name);
if (index === -1) return;
playUiForSlide(index);
},
reset(name) {
const tl = uiTimelines[name];
const index = HERO_UI_NAMES.indexOf(name);
if (!tl) return;
tl.eventCallback('onUpdate', null);
tl.eventCallback('onComplete', null);
tl.pause(0);
if (index >= 0) {
setSlideProgress(index, 0);
}
if (activeUiTimeline === tl) {
activeUiTimeline = null;
activeUiIndex = -1;
}
},
stopAll: stopAllUiTimelines,
};
const INTRO_WIDTH = 180;
const INTRO_ASPECT = 1.55;
const INTRO_HEIGHT = INTRO_WIDTH / INTRO_ASPECT;
const INTRO_TEXT_GAP = 24;
const NAV_HEIGHT = 72;
const NAV_GAP = 32;
const BOTTOM_GAP = 32;
const FINAL_TOP = NAV_HEIGHT + NAV_GAP; // 104
const FINAL_VERTICAL_SPACE = NAV_HEIGHT + NAV_GAP + BOTTOM_GAP; // 136
const EXPANSION_SCROLL = 0.75;
const RIFFLE = [0, 1, 2, 0, 1, 2, 0];
const RIFFLE_SPEED = 0.14;
let introFrame = null;
let introVideo = null;
let pinWrapper = null;
let scrollTrigger = null;
let scrollTimeline = null;
let restingHeight = 0;
let finalHeight = 0;
let introFinished = false;
let resizeTimer = null;
let activeSlideIndex = 0;
let sliderReady = false;
let dragStartX = 0;
let dragStartTrackX = 0;
let dragCurrentX = 0;
let isDragging = false;
let didDrag = false;
let pointerDownSlideIndex = -1;
function safePlay(video) {
if (!video) return;
const promise = video.play();
if (promise && typeof promise.catch === 'function') {
promise.catch(() => {});
}
}
function safePause(video) {
if (!video) return;
try {
video.pause();
} catch (e) {}
}
function restartVideo(video) {
if (!video) return;
try {
video.currentTime = 0;
} catch (e) {}
safePlay(video);
}
function pauseRealVideos() {
videos.forEach((video) => {
if (!video) return;
safePause(video);
});
}
videos.forEach((video) => {
if (!video) return;
video.muted = true;
video.loop = true;
video.playsInline = true;
video.setAttribute('muted', '');
video.setAttribute('playsinline', '');
safePause(video);
});
function removeSliderMaxHeight() {
slider.style.setProperty('max-height', 'none', 'important');
}
const sliderObserver = new MutationObserver(() => {
const maxHeight = slider.style.getPropertyValue('max-height');
if (maxHeight !== 'none') {
removeSliderMaxHeight();
}
});
sliderObserver.observe(slider, {
attributes: true,
attributeFilter: ['style'],
});
gsap.set(track, {
height: '100%',
});
function positionTrackAtFirstSlide() {
const firstSlide = slides[0];
if (!firstSlide) return;
gsap.set(track, {
x: 0,
});
const sliderRect = slider.getBoundingClientRect();
const slideRect = firstSlide.getBoundingClientRect();
const sliderCenter = sliderRect.left + sliderRect.width / 2;
const slideCenter = slideRect.left + slideRect.width / 2;
gsap.set(track, {
x: sliderCenter - slideCenter,
});
}
function calculateFinalHeight() {
finalHeight = Math.max(120, window.innerHeight - FINAL_VERTICAL_SPACE);
return finalHeight;
}
function establishRestingGeometry() {
gsap.set(slider, {
clearProps: 'height,y',
});
removeSliderMaxHeight();
const rect = slider.getBoundingClientRect();
restingHeight = Math.max(120, window.innerHeight - rect.top - BOTTOM_GAP);
calculateFinalHeight();
restingHeight = Math.min(restingHeight, finalHeight);
gsap.set(slider, {
height: restingHeight,
y: 0,
});
removeSliderMaxHeight();
positionTrackAtFirstSlide();
}
function createIntroFrame() {
if (introFrame) return;
const sourceVideo = videos[0];
if (!sourceVideo) {
console.error('Home Hero: first video not found.');
return;
}
introFrame = document.createElement('div');
Object.assign(introFrame.style, {
position: 'fixed',
left: '50%',
top: '50%',
width: INTRO_WIDTH + 'px',
height: INTRO_HEIGHT + 'px',
transform: 'translate(-50%, -50%)',
overflow: 'hidden',
borderRadius: '8px',
opacity: '0',
visibility: 'hidden',
zIndex: '999',
pointerEvents: 'none',
willChange: 'left, top, width, height, transform, opacity',
});
introVideo = sourceVideo.cloneNode(true);
introVideo.removeAttribute('id');
introVideo.muted = true;
introVideo.loop = true;
introVideo.playsInline = true;
introVideo.setAttribute('muted', '');
introVideo.setAttribute('playsinline', '');
Object.assign(introVideo.style, {
display: 'block',
width: '100%',
height: '100%',
objectFit: 'cover',
});
introFrame.appendChild(introVideo);
document.body.appendChild(introFrame);
}
function showIntroVideo(index) {
const source = videos[index];
if (!source || !introVideo) return;
const sourceURL = source.currentSrc || source.src || source.querySelector('source')?.src;
if (!sourceURL) return;
if (introVideo.src !== sourceURL) {
introVideo.src = sourceURL;
introVideo.load();
}
restartVideo(introVideo);
}
function prepareInitialState() {
removeSliderMaxHeight();
gsap.set(introHeading, {
opacity: 1,
scale: 0.96,
});
gsap.set([introLeft, introRight], {
x: 0,
opacity: 1,
});
gsap.set(content, {
autoAlpha: 0,
y: 16,
});
gsap.set(slider, {
opacity: 0,
visibility: 'hidden',
});
gsap.set(intro, {
display: 'block',
opacity: 1,
visibility: 'visible',
});
pauseRealVideos();
updateActiveState(0, {
restart: false,
play: false,
});
if (isDesktop) {
createIntroFrame();
}
}
function getMorphTarget() {
positionTrackAtFirstSlide();
return slides[0].getBoundingClientRect();
}
function morphIntoSlider(timeline, position) {
timeline.set(
slider,
{
visibility: 'visible',
opacity: 0,
},
position,
);
timeline.call(
() => {
removeSliderMaxHeight();
safePause(introVideo);
safePause(videos[0]);
positionTrackAtFirstSlide();
requestAnimationFrame(() => {
if (!introFrame) return;
const target = getMorphTarget();
const current = introFrame.getBoundingClientRect();
gsap.set(introFrame, {
left: current.left,
top: current.top,
width: current.width,
height: current.height,
xPercent: 0,
yPercent: 0,
transform: 'none',
});
gsap.to(introFrame, {
left: target.left,
top: target.top,
width: target.width,
height: target.height,
borderRadius: getComputedStyle(slides[0]).borderRadius,
duration: 1.05,
ease: 'power4.inOut',
});
gsap.to(slider, {
opacity: 1,
duration: 0.16,
delay: 0.89,
ease: 'none',
});
gsap.to(introFrame, {
opacity: 0,
duration: 0.12,
delay: 0.96,
ease: 'none',
});
});
},
null,
position,
);
}
function finishSimpleIntro() {
introFinished = true;
gsap.set(intro, { display: 'none' });
gsap.set(content, { autoAlpha: 1, y: 0 });
gsap.set(slider, {
opacity: 1,
visibility: 'visible',
clearProps: 'height,y',
});
removeSliderMaxHeight();
setupTraditionalSlider();
goToSlide(0, {
immediate: true,
restartVideoOnChange: false,
playUiAfterMove: false,
});
updateActiveState(0, {
restart: true,
play: true,
});
playUiForSlide(0);
}
function runSimpleIntro() {
const tl = gsap.timeline();
gsap.set([introLeft, introRight], { x: 0 });
tl.to(introHeading, { scale: 1, duration: 0.5, ease: 'power2.out' }, 0);
tl.to(intro, { autoAlpha: 0, duration: 0.45, ease: 'power2.inOut' }, 0.75);
tl.set(slider, { visibility: 'visible' }, 0.85);
tl.to(content, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 0.85);
tl.to(slider, { opacity: 1, duration: 0.45, ease: 'power2.out' }, 0.85);
tl.call(finishSimpleIntro, null, 1.4);
return tl;
}
function runIntro() {
const tl = gsap.timeline();
const splitDistance = INTRO_WIDTH / 2 + INTRO_TEXT_GAP;
tl.to(
introHeading,
{
scale: 1,
duration: 0.6,
ease: 'power2.out',
},
0,
);
tl.to(
introLeft,
{
x: -splitDistance,
duration: 0.7,
ease: 'power4.inOut',
},
0.55,
);
tl.to(
introRight,
{
x: splitDistance,
duration: 0.7,
ease: 'power4.inOut',
},
0.55,
);
tl.set(
introFrame,
{
visibility: 'visible',
},
0.82,
);
tl.to(
introFrame,
{
opacity: 1,
duration: 0.25,
ease: 'power2.out',
},
0.82,
);
tl.call(() => showIntroVideo(0), null, 0.82);
RIFFLE.slice(1).forEach((index, i) => {
tl.call(() => showIntroVideo(index), null, 1.02 + i * RIFFLE_SPEED);
});
tl.call(() => showIntroVideo(0), null, 1.9);
tl.to(
introHeading,
{
scale: 2.8,
opacity: 0,
duration: 0.9,
ease: 'power3.in',
},
2.02,
);
morphIntoSlider(tl, 2.06);
tl.to(
content,
{
autoAlpha: 1,
y: 0,
duration: 0.6,
ease: 'power2.out',
},
2.58,
);
tl.call(finishIntro, null, 3.22);
return tl;
}
function getTrackXForSlide(index) {
const slide = slides[index];
if (!slide) return 0;
const currentX = Number(gsap.getProperty(track, 'x')) || 0;
gsap.set(track, {
x: 0,
});
const sliderRect = slider.getBoundingClientRect();
const slideRect = slide.getBoundingClientRect();
const sliderCenter = sliderRect.left + sliderRect.width / 2;
const slideCenter = slideRect.left + slideRect.width / 2;
const targetX = sliderCenter - slideCenter;
gsap.set(track, {
x: currentX,
});
return targetX;
}
function getTrackBounds() {
if (!slides.length) {
return {
maxX: 0,
minX: 0,
};
}
return {
maxX: getTrackXForSlide(0),
minX: getTrackXForSlide(slides.length - 1),
};
}
function updateActiveState(index, options = {}) {
const { restart = false, play = true } = options;
const nextIndex = gsap.utils.clamp(0, slides.length - 1, index);
activeSlideIndex = nextIndex;
slides.forEach((slide, slideIndex) => {
const isActive = slideIndex === activeSlideIndex;
slide.classList.toggle('is-active', isActive);
const video = videos[slideIndex];
if (!video) return;
if (isActive && play) {
if (restart) {
restartVideo(video);
} else {
safePlay(video);
}
} else {
safePause(video);
}
});
}
function goToSlide(index, options = {}) {
const { immediate = false, restartVideoOnChange = true, playUiAfterMove = true } = options;
const nextIndex = gsap.utils.clamp(0, slides.length - 1, index);
const changed = nextIndex !== activeSlideIndex;
const targetX = getTrackXForSlide(nextIndex);
gsap.killTweensOf(track);
if (introFinished && (changed || playUiAfterMove)) {
stopAllUiTimelines();
}
updateActiveState(nextIndex, {
restart: changed && restartVideoOnChange,
play: introFinished,
});
if (immediate) {
gsap.set(track, {
x: targetX,
});
if (introFinished && playUiAfterMove) {
playUiForSlide(nextIndex);
}
return;
}
gsap.to(track, {
x: targetX,
duration: 0.65,
ease: 'power3.inOut',
overwrite: true,
onComplete: () => {
if (introFinished && playUiAfterMove) {
playUiForSlide(nextIndex);
}
},
});
}
function getClosestSlideIndex(trackX) {
let closestIndex = 0;
let closestDistance = Infinity;
slides.forEach((slide, index) => {
const targetX = getTrackXForSlide(index);
const distance = Math.abs(trackX - targetX);
if (distance < closestDistance) {
closestDistance = distance;
closestIndex = index;
}
});
return closestIndex;
}
function setupTraditionalSlider() {
if (sliderReady) return;
sliderReady = true;
slider.style.touchAction = 'pan-y';
slider.style.userSelect = 'none';
slides.forEach((slide, index) => {
slide.style.cursor = 'pointer';
slide.addEventListener(
'click',
(event) => {
if (!introFinished) return;
if (didDrag) {
event.preventDefault();
event.stopPropagation();
return;
}
if (index !== activeSlideIndex) {
event.preventDefault();
goToSlide(index, {
restartVideoOnChange: true,
playUiAfterMove: true,
});
}
},
true,
);
slide.addEventListener('dragstart', (event) => {
event.preventDefault();
});
});
track.addEventListener(
'click',
(event) => {
if (!introFinished || didDrag) return;
const clickedSlide = event.target.closest('.home-hero_slide');
if (!clickedSlide || !track.contains(clickedSlide)) return;
const index = slides.indexOf(clickedSlide);
if (index < 0 || index === activeSlideIndex) return;
event.preventDefault();
goToSlide(index, {
restartVideoOnChange: true,
playUiAfterMove: true,
});
},
true,
);
slider.addEventListener('pointerdown', (event) => {
if (!introFinished) return;
if (event.pointerType === 'mouse' && event.button !== 0) {
return;
}
gsap.killTweensOf(track);
dragStartX = event.clientX;
dragCurrentX = event.clientX;
dragStartTrackX = Number(gsap.getProperty(track, 'x')) || 0;
isDragging = true;
didDrag = false;
const downHit = document.elementFromPoint(event.clientX, event.clientY);
const downSlide = downHit?.closest?.('.home-hero_slide');
pointerDownSlideIndex = downSlide && track.contains(downSlide) ? slides.indexOf(downSlide) : -1;
});
slider.addEventListener('pointermove', (event) => {
if (!isDragging) return;
const deltaX = event.clientX - dragStartX;
dragCurrentX = event.clientX;
if (Math.abs(deltaX) > 6 && !didDrag) {
didDrag = true;
slider.setPointerCapture?.(event.pointerId);
}
if (!didDrag) return;
const bounds = getTrackBounds();
let nextX = dragStartTrackX + deltaX;
if (nextX > bounds.maxX) {
nextX = bounds.maxX + (nextX - bounds.maxX) * 0.18;
}
if (nextX < bounds.minX) {
nextX = bounds.minX + (nextX - bounds.minX) * 0.18;
}
gsap.set(track, {
x: nextX,
});
});
function finishDrag(event) {
if (!isDragging) return;
isDragging = false;
if (slider.hasPointerCapture?.(event.pointerId)) {
slider.releasePointerCapture?.(event.pointerId);
}
if (!didDrag) {
const hit = document.elementFromPoint(event.clientX, event.clientY);
const clickedSlide = hit?.closest?.('.home-hero_slide');
let clickedIndex = clickedSlide && track.contains(clickedSlide) ? slides.indexOf(clickedSlide) : pointerDownSlideIndex;
if (pointerDownSlideIndex >= 0) {
clickedIndex = pointerDownSlideIndex;
}
pointerDownSlideIndex = -1;
if (clickedIndex >= 0 && clickedIndex !== activeSlideIndex) {
goToSlide(clickedIndex, {
restartVideoOnChange: true,
playUiAfterMove: true,
});
}
return;
}
pointerDownSlideIndex = -1;
const deltaX = dragCurrentX - dragStartX;
const currentTrackX = Number(gsap.getProperty(track, 'x')) || 0;
const swipeThreshold = Math.min(90, Math.max(45, slider.clientWidth * 0.055));
let nextIndex;
if (deltaX <= -swipeThreshold && activeSlideIndex < slides.length - 1) {
nextIndex = activeSlideIndex + 1;
} else if (deltaX >= swipeThreshold && activeSlideIndex > 0) {
nextIndex = activeSlideIndex - 1;
} else {
nextIndex = getClosestSlideIndex(currentTrackX);
}
goToSlide(nextIndex);
setTimeout(() => {
didDrag = false;
}, 0);
}
slider.addEventListener('pointerup', finishDrag);
slider.addEventListener('pointercancel', finishDrag);
updateActiveState(0, {
restart: false,
play: false,
});
}
function createPinWrapper() {
if (pinWrapper) return;
pinWrapper = document.createElement('div');
pinWrapper.className = 'home-hero_pin-wrapper';
slider.parentNode.insertBefore(pinWrapper, slider);
pinWrapper.appendChild(slider);
Object.assign(pinWrapper.style, {
display: 'flow-root',
width: '100%',
height: restingHeight + 'px',
position: 'relative',
overflow: 'visible',
});
}
function setupScrollStage() {
if (typeof ScrollTrigger === 'undefined') {
console.warn('Home Hero: ScrollTrigger is not loaded.');
return;
}
createPinWrapper();
calculateFinalHeight();
gsap.set(pinWrapper, {
height: finalHeight,
y: 0,
});
gsap.set(slider, {
height: restingHeight,
y: 0,
});
removeSliderMaxHeight();
positionTrackAtFirstSlide();
setupScrollTrigger();
}
function setupScrollTrigger() {
if (scrollTrigger) {
scrollTrigger.kill();
scrollTrigger = null;
}
if (scrollTimeline) {
scrollTimeline.kill();
scrollTimeline = null;
}
calculateFinalHeight();
const scrollDistance = Math.max(1, window.innerHeight * EXPANSION_SCROLL);
const heightDifference = Math.max(0, finalHeight - restingHeight);
gsap.set(pinWrapper, {
height: finalHeight,
y: 0,
});
gsap.set(slider, {
height: restingHeight,
y: 0,
});
removeSliderMaxHeight();
positionTrackAtFirstSlide();
const sliderTop = slider.getBoundingClientRect().top;
const restingY = window.innerHeight - BOTTOM_GAP - sliderTop - restingHeight;
const finalY = window.innerHeight - BOTTOM_GAP - sliderTop - finalHeight;
gsap.set(slider, {
y: restingY,
});
removeSliderMaxHeight();
const restingPinTop = pinWrapper.getBoundingClientRect().top;
scrollTimeline = gsap.timeline({
paused: true,
});
scrollTimeline.to(slider, {
height: finalHeight,
y: finalY,
duration: 1,
ease: 'none',
onUpdate: removeSliderMaxHeight,
});
scrollTrigger = ScrollTrigger.create({
trigger: pinWrapper,
pin: pinWrapper,
start: () => `top ${restingPinTop}px`,
end: () => `+=${Math.max(0, scrollDistance - 240)}`,
animation: scrollTimeline,
scrub: true,
pinSpacing: true,
pinReparent: true,
anticipatePin: 1,
invalidateOnRefresh: true,
onUpdate: () => {
removeSliderMaxHeight();
},
onRefresh: () => {
removeSliderMaxHeight();
positionTrackAtFirstSlide();
},
onLeave: () => {
gsap.set(slider, {
height: finalHeight,
y: finalY,
});
removeSliderMaxHeight();
},
onEnterBack: () => {
removeSliderMaxHeight();
},
onLeaveBack: () => {
gsap.set(slider, {
height: restingHeight,
y: restingY,
});
removeSliderMaxHeight();
},
});
requestAnimationFrame(() => {
removeSliderMaxHeight();
ScrollTrigger.refresh();
});
}
function finishIntro() {
introFinished = true;
gsap.set(slider, {
opacity: 1,
visibility: 'visible',
});
removeSliderMaxHeight();
gsap.set(intro, {
display: 'none',
});
if (introVideo) {
safePause(introVideo);
}
if (introFrame) {
introFrame.remove();
}
introFrame = null;
introVideo = null;
requestAnimationFrame(() => {
setupScrollStage();
requestAnimationFrame(() => {
setupTraditionalSlider();
goToSlide(activeSlideIndex, {
immediate: true,
restartVideoOnChange: false,
playUiAfterMove: false,
});
updateActiveState(activeSlideIndex, {
restart: true,
play: true,
});
playUiForSlide(activeSlideIndex);
});
});
}
function handleResize() {
clearTimeout(resizeTimer);
resizeTimer = setTimeout(() => {
if (desktopMedia.matches !== isDesktop) {
forcePageTop();
window.location.reload();
return;
}
if (!isDesktop) {
if (introFinished) {
goToSlide(activeSlideIndex, {
immediate: true,
restartVideoOnChange: false,
playUiAfterMove: false,
});
}
return;
}
if (!introFinished) {
establishRestingGeometry();
return;
}
if (scrollTrigger) {
scrollTrigger.kill();
scrollTrigger = null;
}
if (scrollTimeline) {
scrollTimeline.kill();
scrollTimeline = null;
}
gsap.set(slider, {
clearProps: 'height,y',
});
removeSliderMaxHeight();
if (pinWrapper) {
gsap.set(pinWrapper, {
height: 'auto',
});
}
requestAnimationFrame(() => {
const rect = slider.getBoundingClientRect();
calculateFinalHeight();
restingHeight = Math.max(120, window.innerHeight - rect.top - BOTTOM_GAP);
restingHeight = Math.min(restingHeight, finalHeight);
gsap.set(slider, {
height: restingHeight,
y: 0,
});
removeSliderMaxHeight();
positionTrackAtFirstSlide();
setupScrollStage();
requestAnimationFrame(() => {
goToSlide(activeSlideIndex, {
immediate: true,
restartVideoOnChange: false,
playUiAfterMove: false,
});
});
});
}, 150);
}
window.addEventListener('resize', handleResize, {
passive: true,
});
document.addEventListener('visibilitychange', () => {
if (!introFinished || activeUiIndex < 0) return;
const activeVideo = videos[activeUiIndex];
if (document.hidden) {
if (activeUiTimeline) {
activeUiTimeline.pause();
}
safePause(activeVideo);
return;
}
if (activeUiTimeline && activeUiTimeline.progress() < 1) {
activeUiTimeline.resume();
}
safePlay(activeVideo);
});
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reduceMotion) {
introFinished = true;
gsap.set(intro, {
display: 'none',
});
gsap.set(content, {
autoAlpha: 1,
y: 0,
});
gsap.set(slider, {
opacity: 1,
visibility: 'visible',
});
removeSliderMaxHeight();
requestAnimationFrame(() => {
establishRestingGeometry();
pauseRealVideos();
setupTraditionalSlider();
goToSlide(0, {
immediate: true,
restartVideoOnChange: false,
playUiAfterMove: false,
});
updateActiveState(0, {
restart: false,
play: true,
});
if (isDesktop) {
setupScrollStage();
}
playUiForSlide(0);
});
return;
}
prepareInitialState();
function start() {
requestAnimationFrame(() => {
forcePageTop();
pauseRealVideos();
if (!isDesktop) {
gsap.set(slider, {
clearProps: 'height,y',
});
removeSliderMaxHeight();
positionTrackAtFirstSlide();
runSimpleIntro();
return;
}
establishRestingGeometry();
runIntro();
});
}
if (document.fonts && document.fonts.ready) {
document.fonts.ready.then(start);
} else {
start();
}
}
if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', initHomeHero);
} else {
initHomeHero();
}
})();
