const app = document.querySelector('#app');
// Der private Schlüssel bleibt in der nativen APK und landet nicht in verteilbaren Hotfix-Dateien.
const TOMTOM_API_KEY = (() => {
  try { return window.AndroidNavi?.tomTomApiKey?.() || localStorage.getItem('classic-dev-tomtom-key') || ''; }
  catch { return ''; }
})();

const state = {
  screen: new URLSearchParams(location.search).get('screen') || 'menu',
  previousScreen: 'drive',
  map: null,
  driverMap: null,
  driverMapReady: false,
  driverMapFallback: false,
  driverCourse: null,
  driverZoomOffset: 0,
  summaryMap: null,
  previewMap: null,
  userMarker: null,
  destinationMarker: null,
  routeLine: null,
  cameraBearing: null,
  bearingAnimation: 0,
  route: null,
  destination: null,
  navigationMode: 'overview',
  arrived: false,
  current: { lat: null, lon: null, accuracy: 0, speed: 0, heading: 0 },
  hasLiveFix: false,
  lastFixTime: 0,
  gpsWatchId: null,
  gpsRetryTimer: 0,
  gpsLastError: '',
  address: { city: '', postcode: '', street: '', number: '', crossingStreet: '' },
  addressMode: 'streetNumber',
  previewReturnStep: 'number',
  wizardStep: new URLSearchParams(location.search).get('step') || 'city',
  suggestions: [],
  suggestionTimer: null,
  suggestionRequestId: 0,
  suggestionAbortController: null,
  cityContext: null,
  notice: '',
  loading: false,
  follow: true,
  night: localStorage.getItem('classic-night') === 'true',
  voice: localStorage.getItem('classic-voice') !== 'false',
  view3d: false,
  home: JSON.parse(localStorage.getItem('classic-home') || 'null'),
  recent: JSON.parse(localStorage.getItem('classic-recent') || '[]').slice(0, 8),
  favorites: JSON.parse(localStorage.getItem('classic-favorites') || '[]'),
  addressHistory: JSON.parse(localStorage.getItem('classic-address-history') || '[]').slice(0, 40),
  lastInstructionIndex: -1,
  routeStepIndex: 0,
  routeProgressReady: false,
  instructionStepIndex: 0,
  hasMoved: false,
  lastFix: null,
  motionFixes: 0,
  demoMode: false,
  junctionStepKey: -1,
  junctionShownAt: 0,
  junctionTimer: 0,
  positionAnimation: 0,
  offRouteFixes: 0,
  announcedLevels: [],
  lastSpoken: '',
  rerouting: false,
  lastReroute: 0,
  trafficEnabled: true,
  tomtomKey: TOMTOM_API_KEY,
  trafficBlockedUntil: Number(localStorage.getItem('classic-traffic-blocked-until') || 0),
  trafficStatus: localStorage.getItem('classic-traffic-status') || 'Noch nicht geprüft',
  trafficCheckInProgress: false,
  trafficRouteToken: 0,
  lastTrafficCheck: 0,
  trafficIncidents: [],
  announcedIncidentIds: [],
  incidentCheckInProgress: false,
  lastIncidentCheck: 0,
  incidentBlockedUntil: Number(localStorage.getItem('classic-incidents-blocked-until') || 0),
};

// Alte, vom Fahrer eingetragene Schlüssel und Sperrstände der Vorversion
// einmalig entfernen; ab 2.6 übernimmt die Familien-APK die Einrichtung.
localStorage.removeItem('classic-tomtom-key');
localStorage.removeItem('classic-traffic-enabled');
if(localStorage.getItem('classic-embedded-api-version')!=='2.6'){
  state.trafficBlockedUntil=0;state.incidentBlockedUntil=0;state.trafficStatus='TomTom Live-Verkehr bereit';
  localStorage.setItem('classic-embedded-api-version','2.6');
  localStorage.removeItem('classic-traffic-blocked-until');localStorage.removeItem('classic-incidents-blocked-until');localStorage.removeItem('classic-traffic-status');
}

const keys = ['Q','W','E','R','T','Z','U','I','O','P','ß','A','S','D','F','G','H','J','K','L','Ü','-','Y','X','C','V','B','N','M','Ö','Ä',' ','⌫'];
const classicSvgs = {
  navigate:'<rect x="4" y="4" width="56" height="56" rx="7" fill="#0878c9"/><path d="M32 11 16 30h10v23h12V30h10z" fill="#fff"/>',
  alternative:'<rect x="4" y="4" width="56" height="56" rx="7" fill="#e97716"/><path d="M17 51V16h11v9c0 9 7 10 18 10" fill="none" stroke="#fff" stroke-width="7"/><path d="m42 25 10 10-10 10" fill="none" stroke="#fff" stroke-width="7"/>',
  help:'<path d="M9 18h46v35H9z" rx="5" fill="#63a914"/><path d="M23 18v-6h18v6" fill="none" stroke="#784a1e" stroke-width="4"/><circle cx="32" cy="29" r="6" fill="#fff"/><path d="M22 47c2-9 18-9 20 0" fill="#fff"/>',
  favorite:'<path d="m32 5 8 17 19 2-14 13 4 20-17-10-17 10 4-20L5 24l19-2z" fill="#efa615" stroke="#b56a00" stroke-width="2"/><circle cx="49" cy="47" r="11" fill="#68b41b" stroke="#fff" stroke-width="2"/><path d="M49 41v12M43 47h12" stroke="#fff" stroke-width="4"/>',
  settings:'<circle cx="32" cy="32" r="23" fill="#7b8992" stroke="#3c464c" stroke-width="5"/><path d="M32 14v8m0 20v8M14 32h8m20 0h8M19 19l6 6m14 14 6 6m0-26-6 6M25 39l-6 6" stroke="#dce3e7" stroke-width="6"/><circle cx="32" cy="32" r="8" fill="#e8edf0"/>',
  home:'<path d="m7 30 25-22 25 22-6 1v26H14V31z" fill="#fff" stroke="#805235" stroke-width="3"/><path d="m7 30 25-22 25 22" fill="#d94b24" stroke="#9d2716" stroke-width="5"/><rect x="27" y="38" width="11" height="19" fill="#d9a23c"/>',
  recent:'<path d="M13 9v49" stroke="#9c742d" stroke-width="4"/><path d="M15 12h39v28H15z" fill="#fff" stroke="#555" stroke-width="2"/><path d="M15 12h13v9H15zm26 0h13v9H41zM28 21h13v9H28zM15 30h13v10H15zm26 0h13v10H41z" fill="#171717"/>',
  address:'<path d="M8 14h48v30H8z" fill="#67aa21" stroke="#3a6b11" stroke-width="3"/><path d="M32 44v14" stroke="#666" stroke-width="4"/><text x="32" y="34" text-anchor="middle" font-size="18" font-family="Arial" fill="#fff">ABCD</text>',
  poi:'<path d="M15 15h30v42H15z" fill="#1671bc" stroke="#284d6b" stroke-width="3"/><rect x="21" y="21" width="18" height="13" fill="#dcecff"/><path d="M45 25c11 0 10 10 10 18v10c0 5-8 5-8 0V39" fill="none" stroke="#333" stroke-width="4"/>',
  plan:'<path d="M5 9h32v28H5z" rx="4" fill="#176bc0"/><path d="M27 27h32v28H27z" rx="4" fill="#39a3db"/><text x="21" y="30" text-anchor="middle" font-size="22" font-family="Arial" fill="#fff">A</text><text x="43" y="49" text-anchor="middle" font-size="22" font-family="Arial" fill="#fff">B</text>',
  browse:'<path d="M7 10h45v44H7z" fill="#eceddc" stroke="#555" stroke-width="3"/><path d="M9 25h41M24 12v40" stroke="#84a93b" stroke-width="5"/><circle cx="43" cy="40" r="12" fill="#ffe391aa" stroke="#555" stroke-width="4"/><path d="m51 49 9 9" stroke="#333" stroke-width="6"/>',
  corrections:'<path d="M7 10h45v44H7z" fill="#eceddc" stroke="#555" stroke-width="3"/><path d="M9 25h41M24 12v40" stroke="#94b44a" stroke-width="5"/><path d="m30 53 23-30 7 6-23 30z" fill="#d83d32" stroke="#6a2621" stroke-width="2"/>',
  services:'<circle cx="32" cy="32" r="27" fill="#7136a6"/><path d="M19 15h26v32H19z" fill="none" stroke="#fff" stroke-width="3"/><path d="M23 40h18M25 20h14" stroke="#fff" stroke-width="3"/>',
  itinerary:'<path d="M6 9h38v43H6z" fill="#eceddc" stroke="#555" stroke-width="3"/><path d="M8 24h34M22 11v39" stroke="#8daf42" stroke-width="5"/><path d="M32 30h27v27H32z" fill="#fff" stroke="#777"/><text x="45" y="40" text-anchor="middle" font-size="7">Rome</text><text x="45" y="48" text-anchor="middle" font-size="7">Paris</text>',
  city:'<rect x="7" y="14" width="50" height="42" rx="4" fill="#1578c2"/><path d="M15 50V32h8v18m6 0V22h8v28m6 0V28h8v22" fill="#fff"/>',
  street:'<path d="M8 13h48v31H8z" fill="#69aa28" stroke="#497d18" stroke-width="3"/><path d="M32 44v14" stroke="#666" stroke-width="4"/><text x="32" y="34" text-anchor="middle" font-size="19" font-family="Arial" fill="#fff">AB-1</text>',
  postcode:'<path d="M7 10h50v45H7z" fill="#eef0df" stroke="#777" stroke-width="3"/><path d="M9 27h46M27 12v41" stroke="#8fb14b" stroke-width="5"/><circle cx="35" cy="32" r="6" fill="#f39b1c"/>',
  crossing:'<rect x="8" y="9" width="48" height="48" rx="5" fill="#f2b22f"/><path d="m19 19 26 26m0-26L19 45" stroke="#111" stroke-width="10"/>'
};
const icon = (symbol, color = '') => classicSvgs[symbol]
  ? `<span class="classic-icon svg-icon ${color}"><svg viewBox="0 0 64 64" aria-hidden="true">${classicSvgs[symbol]}</svg></span>`
  : `<span class="classic-icon ${color}">${symbol}</span>`;
const menuButton = (action, symbol, label, color = '') => `<button class="menu-item" data-action="${action}">${icon(symbol,color)}<span class="menu-label">${label}</span></button>`;
const bottomBar = (left = 'Zurück', right = 'Fertig', rightAction = 'drive') => `<div class="bottom-bar"><button class="bottom-button" data-action="back">${left}</button><button class="bottom-button primary" data-action="${rightAction}">${right}</button></div>`;

function save() {
  localStorage.setItem('classic-night', state.night);
  localStorage.setItem('classic-voice', state.voice);
  localStorage.setItem('classic-3d', state.view3d);
  localStorage.setItem('classic-home', JSON.stringify(state.home));
  localStorage.setItem('classic-recent', JSON.stringify(state.recent.slice(0, 8)));
  localStorage.setItem('classic-favorites', JSON.stringify(state.favorites.slice(0, 20)));
  localStorage.setItem('classic-address-history', JSON.stringify(state.addressHistory.slice(0, 40)));
  localStorage.setItem('classic-traffic-blocked-until', String(state.trafficBlockedUntil||0));
  localStorage.setItem('classic-traffic-status', state.trafficStatus||'');
  localStorage.setItem('classic-incidents-blocked-until', String(state.incidentBlockedUntil||0));
}

function routeStats() {
  if (!state.route) return { distance: 0, duration: 0, arrival: new Date() };
  const steps=state.route.legs?.[0]?.steps||[];
  let distance=state.route.distance||0;
  if(state.routeProgressReady&&steps.length){
    const next=Math.min(state.routeStepIndex+1,steps.length-1);
    distance=distanceToStep(steps[next])+steps.slice(next).reduce((sum,step)=>sum+(step.distance||0),0);
    distance=Math.min(state.route.distance||distance,distance);
  }
  const duration=(state.route.duration||0)*(state.route.distance?distance/state.route.distance:0);
  return { distance, duration, arrival: new Date(Date.now() + duration * 1000) };
}

function formatDistance(m) { return m < 1000 ? `${Math.max(0, Math.round(m / 10) * 10)} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`; }
function formatDuration(s) { const min = Math.max(1, Math.round(s / 60)); return min < 60 ? `${min} Min.` : `${Math.floor(min/60)}:${String(min%60).padStart(2,'0')} Std.`; }
function timeText(date = new Date()) { return date.toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' }); }

function render() {
if(state.positionAnimation){cancelAnimationFrame(state.positionAnimation);state.positionAnimation=0;}
  if(state.bearingAnimation){cancelAnimationFrame(state.bearingAnimation);state.bearingAnimation=0;}
  if (state.map) { state.map.remove(); state.map = null; }
  if (state.driverMap) { state.driverMap.remove(); state.driverMap = null; }
  state.driverMapReady=false;
  state.userMarker=null;state.destinationMarker=null;
  if (state.summaryMap) { state.summaryMap.remove(); state.summaryMap = null; }
  if (state.previewMap) { state.previewMap.remove(); state.previewMap = null; }
  const content = {
    drive: renderDrive,
    menu: renderMenu,
    menu2: renderMenu2,
    about: renderAbout,
    navigate: renderNavigate,
    navigate2: renderNavigate2,
    addressType: renderAddressType,
    wizard: renderWizard,
    targetPreview: renderTargetPreview,
    summary: renderSummary,
    routeChange: renderRouteChange,
    settings: renderSettings,
    settings2: renderSettings2,
    settings3: renderSettings3,
    voiceSettings: renderVoiceSettings,
    help: renderHelp,
    recent: renderRecent,
    favorites: renderFavorites,
    mapView: renderMapView,
  }[state.screen] || renderDrive;
  app.innerHTML = `<section class="device ${state.night ? 'night' : ''}">${content()}${renderNotice()}</section>`;
  bindActions();
  if (state.screen === 'drive') queueMicrotask(initDriveMap);
  if (state.screen === 'summary') queueMicrotask(initSummaryMap);
  if (state.screen === 'targetPreview') queueMicrotask(initPreviewMap);
  if (state.screen === 'mapView') queueMicrotask(initBrowseMap);
  if (state.screen === 'wizard') queueMicrotask(() => document.querySelector('.big-input')?.focus());
}

function screenHeader(title, page = '') {
  return `<div class="classic-header"><strong>${title}${page ? ` ${page}` : ''}</strong><span>${timeText()}</span></div>`;
}

function pageArrow(action) {
  return `<button class="menu-item page-arrow" data-action="${action}" aria-label="Nächste Menüseite"><span>▶</span></button>`;
}

function renderDrive() {
  const driver=isDriverMode();
  const step = currentStep();
  const stats = routeStats();
  const street = step?.name || (state.route ? 'Route folgen' : state.hasLiveFix ? 'Kein Ziel eingestellt' : 'GPS-Signal wird gesucht…');
  const speed = Number.isFinite(state.current.speed) ? Math.max(0, Math.round(state.current.speed * 3.6)) : 0;
  const distance = step ? distanceToStep(step) : 0;
  const junction = driver && step && junctionActive(step, distance);
  return `<div id="map" class="drive-map${driver?' driver-camera':''}"></div><div class="map-shade"></div><div class="map-credit">${driver?'© OpenFreeMap · OpenMapTiles · OSM':'© OpenStreetMap'}</div><button class="map-tap" data-long-action="menu" aria-label="Hauptmenü öffnen – lange drücken"></button>
    ${junction ? renderJunctionView(step,distance,stats,speed) : renderNormalDrive(step,street,distance,stats,speed)}`;
}

function renderNormalDrive(step, street, distance, stats, speed) {
  const road=step?.name||street;
  const incident=state.trafficIncidents.find(item=>item.distanceAhead<=20000);
  const secondary=state.rerouting?'Route wird neu berechnet…':incident?`${incident.label}${incident.distanceAhead>300?` in ${formatDistance(incident.distanceAhead)}`:''}`:(step?.destinations||'Route folgen');
  const marker=isDriverMode()?`<div class="fixed-position-marker navigation-chevron" aria-hidden="true"><svg viewBox="0 0 42 52"><path class="chevron-outline" d="M21 2L40 48 21 39 2 48z"/><path class="chevron-fill" d="M21 8L34 40 21 34 8 40z"/><path class="chevron-core" d="M21 15L28 34 21 31 14 34z"/></svg></div>`:'';
  return `${marker}<button class="xl-map-control xl-minus" data-action="zoomOut" aria-label="Verkleinern">−</button><button class="xl-map-control xl-plus" data-action="zoom" aria-label="Vergrößern">+</button>
    <button class="xl-quick" data-action="addFavorite" aria-label="Favorit hinzufügen">${icon('favorite')}</button>
    <div class="xl-road-name">${escapeHtml(road)}</div>
    <div class="xl-statusbar">
      <button class="xl-status-turn" data-action="repeat"><strong>${state.route?maneuverArrow(step):''}</strong><span data-drive="distance">${state.route?formatDistance(distance):''}</span></button>
      <button class="xl-status-message" data-long-action="menu">${state.route?`<strong>${escapeHtml(step?.ref||road||'Route folgen')}</strong><span>${escapeHtml(secondary)}</span>`:`<span>${state.hasLiveFix?'GPS-Position bereit':'GPS-Signal<br>wird gesucht…'}</span>`}</button>
      <div class="xl-status-trip"><span class="xl-flag">⚑</span><strong data-drive="remaining">${state.route?formatDistance(stats.distance):'—'}</strong><b data-drive="arrival">${state.route?timeText(stats.arrival):'0:00'}</b><small><span data-drive="speed">${speed}</span> km/h</small></div>
    </div>`;
}

function junctionActive(step, distance) {
  const type=(step?.maneuver?.type||'').toLowerCase();
  const lanes=(step?.intersections||[]).some(x=>Array.isArray(x.lanes)&&x.lanes.some(l=>l.valid===true)&&x.lanes.some(l=>l.valid===false));
  const signed=Boolean(step?.destinations||step?.exits);
  const isJunction=type.includes('ramp')||type==='fork'||type==='merge'||(lanes&&signed);
  if(!isJunction||(!state.hasMoved&&!state.demoMode)||distance<25||distance>450)return false;
  const key=state.instructionStepIndex;
  if(state.junctionStepKey!==key){
    state.junctionStepKey=key;
    state.junctionShownAt=Date.now();
    if(state.junctionTimer)clearTimeout(state.junctionTimer);
    state.junctionTimer=setTimeout(()=>{
      state.junctionTimer=0;
      if(state.screen==='drive'&&document.querySelector('.junction-view'))render();
    },30050);
  }
  return Date.now()-state.junctionShownAt<30000;
}

function stepLanes(step) {
  const intersection=(step?.intersections||[]).find(x=>Array.isArray(x.lanes)&&x.lanes.length);
  return intersection?.lanes || [{indications:['straight'],valid:true},{indications:['straight'],valid:true},{indications:['right'],valid:true}];
}

function laneArrow(lane) {
  const indication=(lane.indications||[]).join(' ');
  if(indication.includes('slight right'))return '↗';
  if(indication.includes('right'))return '↱';
  if(indication.includes('slight left'))return '↖';
  if(indication.includes('left'))return '↰';
  if(indication.includes('uturn'))return '↶';
  return '↑';
}

function renderJunctionView(step,distance,stats,speed) {
  const lanes=stepLanes(step);
  const destination=step.destinations||step.name||'Ausfahrt';
  const routeRef=step.ref||step.exits||'';
  return `<div class="junction-view"><div class="junction-sky"></div><div class="junction-grass"></div><div class="junction-road"><i></i><i></i><i></i><span class="junction-route-arrow">➜</span></div><div class="junction-sign">${routeRef?`<small>${escapeHtml(routeRef)}</small>`:''}<strong>${escapeHtml(destination)}</strong><b>↓</b></div></div>
    <div class="junction-status"><div class="junction-speed"><strong>${timeText()}</strong><span><b data-drive="speed">${speed}</b><small>km/h</small></span></div><div class="junction-lanes">${lanes.map(l=>`<span class="${l.valid===false?'invalid':'valid'}">${laneArrow(l)}</span>`).join('')}</div><button data-action="repeat"><span>${maneuverArrow(step)}</span><strong data-drive="distance">${formatDistance(distance)}</strong></button><div class="junction-arrival"><strong data-drive="arrival">${timeText(stats.arrival)}</strong><span>${formatDuration(stats.duration)}</span></div></div>`;
}

function renderMenu() {
  return `<div class="panel-screen xl-panel">${screenHeader('Hauptmenü','1 von 2')}<div class="menu-grid classic-page-grid">
    ${menuButton('navigate','navigate','Navigieren zu…')}
    ${menuButton('routeChange','alternative','Alternative suchen')}
    ${menuButton('help','help','Hilfe!')}
    ${menuButton('addFavorite','favorite','Favorit hinzufügen')}
    ${menuButton('settings','settings','Einstellungen ändern')}
    ${pageArrow('menuPage2')}
  </div></div><div class="bottom-bar menu-finish"><button class="bottom-button" data-action="drive">Fertig</button><span></span></div>`;
}

function renderMenu2() {
  return `<div class="panel-screen xl-panel">${screenHeader('Hauptmenü','2 von 2')}<div class="menu-grid classic-page-grid">
    ${menuButton('navigate','plan','Route erstellen')}
    ${menuButton('mapView','browse','Karte rollen')}
    ${menuButton('mapCorrections','corrections','Kartenkorrekturen')}
    ${menuButton('services','services','TomTom-Dienste')}
    ${menuButton('itinerary','itinerary','Reiseroutenplanung')}
    ${pageArrow('menu')}
  </div></div><div class="bottom-bar menu-finish"><button class="bottom-button" data-action="drive">Fertig</button><span></span></div>`;
}

function renderNavigate() {
  return `<div class="panel-screen xl-panel">${screenHeader('Navigieren zu…')}<div class="menu-grid classic-page-grid">
    ${menuButton('home','home','Heimatort')}
    ${menuButton('favorites','favorite','Favorit')}
    ${menuButton('startAddress','address','Adresse')}
    ${menuButton('recent','recent','Letztes Ziel')}
    ${menuButton('poi','poi','Sonderziel')}
    ${pageArrow('navigatePage2')}
  </div></div><div class="bottom-bar menu-finish"><button class="bottom-button" data-action="menu">Abbrechen</button><span></span></div>`;
}

function renderNavigate2() {
  return `<div class="panel-screen">${screenHeader('Navigieren zu…','2 von 2')}<div class="menu-grid classic-page-grid">
    ${menuButton('pickMap','⌖','Punkt auf der Karte','purple')}
    ${menuButton('coordinates','◎','Längen- und Breitengrad','gray')}
    ${menuButton('whereAmI','⚑','Position des letzten Halts','orange')}
    ${pageArrow('navigate')}
  </div></div><div class="bottom-bar menu-finish"><button class="bottom-button" data-action="navigate">◀</button><span></span></div>`;
}

function renderAddressType() {
  return `<div class="panel-screen xl-panel">${screenHeader('Navigieren zu…')}<div class="menu-grid classic-page-grid address-type-grid">
    ${menuButton('addressCityCenter','city','Stadtzentrum')}
    ${menuButton('addressStreet','street','Straße und Hausnummer und Stadt')}
    <span class="menu-blank" aria-hidden="true"></span>
    ${menuButton('addressPostcode','postcode','Postleitzahl')}
    ${menuButton('addressCrossing','crossing','Kreuzung')}
  </div></div><div class="bottom-bar menu-finish"><button class="bottom-button" data-action="navigate">Zurück</button><span></span></div>`;
}

function wizardLabel() { return { city:'Stadt:', postcode:'Postleitzahl:', street:'Straße:', crossingStreet:'Kreuzende Straße:', number:'Hausnummer eingeben:' }[state.wizardStep]; }
function wizardValue() { return state.address[state.wizardStep]; }
function renderWizard() {
  if (state.wizardStep === 'number' || state.wizardStep === 'postcode') return renderNumberWizard();
  const country = state.wizardStep === 'city' ? '<button class="country-button" data-action="country" aria-label="Land Deutschland"><i></i><small>Deutschland</small></button>' : '';
  return `<div class="panel-screen wizard-screen">${screenHeader(wizardLabel())}<div class="wizard">
    <div class="entry-row"><input class="big-input" value="${escapeHtml(wizardValue())}" readonly aria-label="${wizardLabel()}" />${country}</div>
    <div class="suggestions">${state.suggestions.length ? state.suggestions.slice(0,3).map((item,i)=>`<button class="suggestion" data-action="suggestion:${i}">${escapeHtml(item.label)}</button>`).join('') : `<div class="suggestion-hint">${wizardValue() ? 'Passende Einträge werden gesucht…' : state.wizardStep === 'city' ? 'Geben Sie den Namen der Stadt ein' : `Straße in ${escapeHtml(state.address.city)} eingeben`}</div>`}</div>
    <div class="keyboard">${keys.map(k => `<button class="key ${k === ' ' ? 'space-key' : ''}" data-key="${k}">${k === ' ' ? 'Leer' : k}</button>`).join('')}</div>
  </div></div><div class="bottom-bar wizard-nav"><button class="bottom-button" data-action="wizardBack">◀</button><button class="bottom-button" data-action="cancelWizard">Abbrechen</button><button class="bottom-button" data-action="wizardNext">OK</button></div>`;
}

function renderNumberWizard() {
  const digits = ['1','2','3','4','5','6','7','8','9','0'];
  const isPostcode = state.wizardStep === 'postcode';
  const value = isPostcode ? state.address.postcode : state.address.number;
  return `<div class="panel-screen number-screen">${screenHeader(isPostcode ? 'Postleitzahl eingeben:' : 'Hausnummer eingeben:')}<div class="number-value"><strong>${escapeHtml(value) || '&nbsp;'}</strong></div>
    <div class="number-keyboard">${digits.map(k=>`<button class="number-key" data-key="${k}">${k}</button>`).join('')}</div>
  </div><div class="bottom-bar wizard-nav"><button class="bottom-button" data-key="⌫">◀</button><button class="bottom-button" data-action="cancelWizard">Abbrechen</button><button class="bottom-button" data-action="wizardNext">OK</button></div>`;
}

function renderTargetPreview() {
  return `<div class="panel-screen preview-screen">${screenHeader('Ziel prüfen')}<div class="preview-layout"><div id="preview-map"></div><button type="button" class="preview-address" data-action="selectDestination" aria-label="Adresse als Ziel bestätigen"><strong>${escapeHtml(state.destination?.display_name || 'Gewähltes Ziel')}</strong><span>Ist dieses Ziel richtig?</span></button></div></div>
    <div class="bottom-bar"><button type="button" class="bottom-button" data-action="previewBack">Zurück</button><button type="button" class="bottom-button primary" data-action="selectDestination">Fertig</button></div>`;
}

function renderSummary() {
  const stats = routeStats();
  const arrived=state.arrived;
  return `<div class="panel-screen">${screenHeader('Routenübersicht')}<div class="summary-body"><div id="summary-map" class="summary-map"></div><div class="summary-info">
    <div class="summary-destination">${escapeHtml(state.destination?.display_name || 'Gewähltes Ziel')}</div>
    <div class="summary-stat"><span>Entfernung</span><strong>${formatDistance(stats.distance)}</strong></div>
    <div class="summary-stat"><span>Fahrzeit</span><strong>${formatDuration(stats.duration)}</strong></div>
    <div class="summary-stat"><span>Ankunft</span><strong>${timeText(stats.arrival)}</strong></div>
  </div></div></div><div class="bottom-bar"><button class="bottom-button" data-action="${arrived?'finishArrival':'routeChange'}">${arrived?'Hauptmenü':'Details'}</button><button class="bottom-button primary" data-action="${arrived?'finishArrival':'startNavigation'}">Fertig</button></div>`;
}

function renderRouteChange() {
  return `<div class="panel-screen"><div class="title">Route ändern</div><div class="menu-grid">
    ${menuButton('alternative','↱','Alternative berechnen','green')}
    ${menuButton('roadblock','▰','Gesperrte Straße vermeiden','orange')}
    ${menuButton('traffic','◷','Verzögerungen minimieren')}
    ${menuButton('navigate','⚑','Ziel ändern','green')}
    ${menuButton('via','＋','Reisen über…','purple')}
    ${menuButton('clearRoute','✕','Route löschen','orange')}
  </div></div>${bottomBar()}`;
}

function renderSettings() {
  return `<div class="panel-screen">${screenHeader('Optionen','1 von 3')}<div class="menu-grid classic-page-grid">
    ${menuButton('volume','🔊','Lautstärken- einstellungen')}
    ${menuButton('brightness','▣','Helligkeits- einstellungen','gray')}
    ${menuButton('toggle3d','▤','Fahransicht- Einstellungen','gray')}
    ${menuButton('setHome','⌂★','Heimatadresse und Favoriten','orange')}
    ${menuButton('voiceSetup','●','Stimmen und Bilder','green')}
    ${pageArrow('settingsPage2')}
  </div></div><div class="bottom-bar menu-finish"><span></span><button class="bottom-button" data-action="drive">Fertig</button></div>`;
}

function renderSettings2() {
  return `<div class="panel-screen">${screenHeader('Optionen','2 von 3')}<div class="menu-grid classic-page-grid">
    ${menuButton('language','DE','Sprache','green')}
    ${menuButton('keyboardInfo','Ä','Tastatur- Einstellungen','gray')}
    ${menuButton('toggleNight','☀','Kartenfarben ändern','orange')}
    ${menuButton('poi','●','POIs verwalten','green')}
    ${menuButton('safety','!','Sicherheits- Einstellungen','orange')}
    ${pageArrow('settingsPage3')}
  </div></div><div class="bottom-bar menu-finish"><button class="bottom-button" data-action="settings">◀</button><button class="bottom-button" data-action="drive">Fertig</button></div>`;
}

function renderSettings3() {
  return `<div class="panel-screen">${screenHeader('Optionen','3 von 3')}<div class="menu-grid classic-page-grid">
    ${menuButton('clockInfo','◷','Uhr einstellen','gray')}
    ${menuButton('units','km','Einheiten','green')}
    ${menuButton('statusInfo','▤','Statusleisten- Einstellungen','gray')}
    ${menuButton('mapInfo','▤','Karten- informationen','green')}
    ${menuButton('factoryReset','↶','Standard wiederherstellen','orange')}
    ${pageArrow('settings')}
  </div></div><div class="bottom-bar menu-finish"><button class="bottom-button" data-action="settingsPage2">◀</button><button class="bottom-button" data-action="drive">Fertig</button></div>`;
}

function nativeVoiceStatus(){
  try{return window.AndroidNavi?.voiceStatus?.()||'browser';}catch{return 'browser';}
}

function renderVoiceSettings() {
  const status=nativeVoiceStatus();
  const ready=status==='ready'||status==='browser';
  let voiceName='Deutsche Systemstimme';
  try{voiceName=window.AndroidNavi?.voiceName?.()||voiceName;}catch{}
  const statusLabel=ready?`Bereit: ${voiceName}`:status==='missing'?'Deutsche Stimme fehlt':status==='initializing'?'Stimme wird geladen…':'Sprachausgabe nicht bereit';
  return `<div class="panel-screen xl-panel">${screenHeader('Stimmen und Bilder')}<div class="menu-grid classic-page-grid voice-grid">
    ${menuButton('toggleVoice','🔊',state.voice?'Stimme ausschalten':'Stimme einschalten',state.voice?'green':'gray')}
    ${menuButton('voiceTest','▶','Stimme testen','green')}
    ${menuButton('voiceInstall','DE','Deutsche Stimme installieren','orange')}
    <div class="voice-status"><strong>${escapeHtml(statusLabel)}</strong><span>Kostenlos · kein API-Schlüssel</span></div>
  </div></div><div class="bottom-bar menu-finish"><button class="bottom-button" data-action="settings">Zurück</button><span></span></div>`;
}

function renderHelp() {
  return `<div class="panel-screen"><div class="title">Hilfe</div><div class="menu-grid">
    ${menuButton('hospital','✚','Nächstes Krankenhaus','green')}
    ${menuButton('police','★','Nächste Polizei')}
    ${menuButton('whereAmI','◎','Wo bin ich?','orange')}
    ${menuButton('breakdown','⚒','Pannenhilfe','gray')}
    ${menuButton('ambulance','☎','Notruf 112','green')}
    ${menuButton('about','i','Über dieses Navi')}
  </div></div>${bottomBar()}`;
}

function renderAbout() {
  return `<div class="panel-screen xl-panel about-screen">${screenHeader('TomTom XL IQ Routes Edition')}<div class="about-copy">
    <strong>Gerät AKTGE BSF4J</strong>
    <span>Anw. 9.510.1234792.2 OS 842337<br>(2039, 4.4.2013)</span>
    <span>64 MB RAM (frei: 15.1 MB)<br>GPS v1.20, Boot 5.5277</span>
    <span>Karte: Western_and_Central_Europe_2GB<br>v835.2419 · Sprache: Deutsch</span>
    <b>Classic Navi 2.8.4 A20e<br>TomTom Traffic · sicherer Hotfix-Updater</b>
  </div></div><div class="bottom-bar about-buttons"><button class="bottom-button" data-action="drive">Fertig</button><button class="bottom-button" data-action="copyright">Copyright</button></div>`;
}

function renderRecent() { return renderStoredList('Letzte Suchen', state.recent, 'recentItem', true); }
function renderFavorites() { return renderStoredList('Favoriten', state.favorites, 'favoriteItem'); }
function renderStoredList(title, items, action, canClear=false) {
  const buttons = items.length ? items.slice(0,8).map((x,i)=>menuButton(`${action}:${i}`, i === 0 ? '⚑' : '●', shortName(x.display_name), i % 2 ? 'green' : 'orange')).join('') : menuButton('startAddress','＋','Noch keine Einträge','green');
  const bar=canClear?`<div class="bottom-bar"><button class="bottom-button" data-action="back">Zurück</button><button class="bottom-button danger" data-action="clearRecent">Liste löschen</button><button class="bottom-button primary" data-action="drive">Fertig</button></div>`:bottomBar();
  return `<div class="panel-screen"><div class="title">${title}</div><div class="choice-list">${buttons}</div></div>${bar}`;
}

function renderMapView() { return `<div id="map"></div><div class="road-sign">Karte anzeigen</div><div class="bottom-bar"><button class="bottom-button" data-action="back">Zurück</button><button class="bottom-button" data-action="centerMap">Meine Position</button><button class="bottom-button primary" data-action="drive">Fertig</button></div>`; }

function renderNotice() {
  if (!state.notice && !state.loading) return '';
  return `<div class="notice">${state.loading?'<span class="loading"></span>':''}${state.notice || 'Bitte warten…'}${state.loading?'':`<br><button class="bottom-button primary" data-action="closeNotice">OK</button>`}</div>`;
}

function bindActions() {
  document.querySelectorAll('[data-action]').forEach(el => el.addEventListener('click', () => act(el.dataset.action)));
  document.querySelectorAll('[data-key]').forEach(el => el.addEventListener('click', () => typeKey(el.dataset.key)));
  document.querySelectorAll('[data-long-action]').forEach(el => {
    let timer=0,fired=false;
    const cancel=()=>{if(timer)clearTimeout(timer);timer=0;el.classList.remove('holding');};
    el.addEventListener('pointerdown',event=>{
      if(event.button!==undefined&&event.button!==0)return;
      fired=false;cancel();el.classList.add('holding');
      timer=setTimeout(()=>{timer=0;fired=true;el.classList.remove('holding');act(el.dataset.longAction);},1200);
    });
    ['pointerup','pointercancel','pointerleave'].forEach(name=>el.addEventListener(name,cancel));
    el.addEventListener('click',event=>{event.preventDefault();if(!fired)cancel();});
  });
}

async function act(action) {
  if (action.includes(':')) {
    const [kind, raw] = action.split(':');
    if(kind==='suggestion'){await chooseSuggestion(Number(raw));return;}
    const item = (kind === 'recentItem' ? state.recent : state.favorites)[Number(raw)];
    if (item) await planTo(item); return;
  }
  switch(action) {
    case 'drive': go('drive'); break;
    case 'menu': go('menu'); break;
    case 'navigate': go('navigate'); break;
    case 'mapView': go('mapView'); break;
    case 'routeChange': state.route ? go('routeChange') : go('navigate'); break;
    case 'settings': go('settings'); break;
    case 'help': go('help'); break;
    case 'recent': go('recent'); break;
    case 'favorites': go('favorites'); break;
    case 'startAddress': resetAddress(); go('addressType'); break;
    case 'addressStreet': beginAddressWizard('streetNumber','city'); break;
    case 'addressPostcode': beginAddressWizard('postcode','postcode'); break;
    case 'addressCityCenter': beginAddressWizard('cityCenter','city'); break;
    case 'addressCrossing': beginAddressWizard('crossing','city'); break;
    case 'wizardNext': await wizardNext(); break;
    case 'wizardBack': wizardBack(); break;
    case 'cancelWizard': resetAddress(); go('addressType'); break;
    case 'back': if (!handleSystemBack()) go('menu'); break;
    case 'summary': if(state.route){state.navigationMode='overview';if(window.AndroidNavi?.keepScreenOn)window.AndroidNavi.keepScreenOn(false);go('summary');}else notify('Es ist noch keine Route geplant.'); break;
    case 'startNavigation': startGuidance(); break;
    case 'selectDestination': await planSelectedDestination(); break;
    case 'previewBack': state.screen='wizard'; state.wizardStep=state.previewReturnStep||'number'; state.suggestions=recentAddressSuggestions(wizardValue(),state.wizardStep); state.notice=''; render(); break;
    case 'clearRoute': clearRoute(); break;
    case 'finishArrival': clearRoute('menu',false); break;
    case 'clearRecent': if(confirm('Alle letzten Suchen löschen?')){state.recent=[];save();speak('Letzte Suchen gelöscht.');render();} break;
    case 'toggleNight': state.night=!state.night; save(); render(); break;
    case 'toggleVoice': state.voice=!state.voice; save(); if(state.voice)speak('Die Sprachausgabe ist eingeschaltet.',true); render(); break;
    case 'toggle3d': state.view3d=false; save(); notify('Die klassische 2D-Fahransicht ist fest eingestellt.'); break;
    case 'country': notify('Land: Deutschland\nZum Ändern bitte das Fähnchen antippen.'); break;
    case 'phone': notify('Auf dem Smartphone ist keine Kopplung mit einem weiteren Handy nötig.'); break;
    case 'volume': notify('Die Lautstärke wird über die Lautstärketasten des Handys eingestellt.'); break;
    case 'brightness': notify('Die Helligkeit wird über die Anzeige-Einstellungen des Handys geregelt.'); break;
    case 'menuPage2': go('menu2'); break;
    case 'navigatePage2': go('navigate2'); break;
    case 'settingsPage2': go('settings2'); break;
    case 'settingsPage3': go('settings3'); break;
    case 'voiceSetup': go('voiceSettings'); break;
    case 'voiceTest':
      if(nativeVoiceStatus()==='ready'&&window.AndroidNavi?.testGermanVoice)window.AndroidNavi.testGermanVoice();
      else if(nativeVoiceStatus()==='browser')speak('Die deutsche Navigationsstimme ist bereit. Gute Fahrt.',true);
      else notify('Die deutsche Stimme ist noch nicht installiert. Tippen Sie auf „Deutsche Stimme installieren“.');
      break;
    case 'voiceInstall':
      if(window.AndroidNavi?.installGermanVoice)window.AndroidNavi.installGermanVoice();
      else notify('Öffnen Sie die Android-Einstellungen für Sprachausgabe und installieren Sie Deutsch.');
      break;
    case 'language': notify('Sprache: Deutsch'); break;
    case 'keyboardInfo': notify('Deutsche Tastatur mit Ä, Ö, Ü und ß ist aktiviert.'); break;
    case 'safety': notify('Sicherheitshinweis: Ziele bitte nur vor Fahrtbeginn eingeben.'); break;
    case 'clockInfo': notify(`Uhrzeit: ${timeText()}\nDie Uhr wird automatisch vom Handy übernommen.`); break;
    case 'units': notify('Einheiten: Kilometer und Meter'); break;
    case 'statusInfo': notify('Statusleiste zeigt Geschwindigkeit, Abbiegehinweis, Entfernung und Ankunft.'); break;
    case 'mapInfo': notify('Karte: aktuelle OpenStreetMap-Onlinekarte'); break;
    case 'mapCorrections': notify('Kartenkorrekturen werden über OpenStreetMap aktuell gehalten.'); break;
    case 'factoryReset': if(confirm('Alle Heimat-, Favoriten- und Verlaufsdaten löschen?')){localStorage.clear();location.reload();} break;
    case 'repeat': state.lastSpoken ? speak(state.lastSpoken,true) : speak('Keine Routenanweisung verfügbar.',true); break;
    case 'zoom': if(state.driverMap){state.driverZoomOffset=Math.min(1,state.driverZoomOffset+.25);updateDriverCamera(state.current,state.driverCourse);}else if(state.map&&!(state.screen==='drive'&&state.map.getZoom()>=16)) state.map.zoomIn(); else if(!state.map) notify('Zoom ist in der Kartenansicht verfügbar.'); break;
    case 'zoomOut': if(state.driverMap){state.driverZoomOffset=Math.max(-1,state.driverZoomOffset-.25);updateDriverCamera(state.current,state.driverCourse);}else if(state.map&&!(state.screen==='drive'&&state.map.getZoom()<=15)) state.map.zoomOut(); break;
    case 'home': state.home ? await planTo(state.home) : beginSetHome(); break;
    case 'setHome': beginSetHome(); break;
    case 'alternative': await calculateRoute(true); break;
    case 'roadblock': notify('Die Route wird bei der nächsten Positionsänderung neu berechnet.'); break;
    case 'traffic': notify(state.route?.provider==='tomtom'?`Live-Verkehr: ${formatTrafficDelay(state.route.trafficDelay)}.\n${state.trafficStatus}`:`Live-Verkehr ist für diese Route nicht verfügbar.\n${state.trafficStatus}`); break;
    case 'via': notify('Wählen Sie zuerst „Ziel ändern“ und planen Sie den Zwischenhalt.'); break;
    case 'fullscreen': await document.documentElement.requestFullscreen?.(); break;
    case 'closeNotice': state.notice=''; render(); break;
    case 'centerMap': centerMap(); break;
    case 'voiceAddress': startVoiceAddress(); break;
    case 'coordinates': askCoordinates(); break;
    case 'pickMap': go('mapView'); notify('Tippen Sie länger auf die gewünschte Kartenposition.'); break;
    case 'poi': notify('Sonderziele werden über die Adresssuche gefunden, z. B. „Tankstelle Stuttgart“.'); break;
    case 'hospital': await searchNearby('Krankenhaus'); break;
    case 'police': await searchNearby('Polizei'); break;
    case 'whereAmI': await showCurrentAddress(); break;
    case 'breakdown': notify('Rufen Sie bei einer Panne Ihren Automobilclub oder Versicherer an.'); break;
    case 'ambulance': location.href='tel:112'; break;
    case 'addFavorite':
      if(state.destination){state.favorites=[state.destination,...state.favorites.filter(x=>x.display_name!==state.destination.display_name)].slice(0,20);save();notify('Ziel wurde als Favorit hinzugefügt.');}
      else notify('Planen Sie zuerst ein Ziel. Danach kann es als Favorit gespeichert werden.');
      break;
    case 'services': notify('TomTom-Dienste des Altgeräts werden durch aktuelle Online-Karten und Routendaten ersetzt.'); break;
    case 'itinerary': notify('Reiseroutenplanung: Wählen Sie nacheinander Ihre Ziele über „Navigieren zu…“.'); break;
    case 'copyright': notify('Historische Geräteangaben nach dem Originalgerät Ihres Vaters. Classic Navi verwendet OpenStreetMap, Photon, TomTom Traffic und OSRM als Notbetrieb.'); break;
    case 'about': go('about'); break;
  }
}

function go(screen) { if (state.screen !== screen) state.previousScreen = state.screen; state.screen = screen; state.notice=''; render(); }
function notify(message) { state.notice=message; state.loading=false; render(); }
function typeKey(k) {
  const key=state.wizardStep;
  if(key==='postcode' && k!=='⌫' && state.address.postcode.length>=5) return;
  state.address[key] = k === '⌫' ? state.address[key].slice(0,-1) : state.address[key] + k;
  state.suggestions=recentAddressSuggestions(state.address[key],key); render(); scheduleSuggestions();
}

function resetAddress() {
  state.address={city:'',postcode:'',street:'',number:'',crossingStreet:''};
  state.addressMode='streetNumber';
  state.wizardStep='city';
  state.suggestions=[];
  state.cityContext=null;
}

function beginAddressWizard(mode, step) {
  resetAddress();
  state.addressMode=mode;
  state.wizardStep=step;
  state.suggestions=recentAddressSuggestions('',step);
  go('wizard');
}

function normalizeSearch(value='') {
  return String(value).toLocaleLowerCase('de-DE').replace(/ß/g,'ss').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
}

function recentAddressSuggestions(value='',step=state.wizardStep) {
  if(!['city','street','crossingStreet'].includes(step))return [];
  const needle=normalizeSearch(value);
  const selectedCity=normalizeSearch(state.address.city).replace(/^\d{5}\s*/,'');
  const source=[...state.addressHistory];
  for(const item of state.recent){
    const parts=String(item.display_name||'').split(',').map(part=>part.trim()).filter(Boolean);
    const city=(parts.at(-1)||'').replace(/^\d{5}\s*/,'');
    const street=(parts[0]||'').replace(/\s+\d+[a-z]?$/i,'');
    if(city)source.push({city,street,lat:item.lat,lon:item.lon,used:0,count:1});
  }
  const matches=[],seen=new Set();
  for(const item of source.sort((a,b)=>(b.used||0)-(a.used||0)||(b.count||0)-(a.count||0))){
    const city=String(item.city||'').replace(/^\d{5}\s*/,'').trim();
    const street=String(item.street||'').trim();
    const candidate=step==='city'?city:street;
    if(!candidate||needle&&!normalizeSearch(candidate).includes(needle))continue;
    if(step!=='city'&&selectedCity&&normalizeSearch(city)!==selectedCity)continue;
    const key=normalizeSearch(candidate);if(seen.has(key))continue;seen.add(key);
    matches.push({lat:item.lat,lon:item.lon,display_name:candidate,label:step==='city'?`Letzter Ort: ${candidate}`:`Zuletzt: ${candidate}`,source:step==='city'?'historyCity':'historyStreet',properties:{city,street,name:candidate,postcode:item.postcode||''}});
    if(matches.length===3)break;
  }
  if(step!=='city'&&needle&&matches.length<3){
    for(const item of state.recent){
      const full=normalizeSearch(item.display_name);
      if(!full.includes(needle)||selectedCity&&!full.includes(selectedCity))continue;
      if(matches.some(existing=>normalizeSearch(existing.display_name)===full))continue;
      matches.push({...item,source:'recent',label:`Letztes Ziel: ${item.display_name}`});
      if(matches.length===3)break;
    }
  }
  return matches;
}

function rememberAddressHistory(city,street='',context={}) {
  city=String(city||'').replace(/^\d{5}\s*/,'').trim();street=String(street||'').trim();
  if(!city)return;
  const cityKey=normalizeSearch(city),streetKey=normalizeSearch(street);
  const old=state.addressHistory.find(item=>normalizeSearch(item.city)===cityKey&&normalizeSearch(item.street)===streetKey);
  const entry={city,street,postcode:context.postcode||old?.postcode||'',lat:Number.isFinite(context.lat)?context.lat:old?.lat,lon:Number.isFinite(context.lon)?context.lon:old?.lon,used:Date.now(),count:(old?.count||0)+1};
  state.addressHistory=[entry,...state.addressHistory.filter(item=>!(normalizeSearch(item.city)===cityKey&&normalizeSearch(item.street)===streetKey))].slice(0,40);
  save();
}

function isCityFeature(feature) {
  const p=feature.properties||{};
  return p.osm_key==='place'&&['city','town','village','municipality','hamlet'].includes(p.osm_value);
}

function isStreetFeature(feature) {
  const p=feature.properties||{};
  if(!(p.osm_key==='highway'||p.type==='street'))return false;
  if(!state.cityContext)return true;
  const wanted=normalizeSearch(state.cityContext.properties?.city||state.cityContext.properties?.town||state.cityContext.properties?.village||state.cityContext.properties?.name||state.address.city).replace(/^\d{5}\s*/, '');
  const actual=normalizeSearch(p.city||p.town||p.village||p.municipality);
  if(wanted){
    if(!actual)return false;
    return actual===wanted||actual.startsWith(`${wanted}-`)||actual.startsWith(`${wanted} `);
  }
  return true;
}

const ADDRESS_SUGGESTION_MIN_CHARS=2;
const ADDRESS_SUGGESTION_DEBOUNCE_MS=120;

function suggestionSearchDelay(value){
  const length=Array.from(String(value||'').trim()).length;
  if(length<ADDRESS_SUGGESTION_MIN_CHARS)return null;
  return length===ADDRESS_SUGGESTION_MIN_CHARS?0:ADDRESS_SUGGESTION_DEBOUNCE_MS;
}

function scheduleSuggestions(){
  clearTimeout(state.suggestionTimer);
  state.suggestionAbortController?.abort();
  state.suggestionAbortController=null;
  const requestId=++state.suggestionRequestId;
  const value=wizardValue().trim();
  const delay=suggestionSearchDelay(value);
  if(delay===null||state.wizardStep==='number'||state.wizardStep==='postcode')return;
  state.suggestionTimer=setTimeout(()=>loadSuggestions(requestId),delay);
}

async function loadSuggestions(requestId=++state.suggestionRequestId){
  const step=state.wizardStep,value=wizardValue().trim(); if(suggestionSearchDelay(value)===null)return;
  const query=step==='city'?value:`${value}, ${state.address.city || state.address.postcode}`;
  const bias=state.cityContext?`&lat=${state.cityContext.lat}&lon=${state.cityContext.lon}`:hasPosition()?`&lat=${state.current.lat}&lon=${state.current.lon}`:'';
  const controller=typeof AbortController==='function'?new AbortController():{signal:undefined,abort(){}};
  state.suggestionAbortController=controller;
  const [tomtomResult,photonResult]=await Promise.allSettled([
    tomTomPlacesSuggest(value,step,{signal:controller.signal}),
    fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&lang=de&limit=5${bias}`,{signal:controller.signal})
      .then(r=>{if(!r.ok)throw new Error(`photon-${r.status}`);return r.json();})
      .then(data=>(data.features||[]).filter(step==='city'?isCityFeature:isStreetFeature).map(photonItem)),
  ]);
  if(requestId!==state.suggestionRequestId||state.wizardStep!==step||wizardValue().trim()!==value)return;
  state.suggestionAbortController=null;
  const recent=recentAddressSuggestions(value,step);
  const online=[
    ...(tomtomResult.status==='fulfilled'?tomtomResult.value:[]),
    ...(photonResult.status==='fulfilled'?photonResult.value:[]),
  ];
  const suggestions=[],seen=new Set();
  for(const item of [...recent,...online]){
    const identity=normalizeSearch(item.properties?.street||item.properties?.name||item.display_name);
    if(!identity||seen.has(identity))continue;
    seen.add(identity);suggestions.push(item);
    if(suggestions.length===3)break;
  }
  state.suggestions=suggestions;
  render();
}

function photonItem(feature){
  const p=feature.properties||{},[lon,lat]=feature.geometry.coordinates;
  const parts=[p.name,p.street,p.housenumber,p.postcode,p.city||p.town||p.village].filter((v,i,a)=>v&&a.indexOf(v)===i);
  return {lat,lon,label:parts.join(', ')||'Unbenannter Ort',display_name:parts.join(', '),properties:p};
}

function tomTomItem(result){
  const a=result?.address||{},position=result?.position||result?.entryPoints?.[0]?.position||{};
  const city=a.municipality||a.municipalitySubdivision||a.countrySecondarySubdivision||'';
  const street=a.streetName||a.street||'';
  const number=a.streetNumber||'';
  const display=a.freeformAddress||[street,number,a.postalCode,city].filter(Boolean).join(', ')||result?.poi?.name||result?.type||'Unbenannter Ort';
  return {lat:+position.lat,lon:+position.lon,label:display,display_name:display,properties:{source:'tomtom',name:street||city||display,street,housenumber:number,postcode:a.postalCode||'',city,town:city,entityType:result?.entityType||result?.type||''}};
}

async function tomTomGeocode(query,limit=3,{lat,lon,radius}={}){
  const params=new URLSearchParams({key:TOMTOM_API_KEY,countrySet:'DE',language:'de-DE',limit:String(limit)});
  if(Number.isFinite(lat)&&Number.isFinite(lon)){params.set('lat',String(lat));params.set('lon',String(lon));}
  if(Number.isFinite(radius))params.set('radius',String(radius));
  const response=await fetch(`https://api.tomtom.com/search/2/geocode/${encodeURIComponent(query)}.json?${params}`);
  if(!response.ok){const error=new Error(`tomtom-geocode-${response.status}`);error.status=response.status;throw error;}
  return (await response.json()).results?.map(tomTomItem).filter(item=>Number.isFinite(item.lat)&&Number.isFinite(item.lon))||[];
}

async function tomTomStructuredAddress({streetName='',streetNumber='',crossStreet='',municipality='',postalCode=''},limit=3){
  const params=new URLSearchParams({key:TOMTOM_API_KEY,countryCode:'DE',language:'de-DE',limit:String(limit)});
  if(streetName)params.set('streetName',streetName);
  if(streetNumber)params.set('streetNumber',streetNumber);
  if(crossStreet)params.set('crossStreet',crossStreet);
  if(municipality)params.set('municipality',municipality.replace(/^\d{5}\s*/,''));
  if(postalCode)params.set('postalCode',postalCode);
  const response=await fetch(`https://api.tomtom.com/search/2/structuredGeocode.json?${params}`);
  if(!response.ok){const error=new Error(`tomtom-geocode-${response.status}`);error.status=response.status;throw error;}
  return (await response.json()).results?.map(tomTomItem).filter(item=>Number.isFinite(item.lat)&&Number.isFinite(item.lon))||[];
}

async function tomTomPlacesSuggest(query,step,{signal}={}){
  const cityStep=step==='city',types=cityStep?['area']:['street','intersection'];
  const filters={types,countryCodesIso2:['DE']};
  if(cityStep)filters.areaTypes=['municipality','municipalitySubdivision'];
  else if(Number.isFinite(state.cityContext?.lat)&&Number.isFinite(state.cityContext?.lon))filters.geometry={type:'circle',center:[state.cityContext.lon,state.cityContext.lat],radiusInMeters:30000};
  const body={query,maxResults:5,filters};
  if(hasPosition())body.origin={type:'point',coordinates:[state.current.lon,state.current.lat]};
  const response=await fetch('https://api.tomtom.com/maps/orbis/places/suggest',{method:'POST',signal,headers:{'TomTom-Api-Key':TOMTOM_API_KEY,'TomTom-Api-Version':'3','Attributes':'results(title,subtitles,type)','Accept-Language':'de-DE','Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!response.ok){const error=new Error(`tomtom-places-${response.status}`);error.status=response.status;throw error;}
  return ((await response.json()).results||[]).filter(result=>result.type!=='discoverAction').filter(result=>cityStep||suggestionCityMatches((result.subtitles||[])[0])).map(result=>{
    const subtitles=result.subtitles||[],city=cityStep?result.title:(subtitles[0]||state.address.city).replace(/^\d{5}\s*/,''),street=cityStep?'':result.title;
    const display=[result.title,...subtitles].filter(Boolean).join(', ');
    return {lat:null,lon:null,label:display,display_name:display,properties:{source:'tomtom-places',name:result.title,street,city,town:city,type:result.type}};
  });
}

function suggestionCityMatches(resultCity,selectedCity=state.address.city){
  const wanted=normalizeSearch(selectedCity).replace(/^\d{5}\s*/,'').trim();
  const actual=normalizeSearch(resultCity).replace(/^\d{5}\s*/,'').trim();
  if(!wanted||!actual)return false;
  return actual===wanted||actual.startsWith(`${wanted}-`)||actual.startsWith(`${wanted} `);
}

async function chooseSuggestion(index){
  const item=state.suggestions[index]; if(!item)return;
  if(item.source==='historyCity'){
    state.address.city=item.properties.city;
    state.cityContext=item;
    if(!Number.isFinite(item.lat)||!Number.isFinite(item.lon)){
      try{state.cityContext=(await tomTomGeocode(`${state.address.city}, Deutschland`,1))[0]||item;}catch{}
    }
    rememberAddressHistory(state.address.city,'',state.cityContext||{});
    if(state.addressMode==='cityCenter')return geocodeCityCenter();
    state.wizardStep='street';state.suggestions=recentAddressSuggestions('','street');render();return;
  }
  if(item.source==='historyStreet'){
    state.address.street=item.properties.street||item.properties.name;
    rememberAddressHistory(state.address.city,state.address.street,state.cityContext||{});
    state.wizardStep=state.addressMode==='crossing'?'crossingStreet':'number';state.suggestions=[];render();return;
  }
  if(item.source==='recent'){
    showDestinationPreview({...item,display_name:item.display_name},state.wizardStep);
    return;
  }
  if(state.wizardStep==='city'){
    state.address.city=[item.properties.postcode,item.properties.city||item.properties.town||item.properties.village||item.properties.name].filter(Boolean).join(' ');
    state.cityContext=item;
    if(!Number.isFinite(item.lat)||!Number.isFinite(item.lon)){
      try{state.cityContext=(await tomTomGeocode(`${state.address.city}, Deutschland`,1))[0]||item;}catch{}
    }
    rememberAddressHistory(state.address.city,'',item);state.suggestions=[];
    if(state.addressMode==='cityCenter') {
      const center=Number.isFinite(state.cityContext?.lat)?state.cityContext:item;
      center.display_name=`Stadtzentrum ${state.address.city}`;
      showDestinationPreview(center);
      return;
    }
    state.wizardStep='street';
    state.suggestions=recentAddressSuggestions('',state.wizardStep);
  }else if(state.wizardStep==='street'){
    state.address.street=item.properties.street||item.properties.name||state.address.street;
    rememberAddressHistory(state.address.city,state.address.street,state.cityContext||{});
    state.wizardStep=state.addressMode==='crossing'?'crossingStreet':'number';
    state.suggestions=recentAddressSuggestions('',state.wizardStep);
  }else if(state.wizardStep==='crossingStreet'){
    state.address.crossingStreet=item.properties.street||item.properties.name||state.address.crossingStreet;
    state.suggestions=[];
    geocodeCrossing();
    return;
  }
  render();
}

async function wizardNext() {
  const value = wizardValue().trim();
  if (!value) return notify(`Bitte ${wizardLabel().replace(':','')} eingeben.`);
  if (state.wizardStep === 'postcode') return resolvePostcode();
  if(['city','street','crossingStreet'].includes(state.wizardStep)){
    const entered=normalizeSearch(value);
    const match=state.suggestions.findIndex(item=>{
      const properties=item.properties||{};
      const candidate=state.wizardStep==='city'
        ?properties.city||properties.town||properties.village||properties.name||item.display_name
        :properties.street||properties.name||item.display_name;
      const normalized=normalizeSearch(candidate);
      return normalized===entered||normalized.startsWith(entered);
    });
    if(match>=0)return chooseSuggestion(match);
  }
  if (state.wizardStep === 'city' && state.addressMode === 'cityCenter') return geocodeCityCenter();
  if (state.wizardStep === 'city') {
    if(!state.cityContext){try{state.cityContext=(await tomTomGeocode(`${state.address.city}, Deutschland`,1))[0]||null;}catch{}}
    rememberAddressHistory(state.address.city,'',state.cityContext||{});
    state.wizardStep='street'; state.suggestions=recentAddressSuggestions('',state.wizardStep);
  }
  else if (state.wizardStep === 'street') { rememberAddressHistory(state.address.city,state.address.street,state.cityContext||{});state.wizardStep=state.addressMode==='crossing'?'crossingStreet':'number'; state.suggestions=recentAddressSuggestions('',state.wizardStep); }
  else if (state.wizardStep === 'crossingStreet') return geocodeCrossing();
  else await geocodeAddress();
  render();
}
function wizardBack() {
  if (state.wizardStep === 'number') state.wizardStep='street';
  else if (state.wizardStep === 'crossingStreet') state.wizardStep='street';
  else if (state.wizardStep === 'street') state.wizardStep=state.addressMode==='postcode'?'postcode':'city';
  else return go('addressType');
  state.suggestions=recentAddressSuggestions(wizardValue(),state.wizardStep);
  render();
}

function handleSystemBack() {
  if (state.notice) {
    state.notice='';
    render();
    return true;
  }
  if (state.screen === 'wizard') {
    wizardBack();
    return true;
  }
  if (state.screen === 'targetPreview') {
    state.screen='wizard';
    state.wizardStep=state.previewReturnStep||'number';
    state.suggestions=recentAddressSuggestions(wizardValue(),state.wizardStep);
    state.notice='';
    render();
    return true;
  }
  if (state.screen === 'drive') return false;
  const fixedPrevious={
    menu:'drive',menu2:'menu',navigate:'menu',navigate2:'navigate',addressType:'navigate',
    settings:'menu',settings2:'settings',settings3:'settings2',voiceSettings:'settings',
    routeChange:'drive',summary:'drive',help:'menu',about:'help',recent:'navigate',favorites:'navigate'
  };
  go(fixedPrevious[state.screen]||state.previousScreen||'menu');
  return true;
}

async function resolvePostcode() {
  if(!/^\d{5}$/.test(state.address.postcode)) return notify('Bitte eine fünfstellige deutsche Postleitzahl eingeben.');
  state.loading=true; state.notice='Postleitzahl wird gesucht…'; render();
  try {
    let item=(await tomTomGeocode(state.address.postcode+' Deutschland',1))[0];
    if(!item){const data=await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(state.address.postcode+' Deutschland')}&lang=de&limit=1`).then(r=>r.json());item=data.features?.[0]?photonItem(data.features[0]):null;}
    if(!item)throw new Error();
    state.cityContext=item;
    state.address.city=item.properties.city||item.properties.town||item.properties.village||state.address.postcode;
    state.wizardStep='street'; state.suggestions=recentAddressSuggestions('',state.wizardStep); state.loading=false; state.notice=''; render();
  } catch { notify('Postleitzahl nicht gefunden. Bitte Eingabe prüfen.'); }
}

async function geocodeCityCenter() {
  state.loading=true; state.notice='Stadtzentrum wird gesucht…'; render();
  try {
    let found=(await tomTomGeocode(state.address.city+', Deutschland',1))[0];
    if(!found){const data=await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(state.address.city+', Deutschland')}&lang=de&limit=1`).then(r=>r.json());found=data.features?.[0]?photonItem(data.features[0]):null;}
    if(!found)throw new Error();
    found.display_name=`Stadtzentrum ${state.address.city}`;
    showDestinationPreview(found);
  } catch { notify('Stadt nicht gefunden. Bitte Schreibweise prüfen.'); }
}

async function geocodeCrossing() {
  state.loading=true; state.notice='Kreuzung wird gesucht…'; render();
  const place=state.address.city||state.address.postcode;
  try {
    const q=`${state.address.street} / ${state.address.crossingStreet}, ${place}, Deutschland`;
    let found=(await tomTomStructuredAddress({streetName:state.address.street,crossStreet:state.address.crossingStreet,municipality:state.address.city,postalCode:state.address.postcode},1))[0];
    if(!found){const data=await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lang=de&limit=1`).then(r=>r.json());found=data.features?.[0]?photonItem(data.features[0]):null;}
    if(!found)throw new Error();
    found.display_name=`${state.address.street} / ${state.address.crossingStreet}, ${place}`;
    showDestinationPreview(found);
  } catch { notify('Kreuzung nicht gefunden. Bitte Straßennamen prüfen.'); }
}

function showDestinationPreview(found, returnStep=state.wizardStep) {
  state.destination=found;
  state.previewReturnStep=returnStep;
  state.loading=false;
  state.notice='';
  state.screen='targetPreview';
  render();
}

async function geocodeAddress() {
  state.loading=true; state.notice='Adresse wird gesucht…'; render();
  const q = `${state.address.street} ${state.address.number}, ${state.address.city || state.address.postcode}, Deutschland`;
  try {
    let found=(await tomTomStructuredAddress({streetName:state.address.street,streetNumber:state.address.number,municipality:state.address.city,postalCode:state.address.postcode},1))[0];
    if(!found){
      const bias=state.cityContext?`&lat=${state.cityContext.lat}&lon=${state.cityContext.lon}`:'';
      const result=await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lang=de&limit=1${bias}`).then(r=>r.json());
      found=result.features?.[0]?photonItem(result.features[0]):null;
    }
    if(!found)throw new Error('not-found');
    found.display_name=`${state.address.street} ${state.address.number}, ${[state.address.postcode,state.address.city].filter(Boolean).join(' ')}`;
    if(localStorage.getItem('setting-home')==='true') {
      state.home=found; localStorage.removeItem('setting-home'); save();
    }
    showDestinationPreview(found);
  } catch { notify('Adresse nicht gefunden. Bitte Schreibweise prüfen oder einen nahegelegenen Ort verwenden.'); }
}

async function planSelectedDestination() {
  if (!state.destination) return;
  rememberSearch(state.destination);
  state.loading=true; state.notice='GPS-Position wird ermittelt…'; render();
  try {
    if(!await ensureGpsFix()) throw new Error('gps');
    await calculateRoute(false);
    showRouteOverview();
  } catch(error) { notify(error?.message==='gps'?'Kein gültiges GPS-Signal. Bitte Standort einschalten und kurz unter freiem Himmel warten.':'Die Route konnte nicht berechnet werden. Bitte Internetverbindung prüfen.'); }
}

async function planTo(destination) {
  state.destination={...destination,lat:+destination.lat,lon:+destination.lon};
  rememberSearch(state.destination);
  state.loading=true; state.notice='GPS-Position wird ermittelt…'; render();
  try {
    if(!await ensureGpsFix()) throw new Error('gps');
    await calculateRoute(false);
    showRouteOverview();
  } catch(error) { notify(error?.message==='gps'?'Kein gültiges GPS-Signal. Bitte Standort einschalten und kurz unter freiem Himmel warten.':'Die Route konnte nicht berechnet werden. Bitte Internetverbindung prüfen.'); }
}

function showRouteOverview(){
  state.navigationMode='overview';state.arrived=false;state.loading=false;state.notice='';go('summary');
}

function isDriverMode(){ return state.navigationMode==='driving'&&Boolean(state.route); }

function startGuidance() {
  if(!state.route)return notify('Es ist noch keine Route geplant.');
  state.navigationMode='driving';state.arrived=false;state.screen='drive'; state.loading=false; state.notice=''; render();
  if(window.AndroidNavi?.keepScreenOn)window.AndroidNavi.keepScreenOn(true);
  const voiceState=nativeVoiceStatus();
  if(state.voice&&voiceState!=='ready'&&voiceState!=='browser')notify('Die deutsche Stimme ist noch nicht bereit. Unter Einstellungen → Stimmen und Bilder kann sie kostenlos installiert werden.');
  else speak(state.route?.provider==='tomtom'&&state.route.trafficDelay>=120?`Die Route wird gestartet. Aktuelle Verkehrsverzögerung etwa ${Math.round(state.route.trafficDelay/60)} Minuten. Bitte folgen Sie der Straße.`:'Die Route wird gestartet. Bitte folgen Sie der Straße.');
  setTimeout(()=>refreshTrafficIncidents(true),1500);
}

function rememberSearch(destination){
  const normalized={lat:+destination.lat,lon:+destination.lon,display_name:destination.display_name||'Gesuchtes Ziel'};
  state.recent=[normalized,...state.recent.filter(x=>x.display_name!==normalized.display_name&&haversine(x.lat,x.lon,normalized.lat,normalized.lon)>20)].slice(0,8);
  save();
}

async function calculateRoute(alternative=false,silent=false) {
  if (!state.destination) return;
  if(!hasPosition()||!state.hasLiveFix) throw new Error('gps');
  const keepDriverMode=silent&&isDriverMode();
  if(!silent){state.loading=true; state.notice=alternative?'Alternative wird berechnet…':'Route wird berechnet…'; render();}
  let route=null;
  if(canUseTomTom()) {
    try {
      route=await calculateTomTomRoute(alternative);
      state.trafficStatus=`Live-Verkehr aktiv · ${formatTrafficDelay(route.trafficDelay)}`;
    } catch(error) {
      handleTomTomError(error);
    }
  }
  if(!route)route=await calculateOsrmRoute(alternative);
  state.route=route;
  if(route.provider==='tomtom')state.lastTrafficCheck=Date.now();
  resetRouteProgress(keepDriverMode?'driving':'overview');
  save();
}

async function calculateOsrmRoute(alternative=false) {
  const start=`${state.current.lon},${state.current.lat}`, end=`${state.destination.lon},${state.destination.lat}`;
  const url=`https://router.project-osrm.org/route/v1/driving/${start};${end}?overview=simplified&geometries=geojson&steps=true&alternatives=${alternative?'true':'false'}`;
  const data=await fetch(url).then(r=>{if(!r.ok)throw new Error();return r.json();});
  if(data.code!=='Ok'||!data.routes?.length) throw new Error();
  const route=alternative&&data.routes[1]?data.routes[1]:data.routes[0];
  route.provider='osrm';route.trafficDelay=0;route.fetchedAt=Date.now();
  if(state.tomtomKey&&state.trafficEnabled&&!state.trafficStatus.startsWith('TomTom'))state.trafficStatus='OSRM-Notbetrieb ohne Live-Verkehr';
  return route;
}

function canUseTomTom(){return TOMTOM_API_KEY.length>=8&&Date.now()>=state.trafficBlockedUntil;}

async function calculateTomTomRoute(alternative=false) {
  const points=`${state.current.lat},${state.current.lon}:${state.destination.lat},${state.destination.lon}`;
  const params=new URLSearchParams({key:state.tomtomKey,traffic:'true',travelMode:'car',routeType:'fastest',routeRepresentation:'polyline',instructionsType:'text',language:'de-DE',computeTravelTimeFor:'all',maxAlternatives:alternative?'1':'0'});
  params.append('sectionType','traffic');params.append('sectionType','lanes');
  const response=await fetch(`https://api.tomtom.com/routing/1/calculateRoute/${points}/json?${params}`);
  if(!response.ok){const error=new Error(`tomtom-${response.status}`);error.status=response.status;throw error;}
  const data=await response.json();
  if(!data.routes?.length)throw new Error('tomtom-empty');
  return tomTomRouteToClassic(alternative&&data.routes[1]?data.routes[1]:data.routes[0]);
}

function tomTomRouteToClassic(source) {
  const points=[];
  for(const leg of source?.legs||[])for(const point of leg?.points||[]){const coordinate=[+point.longitude,+point.latitude],last=points[points.length-1];if(!last||last[0]!==coordinate[0]||last[1]!==coordinate[1])points.push(coordinate);}
  const instructions=source?.guidance?.instructions||[];
  const laneSections=(source?.sections||[]).filter(section=>String(section.sectionType).toUpperCase()==='LANES');
  const steps=instructions.map((instruction,index)=>{
    const start=Math.max(0,Math.min(points.length-1,Number(instruction.pointIndex)||0));
    const next=instructions[index+1];
    const end=Math.max(start+1,Math.min(points.length-1,Number(next?.pointIndex??points.length-1)));
    const maneuver=tomTomManeuver(instruction);
    const lanes=laneSections.filter(section=>section.startPointIndex<=end&&section.endPointIndex>=start).flatMap(section=>(section.lanes||[]).map(lane=>({indications:(lane.directions||[]).map(direction=>String(direction).toLowerCase().replace(/_/g,' ')),valid:Boolean(lane.follow)})));
    return {distance:Math.max(0,(next?.routeOffsetInMeters??source.summary?.lengthInMeters??0)-(instruction.routeOffsetInMeters||0)),duration:Math.max(0,(next?.travelTimeInSeconds??source.summary?.travelTimeInSeconds??0)-(instruction.travelTimeInSeconds||0)),name:instruction.street||'',ref:(instruction.roadNumbers||[]).join(';'),destinations:instruction.signpostText||'',maneuver:{...maneuver,location:[+instruction.point.longitude,+instruction.point.latitude]},geometry:{coordinates:points.slice(start,end+1)},intersections:lanes.length?[{lanes}]:[],tomtomMessage:instruction.message||''};
  });
  if(steps.length&&steps[0].geometry.coordinates.length<2)steps[0].geometry.coordinates=points.slice(0,2);
  return {distance:+source.summary?.lengthInMeters||0,duration:+source.summary?.travelTimeInSeconds||0,trafficDelay:+source.summary?.trafficDelayInSeconds||0,trafficLength:+source.summary?.trafficLengthInMeters||0,geometry:{coordinates:points},legs:[{steps}],provider:'tomtom',fetchedAt:Date.now(),trafficSections:(source.sections||[]).filter(section=>String(section.sectionType).toUpperCase()==='TRAFFIC')};
}

function tomTomManeuver(instruction={}) {
  const code=String(instruction.maneuver||instruction.instructionType||'STRAIGHT').toUpperCase();
  if(code.startsWith('ARRIVE'))return {type:'arrive',modifier:code.endsWith('LEFT')?'left':code.endsWith('RIGHT')?'right':''};
  if(code==='DEPART')return {type:'depart',modifier:'straight'};
  if(code.includes('UTURN'))return {type:'turn',modifier:'uturn'};
  if(code.includes('ROUNDABOUT'))return {type:'roundabout',modifier:code.includes('LEFT')?'left':code.includes('RIGHT')?'right':'straight',exit:instruction.roundaboutExitNumber||0};
  if(code.includes('EXIT'))return {type:'off ramp',modifier:code.includes('LEFT')?'left':'right'};
  if(code.startsWith('ENTER_'))return {type:'on ramp',modifier:'straight'};
  if(code.startsWith('KEEP_')||code.startsWith('BEAR_'))return {type:'fork',modifier:code.includes('LEFT')?'slight left':'slight right'};
  if(code.includes('LEFT'))return {type:'turn',modifier:code.includes('SHARP')?'sharp left':'left'};
  if(code.includes('RIGHT'))return {type:'turn',modifier:code.includes('SHARP')?'sharp right':'right'};
  return {type:'continue',modifier:'straight'};
}

function formatTrafficDelay(seconds=0){return seconds>=60?`${Math.round(seconds/60)} Min. Verzögerung`:'keine Verzögerung';}

function upcomingRouteSlice(maxMeters=60000){
  const all=routeCoordinates(),current=state.current;
  if(all.length<2||!hasPosition(current))return all;
  let nearest=0,best=Infinity;
  for(let i=0;i<all.length;i+=Math.max(1,Math.floor(all.length/1200))){const d=haversine(current.lat,current.lon,all[i][1],all[i][0]);if(d<best){best=d;nearest=i;}}
  const result=[all[nearest]];let travelled=0;
  for(let i=nearest+1;i<all.length&&travelled<maxMeters;i++){
    travelled+=haversine(all[i-1][1],all[i-1][0],all[i][1],all[i][0]);result.push(all[i]);
  }
  if(result.length<=700)return result;
  const stride=Math.ceil(result.length/700);return result.filter((_,index)=>index%stride===0||index===result.length-1);
}

function incidentGeometryPoints(geometry={}){
  const coordinates=geometry.coordinates||[];
  if(Number.isFinite(coordinates[0]))return [coordinates];
  if(Number.isFinite(coordinates[0]?.[0]))return coordinates;
  return coordinates.flat(2).reduce((points,value,index,array)=>index%2===0&&Number.isFinite(value)&&Number.isFinite(array[index+1])?[...points,[value,array[index+1]]]:points,[]);
}

function classicTrafficIncident(incident,routePoints,cumulative){
  let nearest=Infinity,routeIndex=0;
  for(const point of incidentGeometryPoints(incident.geometry))for(let i=0;i<routePoints.length;i++){
    const distance=haversine(point[1],point[0],routePoints[i][1],routePoints[i][0]);if(distance<nearest){nearest=distance;routeIndex=i;}
  }
  if(nearest>450)return null;
  const p=incident.properties||{},category=Number(p.iconCategory);
  const names={1:'Unfall',6:'Stau',7:'Fahrspur gesperrt',8:'Straße gesperrt',9:'Baustelle',14:'Pannenfahrzeug'};
  const road=(p.roadNumbers||[])[0]||p.from||'';
  return {id:p.id||`${category}-${routeIndex}-${road}`,category,label:[names[category]||'Verkehrsmeldung',road].filter(Boolean).join(' · '),description:p.events?.[0]?.description||'',delay:+p.delay||0,distanceAhead:Math.max(0,cumulative[routeIndex]||0),severity:+p.magnitudeOfDelay||0};
}

function applyTrafficIncidents(incidents,routePoints,cumulative){
  state.trafficIncidents=incidents.map(item=>classicTrafficIncident(item,routePoints,cumulative)).filter(Boolean).sort((a,b)=>a.distanceAhead-b.distanceAhead).slice(0,8);
  const important=state.trafficIncidents.find(item=>item.distanceAhead<=20000&&[1,7,8,9].includes(item.category)&&!state.announcedIncidentIds.includes(item.id));
  if(important){state.announcedIncidentIds.push(important.id);state.announcedIncidentIds=state.announcedIncidentIds.slice(-20);speak(`${important.label} in ${formatDistance(important.distanceAhead)}. Die aktuelle Verkehrslage wird bei der Route berücksichtigt.`);}
  if(state.screen==='drive')render();
}

function autobahnCategory(service,item){
  if(service==='roadworks')return 9;if(service==='closure')return 8;
  const text=(item.description||[]).join(' ').toLowerCase();
  if(text.includes('unfall'))return 1;if(text.includes('stau'))return 6;if(text.includes('gesperrt'))return 7;return 3;
}

async function refreshAutobahnIncidents(routePoints,cumulative){
  const roads=[];
  for(const step of state.route?.legs?.[0]?.steps||[]){
    for(const match of String(step.ref||step.name||'').matchAll(/\bA\s?(\d{1,3})\b/gi)){const road=`A${match[1]}`;if(!roads.includes(road))roads.push(road);}
    if(roads.length>=2)break;
  }
  if(!roads.length)return applyTrafficIncidents([],routePoints,cumulative);
  const requests=roads.flatMap(road=>['roadworks','closure','warning'].map(async service=>{
    const response=await fetch(`https://verkehr.autobahn.de/o/autobahn/${road}/services/${service}`);if(!response.ok)return[];
    const data=await response.json();return (data[service]||[]).filter(item=>item.future!==true).map(item=>({geometry:item.geometry||{type:'Point',coordinates:[item.coordinate?.long,item.coordinate?.lat]},properties:{id:`autobahn-${service}-${item.identifier}`,iconCategory:autobahnCategory(service,item),events:[{description:(item.description||[]).filter(Boolean).join(' ')}],from:item.title||'',to:item.subtitle||'',roadNumbers:[road]}}));
  }));
  try{applyTrafficIncidents((await Promise.all(requests)).flat(),routePoints,cumulative);}catch{}
}

async function refreshTrafficIncidents(force=false){
  const now=Date.now();
  if(!canUseTomTom()||!state.route||state.incidentCheckInProgress||(!force&&now-state.lastIncidentCheck<600000))return;
  const routePoints=upcomingRouteSlice();if(routePoints.length<2)return;
  state.lastIncidentCheck=now;state.incidentCheckInProgress=true;
  if(now<state.incidentBlockedUntil){const cumulative=[0];for(let i=1;i<routePoints.length;i++)cumulative[i]=cumulative[i-1]+haversine(routePoints[i-1][1],routePoints[i-1][0],routePoints[i][1],routePoints[i][0]);await refreshAutobahnIncidents(routePoints,cumulative);state.incidentCheckInProgress=false;return;}
  const lons=routePoints.map(point=>point[0]),lats=routePoints.map(point=>point[1]),padding=.018;
  const bbox=[Math.min(...lons)-padding,Math.min(...lats)-padding,Math.max(...lons)+padding,Math.max(...lats)+padding].join(',');
  const fields='{incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,events{description},from,to,length,delay,roadNumbers}}}';
  const params=new URLSearchParams({key:TOMTOM_API_KEY,bbox,fields,language:'de-DE',categoryFilter:'1,6,7,8,9,14',timeValidityFilter:'present'});
  try{
    const response=await fetch(`https://api.tomtom.com/traffic/services/5/incidentDetails?${params}`);
    if(!response.ok){const error=new Error(`tomtom-incidents-${response.status}`);error.status=response.status;throw error;}
    const data=await response.json(),cumulative=[0];
    for(let i=1;i<routePoints.length;i++)cumulative[i]=cumulative[i-1]+haversine(routePoints[i-1][1],routePoints[i-1][0],routePoints[i][1],routePoints[i][0]);
    applyTrafficIncidents(data.incidents||[],routePoints,cumulative);
  }catch(error){
    if(error?.status===429){const next=new Date();next.setMonth(next.getMonth()+1,1);next.setHours(0,0,0,0);state.incidentBlockedUntil=+next;save();const cumulative=[0];for(let i=1;i<routePoints.length;i++)cumulative[i]=cumulative[i-1]+haversine(routePoints[i-1][1],routePoints[i-1][0],routePoints[i][1],routePoints[i][0]);await refreshAutobahnIncidents(routePoints,cumulative);}
    else if(error?.status===401||error?.status===403){
      const cumulative=[0];for(let i=1;i<routePoints.length;i++)cumulative[i]=cumulative[i-1]+haversine(routePoints[i-1][1],routePoints[i-1][0],routePoints[i][1],routePoints[i][0]);
      await refreshAutobahnIncidents(routePoints,cumulative);
    }
  }
  finally{state.incidentCheckInProgress=false;}
}

function handleTomTomError(error){
  const status=error?.status||0;
  if(status===429){const next=new Date();next.setMonth(next.getMonth()+1,1);next.setHours(0,0,0,0);state.trafficBlockedUntil=+next;state.trafficStatus='TomTom-Freikontingent erreicht · OSRM-Notbetrieb';}
  else if(status===401||status===403)state.trafficStatus='TomTom-Schlüssel ungültig · OSRM-Notbetrieb';
  else state.trafficStatus='TomTom nicht erreichbar · OSRM-Notbetrieb';
  save();
}

function resetRouteProgress(navigationMode='overview'){
  if(state.junctionTimer){clearTimeout(state.junctionTimer);state.junctionTimer=0;}
  state.lastInstructionIndex=-1; state.announcedLevels=[]; state.routeStepIndex=0; state.routeProgressReady=false; state.instructionStepIndex=0; state.junctionStepKey=-1; state.junctionShownAt=0; state.offRouteFixes=0; state.navigationMode=navigationMode;state.arrived=false;state.loading=false; state.notice=''; save();
}

function clearRoute(targetScreen='drive',announce=true) { state.trafficRouteToken++;state.route=null; state.destination=null;state.navigationMode='overview';state.arrived=false; state.trafficIncidents=[];state.announcedIncidentIds=[];state.lastInstructionIndex=-1; state.announcedLevels=[]; state.routeStepIndex=0; state.routeProgressReady=false; state.junctionStepKey=-1; state.offRouteFixes=0; if(state.junctionTimer){clearTimeout(state.junctionTimer);state.junctionTimer=0;} if(window.AndroidNavi?.keepScreenOn)window.AndroidNavi.keepScreenOn(false); if(announce)speak('Route gelöscht.'); go(targetScreen); }
function beginSetHome() { resetAddress(); state.addressMode='streetNumber'; state.wizardStep='city'; localStorage.setItem('setting-home','true'); go('wizard'); }

function initBaseMap(elementId, interactive=true,driveMode=false) {
  const map=L.map(elementId,{preferCanvas:true,zoomControl:false,attributionControl:!driveMode,dragging:interactive,doubleClickZoom:interactive,scrollWheelZoom:interactive,touchZoom:interactive,keyboard:false,zoomAnimation:false,fadeAnimation:false,markerZoomAnimation:false,zoomSnap:.25,zoomDelta:.25,rotate:driveMode,bearing:0,touchRotate:false,rotateControl:false,shiftKeyRotate:false});
  const tileOptions=driveMode
    ?{maxNativeZoom:19,maxZoom:19,keepBuffer:1,updateWhenIdle:false,updateInterval:500,updateWhenZooming:false,detectRetina:false,attribution:'© OpenStreetMap'}
    :{maxNativeZoom:15,maxZoom:17,keepBuffer:0,updateWhenIdle:true,updateWhenZooming:false,detectRetina:false,attribution:'© OpenStreetMap'};
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',tileOptions).addTo(map);
  return map;
}

function drawRoute(map,driver=false) {
  if(!state.route) return null;
  const coords=routeCoordinates().map(([lon,lat])=>[lat,lon]);
  const renderer=L.canvas({padding:.35});
  if(!driver){
    const outline=L.polyline(coords,{renderer,color:'#f4f8f8',weight:14,opacity:.96,lineJoin:'round'}).addTo(map);
    const route=L.polyline(coords,{renderer,color:'#008fd0',weight:9,opacity:1,lineJoin:'round'}).addTo(map);
    return L.layerGroup([outline,route]);
  }
  const outline=L.polyline(coords,{renderer,color:'#111d59',weight:29,opacity:.82,lineCap:'round',lineJoin:'round'}).addTo(map);
  const route=L.polyline(coords,{renderer,color:'#173fd1',weight:21,opacity:1,lineCap:'round',lineJoin:'round'}).addTo(map);
  const highlight=L.polyline(coords,{renderer,color:'#5794ff',weight:9,opacity:.9,lineCap:'round',lineJoin:'round'}).addTo(map);
  return L.layerGroup([outline,route,highlight]);
}

function routeCoordinates(route=state.route) {
  const exact=[];
  for(const step of route?.legs?.[0]?.steps||[]) {
    for(const coordinate of step?.geometry?.coordinates||[]) {
      const previous=exact[exact.length-1];
      if(!previous||previous[0]!==coordinate[0]||previous[1]!==coordinate[1]) exact.push(coordinate);
    }
  }
  return exact.length>1?exact:(route?.geometry?.coordinates||[]);
}

function initDriveMap() {
  const driver=isDriverMode();
  if(driver&&!state.driverMapFallback&&globalThis.maplibregl?.Map){
    initDriverMapLibre();
    return;
  }
  initLeafletDriveMap(driver);
}

function initLeafletDriveMap(driver=isDriverMode()) {
  state.map=initBaseMap('map',!driver,driver);
  state.routeLine=drawRoute(state.map,driver);
  if(!hasPosition()) { state.map.setView([51.1657,10.4515],6); return; }
  const pos=[state.current.lat,state.current.lon];
  const guide=driverVehicleHeading(state.current,state.current.heading);
  const custom=L.divIcon({className:'',html:`<div class="position-marker-shell"><div class="position-marker" style="transform:rotate(${state.current.heading||guide}deg)"></div></div>`,iconSize:[30,40],iconAnchor:[15,32]});
  state.userMarker=L.marker(pos,{icon:custom,opacity:driver?0:1,interactive:false}).addTo(state.map);
  if(state.destination){
    const flag=L.divIcon({className:'',html:'<div class="destination-flag"><span class="destination-flag-cloth"></span><span class="destination-flag-pole"></span></div>',iconSize:[38,48],iconAnchor:[8,46]});
    state.destinationMarker=L.marker([state.destination.lat,state.destination.lon],{icon:flag,interactive:false,zIndexOffset:700}).addTo(state.map);
  }
  if(!driver){
    state.cameraBearing=null;
    if(state.route)state.map.fitBounds(L.latLngBounds(routeCoordinates().map(([lon,lat])=>[lat,lon])),{padding:[20,20]});
    else state.map.setView(pos,14);
    return;
  }
  const zoom=navigationZoom();
  state.map.setView(navigationCameraCenter(state.current,guide,zoom,state.map),zoom);
  applyDriveOrientation(guide,true);
  positionDriverMarker();
}

const DRIVER_STYLE='https://tiles.openfreemap.org/styles/liberty';
const DRIVER_PITCH=55;
const DRIVER_ANCHOR_Y=.74;
const DRIVER_BASE_ZOOM=17.35;

function driverZoom(speed=state.current.speed){
  const kmh=Math.max(0,Number(speed)||0)*3.6;
  return DRIVER_BASE_ZOOM-(Math.min(110,kmh)/110)*.28+state.driverZoomOffset;
}

function driverPadding(map=state.driverMap){
  const height=map?.getContainer?.().clientHeight||document.querySelector('#map')?.clientHeight||259;
  return {top:Math.max(0,Math.round(height*(DRIVER_ANCHOR_Y*2-1))),right:0,bottom:0,left:0};
}

function quietDriverStyle(map){
  for(const layer of map.getStyle()?.layers||[]){
    const id=String(layer.id||'').toLowerCase();
    if(layer.type==='fill-extrusion'||(layer.type==='symbol'&&/(^|[-_])(poi|housenumber|house-number|amenity|transit|airport)([-_]|$)/.test(id))){
      try{map.setLayoutProperty(layer.id,'visibility','none');}catch{}
    }
    if(layer.type==='line'&&layer['source-layer']==='transportation'&&/^(road|bridge|tunnel)[-_]/.test(id)&&!/(path|rail|ferry|aerialway)/.test(id)){
      const casing=/casing/.test(id);
      const major=/(motorway|trunk|primary)/.test(id);
      const minor=/(street|minor|service)/.test(id);
      const widths=major
        ?(casing?[14,10,16,16,18,27,20,37]:[14,6,16,11,18,19,20,27])
        :(minor?(casing?[14,6,16,11,18,18,20,27]:[14,4,16,8,18,14,20,20])
          :(casing?[14,8,16,14,18,22,20,32]:[14,5,16,10,18,16,20,23]));
      try{map.setPaintProperty(layer.id,'line-width',['interpolate',['linear'],['zoom'],...widths]);}catch{}
      try{map.setPaintProperty(layer.id,'line-color',casing?'#9faab8':'#fbfcf7');}catch{}
      try{map.setPaintProperty(layer.id,'line-opacity',casing?.96:1);}catch{}
    }
    if(layer.type==='symbol'&&layer['source-layer']==='transportation_name'&&/highway-name-(path|minor|major)/.test(id)){
      // Jede Eigenschaft separat setzen: Ein auf einem Tile-Server fehlender Bold-Font
      // darf nicht mehr verhindern, dass Größe, Abstand und Halo angewendet werden.
      try{map.setLayoutProperty(layer.id,'text-size',['interpolate',['linear'],['zoom'],13,19,15,23,17,27,19,31]);}catch{}
      try{map.setLayoutProperty(layer.id,'symbol-spacing',650);}catch{}
      // Google-Maps-artig: Der Name folgt dem Winkel der Straße, liegt aber flach
      // auf der Bildschirmfläche und wird niemals kopfüber oder stark verbogen.
      try{map.setLayoutProperty(layer.id,'text-pitch-alignment','viewport');}catch{}
      try{map.setLayoutProperty(layer.id,'text-rotation-alignment','map');}catch{}
      try{map.setLayoutProperty(layer.id,'text-keep-upright',true);}catch{}
      try{map.setLayoutProperty(layer.id,'text-max-angle',25);}catch{}
      try{map.setLayoutProperty(layer.id,'text-letter-spacing',.01);}catch{}
      try{map.setPaintProperty(layer.id,'text-color','#111a1f');}catch{}
      try{map.setPaintProperty(layer.id,'text-halo-color','#fbfcf5');}catch{}
      try{map.setPaintProperty(layer.id,'text-halo-width',2.6);}catch{}
      try{map.setPaintProperty(layer.id,'text-halo-blur',.15);}catch{}
      try{map.setLayoutProperty(layer.id,'text-font',['Noto Sans Bold']);}catch{}
    }
  }
}

function addDriverRoute(map){
  if(!state.route||map.getSource('active-route'))return;
  const data={type:'Feature',properties:{},geometry:{type:'LineString',coordinates:routeCoordinates()}};
  map.addSource('active-route',{type:'geojson',data,lineMetrics:true});
  const firstLabel=(map.getStyle()?.layers||[]).find(layer=>layer.type==='symbol')?.id;
  const widths={
    outline:['interpolate',['linear'],['zoom'],14,12,17,20,19,27],
    main:['interpolate',['linear'],['zoom'],14,8,17,14,19,19],
    highlight:['interpolate',['linear'],['zoom'],14,2,17,3.5,19,5]
  };
  const layers=[
    {id:'active-route-outline',type:'line',source:'active-route',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#101c5c','line-opacity':.88,'line-width':widths.outline}},
    {id:'active-route-main',type:'line',source:'active-route',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#1947d8','line-opacity':1,'line-width':widths.main}},
    {id:'active-route-highlight',type:'line',source:'active-route',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#66a4ff','line-opacity':.72,'line-width':widths.highlight}}
  ];
  for(const layer of layers)map.addLayer(layer,firstLabel);
  map.addSource('maneuver-surface-arrow',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
  map.addLayer({id:'maneuver-surface-line',type:'line',source:'maneuver-surface-arrow',filter:['==',['get','kind'],'path'],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#f5c51b','line-opacity':1,'line-width':['interpolate',['linear'],['zoom'],15,8,18,14,20,17]}},firstLabel);
  map.addLayer({id:'maneuver-surface-arrowhead',type:'fill',source:'maneuver-surface-arrow',filter:['==',['get','kind'],'arrow'],paint:{'fill-color':'#f5c51b','fill-opacity':1,'fill-outline-color':'#795500'}},firstLabel);
  updateManeuverSurfaceArrow(map);
}

function routePartByDistance(coords=[],maxMeters=65,fromEnd=false){
  if(coords.length<2)return coords.slice();
  const source=fromEnd?[...coords].reverse():coords;
  const result=[source[0]];let distance=0;
  for(let index=1;index<source.length;index++){
    const previous=source[index-1],point=source[index];
    const segment=haversine(previous[1],previous[0],point[1],point[0]);
    if(distance+segment>maxMeters&&segment>0){
      const ratio=(maxMeters-distance)/segment;
      result.push([previous[0]+(point[0]-previous[0])*ratio,previous[1]+(point[1]-previous[1])*ratio]);
      break;
    }
    distance+=segment;result.push(point);
    if(distance>=maxMeters)break;
  }
  return fromEnd?result.reverse():result;
}

function pointAlongRoute(coords=[],wantedMeters=0){
  let travelled=0;
  for(let index=1;index<coords.length;index++){
    const from=coords[index-1],to=coords[index];
    const length=haversine(from[1],from[0],to[1],to[0]);
    if(travelled+length>=wantedMeters&&length>0){
      const ratio=(wantedMeters-travelled)/length;
      return {point:[from[0]+(to[0]-from[0])*ratio,from[1]+(to[1]-from[1])*ratio],bearing:bearingBetween(from[1],from[0],to[1],to[0])};
    }
    travelled+=length;
  }
  const last=coords.at(-1),before=coords.at(-2);
  return last&&before?{point:last,bearing:bearingBetween(before[1],before[0],last[1],last[0])}:null;
}

function offsetMapPoint(point,bearing,meters){
  const radians=bearing*Math.PI/180,latRadians=point[1]*Math.PI/180;
  return [point[0]+Math.sin(radians)*meters/(111320*Math.max(.2,Math.cos(latRadians))),point[1]+Math.cos(radians)*meters/110540];
}

function maneuverArrowPolygon(outgoing=[]){
  if(outgoing.length<2)return null;
  let total=0;
  for(let index=1;index<outgoing.length;index++)total+=haversine(outgoing[index-1][1],outgoing[index-1][0],outgoing[index][1],outgoing[index][0]);
  // Die Pfeilspitze sitzt exakt auf dem Ende der gelben Linie. Dadurch bleibt
  // nach der Spitze garantiert kein gelber Rest auf der Zielstraße sichtbar.
  const placement=pointAlongRoute(outgoing,total);
  if(!placement)return null;
  const {point,bearing}=placement,back=(distance)=>offsetMapPoint(point,bearing+180,distance);
  const shoulder=back(9),base=back(23);
  const ring=[
    point,
    offsetMapPoint(shoulder,bearing-90,8),
    offsetMapPoint(shoulder,bearing-90,3.2),
    offsetMapPoint(base,bearing-90,3.2),
    offsetMapPoint(base,bearing+90,3.2),
    offsetMapPoint(shoulder,bearing+90,3.2),
    offsetMapPoint(shoulder,bearing+90,8),
    point
  ];
  return {type:'Polygon',coordinates:[ring]};
}

function maneuverSurfaceArrowData(){
  const empty={type:'FeatureCollection',features:[]};
  const steps=state.route?.legs?.[0]?.steps||[],index=state.instructionStepIndex;
  const step=steps[index],type=(step?.maneuver?.type||'').toLowerCase(),modifier=(step?.maneuver?.modifier||'').toLowerCase();
  const turns=modifier.includes('left')||modifier.includes('right')||modifier.includes('uturn')||type.includes('ramp')||type==='fork'||type==='roundabout'||type==='rotary';
  if(!step||!turns||!hasPosition()||distanceToStep(step)>190)return empty;
  const incoming=routePartByDistance(steps[Math.max(0,index-1)]?.geometry?.coordinates||[],30,true);
  const outgoing=routePartByDistance(step.geometry?.coordinates||[],30,false);
  const coordinates=[...incoming,...outgoing].filter((point,pointIndex,all)=>pointIndex===0||point[0]!==all[pointIndex-1][0]||point[1]!==all[pointIndex-1][1]);
  if(coordinates.length<2)return empty;
  const features=[{type:'Feature',properties:{kind:'path'},geometry:{type:'LineString',coordinates}}];
  const arrow=maneuverArrowPolygon(outgoing);
  if(arrow)features.push({type:'Feature',properties:{kind:'arrow'},geometry:arrow});
  return {type:'FeatureCollection',features};
}

function updateManeuverSurfaceArrow(map=state.driverMap){
  map?.getSource?.('maneuver-surface-arrow')?.setData(maneuverSurfaceArrowData());
}

function normalizedCourse(value){return ((Number(value)||0)%360+360)%360;}
function smoothedDriverCourse(heading,immediate=false){
  const target=normalizedCourse(heading);
  if(immediate||!Number.isFinite(state.driverCourse)){state.driverCourse=target;return target;}
  const diff=((target-state.driverCourse+540)%360)-180;
  if(Math.abs(diff)<1.1)return state.driverCourse;
  state.driverCourse=normalizedCourse(state.driverCourse+diff*.42);
  return state.driverCourse;
}

function updateDriverCamera(position=state.current,heading=0,immediate=false){
  const map=state.driverMap;
  if(!map||!hasPosition(position))return;
  const camera={center:[position.lon,position.lat],bearing:smoothedDriverCourse(heading,immediate),pitch:DRIVER_PITCH,zoom:driverZoom(),padding:driverPadding(map)};
  state.cameraBearing=camera.bearing;
  if(immediate||!state.driverMapReady)map.jumpTo(camera);
  else map.easeTo({...camera,duration:680,easing:t=>t*t*(3-2*t),essential:true,noMoveStart:true});
  positionDriverMarker();
}

function fallBackToLeafletDriver(){
  if(!isDriverMode()||state.driverMapFallback)return;
  state.driverMapFallback=true;
  if(state.driverMap){state.driverMap.remove();state.driverMap=null;}
  state.driverMapReady=false;
  initLeafletDriveMap(true);
}

function initDriverMapLibre(){
  const element=document.querySelector('#map');
  if(!element||!hasPosition()){state.driverMapFallback=true;initLeafletDriveMap(true);return;}
  const guide=driverVehicleHeading(state.current,state.current.heading);
  state.driverCourse=normalizedCourse(guide);
  try{
    const map=new maplibregl.Map({container:element,style:DRIVER_STYLE,center:[state.current.lon,state.current.lat],zoom:driverZoom(),bearing:state.driverCourse,pitch:DRIVER_PITCH,interactive:false,attributionControl:false,antialias:false,fadeDuration:140,maxTileCacheZoomLevels:1,refreshExpiredTiles:false});
    state.driverMap=map;
    let loaded=false;
    const timeout=setTimeout(()=>{if(!loaded&&state.driverMap===map)fallBackToLeafletDriver();},12000);
    map.once('load',()=>{
      loaded=true;clearTimeout(timeout);
      if(state.driverMap!==map||!isDriverMode())return;
      state.driverMapReady=true;
      quietDriverStyle(map);
      addDriverRoute(map);
      if(state.destination){
        const flag=document.createElement('div');flag.className='destination-flag';
        flag.innerHTML='<span class="destination-flag-cloth"></span><span class="destination-flag-pole"></span>';
        state.destinationMarker=new maplibregl.Marker({element:flag,anchor:'bottom-left'}).setLngLat([state.destination.lon,state.destination.lat]).addTo(map);
      }
      updateDriverCamera(state.current,guide,true);
    });
    map.once('webglcontextlost',()=>fallBackToLeafletDriver());
    positionDriverMarker();
  }catch{fallBackToLeafletDriver();}
}

function initSummaryMap() {
  state.summaryMap=initBaseMap('summary-map',false); drawRoute(state.summaryMap);
  if(state.route) state.summaryMap.fitBounds(L.latLngBounds(routeCoordinates().map(([lon,lat])=>[lat,lon])),{padding:[15,15]});
}

function initPreviewMap() {
  if (!state.destination) return;
  state.previewMap=initBaseMap('preview-map',false);
  state.previewMap.setView([state.destination.lat,state.destination.lon],16);
  L.marker([state.destination.lat,state.destination.lon]).addTo(state.previewMap);
}

function initBrowseMap() {
  state.map=initBaseMap('map',true); drawRoute(state.map); state.map.setView(hasPosition()?[state.current.lat,state.current.lon]:[51.1657,10.4515],hasPosition()?14:6);
  state.map.on('contextmenu',async e=>{ await planTo({lat:e.latlng.lat,lon:e.latlng.lng,display_name:'Ausgewählter Punkt auf der Karte'}); });
}
function centerMap(){
  if(!hasPosition())return notify('Noch kein gültiges GPS-Signal.');
  if(!isDriverMode()){state.map?.setView([state.current.lat,state.current.lon],state.map?.getZoom()||14);return;}
  const guide=driverVehicleHeading(state.current,state.current.heading),zoom=navigationZoom();
  if(state.driverMap){updateDriverCamera(state.current,guide);return;}
  state.map?.setView(navigationCameraCenter(state.current,guide,zoom,state.map),zoom);
  applyDriveOrientation(guide);
}

function currentStep() {
  const steps=state.route?.legs?.[0]?.steps || [];
  if(!steps.length) return null;
  let best=state.routeStepIndex,bestDistance=Infinity;
  const from=state.routeProgressReady?Math.max(0,state.routeStepIndex-1):0;
  const to=state.routeProgressReady?Math.min(steps.length-1,state.routeStepIndex+8):steps.length-1;
  for(let i=from;i<=to;i++){
    const d=distanceToStepGeometry(steps[i]);
    if(d<bestDistance){bestDistance=d;best=i;}
  }
  state.routeProgressReady=true;
  state.routeStepIndex=Math.max(state.routeStepIndex,best);
  const next=Math.min(state.routeStepIndex+1,steps.length-1);
  state.instructionStepIndex=next;
  const maneuverDistance=distanceToStep(steps[next]);
  if(next!==state.lastInstructionIndex){
    state.lastInstructionIndex=next;
    state.announcedLevels=[];
  }
  announceInstruction(steps[next],maneuverDistance);
  return steps[next];
}

function announceInstruction(step,distance){
  if((!state.hasMoved&&!state.demoMode)||!step)return;
  let level='',prefix='';
  const speed=Math.max(0,state.current.speed||0);
  const nowDistance=Math.max(45,Math.min(110,speed*3.5));
  if(distance<=nowDistance){level='jetzt';prefix='Jetzt. ';}
  else if(distance<=300){level='300';prefix='In dreihundert Metern. ';}
  else if(distance<=650){level='500';prefix='In fünfhundert Metern. ';}
  else if(distance<=1200){level='1000';prefix='In einem Kilometer. ';}
  else if(speed>22&&distance<=2200){level='2000';prefix='In zwei Kilometern. ';}
  if(!level||state.announcedLevels.includes(level))return;
  state.announcedLevels.push(level);
  const type=(step.maneuver?.type||'').toLowerCase();
  if(type==='arrive')speak(`${level==='jetzt'?'':prefix}${arrivalText(step,level==='jetzt')}`);
  else speak(prefix+instructionText(step));
}

function distanceToStepGeometry(step){
  const coords=step?.geometry?.coordinates;
  if(!Array.isArray(coords)||coords.length<2)return distanceToStep(step);
  let nearest=Infinity;
  for(let i=1;i<coords.length;i++){
    nearest=Math.min(nearest,pointSegmentDistance(state.current.lat,state.current.lon,coords[i-1][1],coords[i-1][0],coords[i][1],coords[i][0]));
  }
  return nearest;
}

function pointSegmentDistance(lat,lon,aLat,aLon,bLat,bLon){
  const xScale=111320*Math.cos(lat*Math.PI/180),yScale=110540;
  const ax=(aLon-lon)*xScale,ay=(aLat-lat)*yScale,bx=(bLon-lon)*xScale,by=(bLat-lat)*yScale;
  const dx=bx-ax,dy=by-ay,length=dx*dx+dy*dy;
  const t=length?Math.max(0,Math.min(1,-((ax*dx)+(ay*dy))/length)):0;
  return Math.hypot(ax+t*dx,ay+t*dy);
}
function distanceToStep(step){const [lon,lat]=step.maneuver.location;return haversine(state.current.lat,state.current.lon,lat,lon);}
function haversine(a,b,c,d){const R=6371000,p=Math.PI/180,x=(c-a)*p,y=(d-b)*p;const q=Math.sin(x/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin(y/2)**2;return 2*R*Math.asin(Math.sqrt(q));}
function maneuverArrow(step){if(!step)return '↑';const m=step.maneuver;const mod=m.modifier||'';if(mod.includes('left'))return '↰';if(mod.includes('right'))return '↱';if(m.type==='roundabout'||m.type==='rotary')return '⟳';if(m.type==='arrive')return '⚑';if(mod==='uturn')return '↶';return '↑';}
function spokenRoad(value=''){
  return String(value).split(';')[0].trim()
    .replace(/\bA\s*([0-9]+)/gi,'Autobahn $1')
    .replace(/\bB\s*([0-9]+)/gi,'Bundesstraße $1')
    .replace(/\bL\s*([0-9]+)/gi,'Landesstraße $1');
}
function turnDirection(modifier=''){
  if(modifier.includes('sharp left'))return 'scharf links';
  if(modifier.includes('slight left'))return 'leicht links';
  if(modifier.includes('left'))return 'links';
  if(modifier.includes('sharp right'))return 'scharf rechts';
  if(modifier.includes('slight right'))return 'leicht rechts';
  if(modifier.includes('right'))return 'rechts';
  return 'geradeaus';
}
function ordinalExit(number){
  return ['','erste','zweite','dritte','vierte','fünfte','sechste','siebte','achte','neunte','zehnte'][number]||`${number}.`;
}
function arrivalText(step,reached=false){
  const modifier=(step?.maneuver?.modifier||'').toLowerCase();
  const side=modifier.includes('left')?' Es befindet sich auf der linken Seite.':modifier.includes('right')?' Es befindet sich auf der rechten Seite.':'';
  return `${reached?'Sie haben Ihr Ziel erreicht.':'Sie erreichen Ihr Ziel.'}${side}`;
}
function instructionText(step){
  if(!step)return 'Folgen Sie der Straße.';
  const maneuver=step.maneuver||{},type=(maneuver.type||'').toLowerCase(),modifier=(maneuver.modifier||'').toLowerCase();
  const road=spokenRoad(step.name||step.ref||'');
  const destination=spokenRoad(step.destinations||'');
  const roadPhrase=road?` auf ${road}`:'';
  const targetPhrase=destination?` in Richtung ${destination}`:'';
  const direction=turnDirection(modifier);
  if(type==='arrive')return arrivalText(step,true);
  if(type==='depart')return road?`Fahren Sie los auf ${road}.`:'Fahren Sie los.';
  if(type==='roundabout'||type==='rotary'||type==='exit roundabout'||type==='exit rotary'){
    const exit=maneuver.exit?` die ${ordinalExit(maneuver.exit)} Ausfahrt`:' die passende Ausfahrt';
    return `Fahren Sie in den Kreisverkehr und nehmen Sie${exit}${roadPhrase}${targetPhrase}.`;
  }
  if(type.includes('off ramp'))return `Nehmen Sie ${direction} die Ausfahrt${roadPhrase}${targetPhrase}.`;
  if(type.includes('on ramp'))return `Fahren Sie ${direction}${roadPhrase||' auf die Autobahn'}${targetPhrase}.`;
  if(type==='fork')return `Halten Sie sich ${direction}${roadPhrase}${targetPhrase}.`;
  if(type==='merge')return `Fädeln Sie sich ${direction}${roadPhrase} ein.`;
  if(type==='end of road')return `Am Ende der Straße ${direction} abbiegen${roadPhrase}.`;
  if(type==='notification')return road?`Folgen Sie weiter ${road}.`:'Folgen Sie dem Straßenverlauf.';
  if(modifier==='uturn'||type==='turn'&&modifier.includes('uturn'))return 'Bitte wenden Sie, wenn möglich.';
  if(type==='turn')return `${direction[0].toUpperCase()+direction.slice(1)} abbiegen${roadPhrase}.`;
  if(type==='continue'||type==='new name')return road?`Folgen Sie dem Straßenverlauf auf ${road}.`:'Folgen Sie dem Straßenverlauf.';
  return road?`Fahren Sie weiter auf ${road}.`:'Fahren Sie geradeaus weiter.';
}
function speak(text,force=false){
  state.lastSpoken=text;
  if(!state.voice&&!force)return;
  if(window.AndroidNavi&&typeof window.AndroidNavi.speak==='function'){
    window.AndroidNavi.speak(text);
    return;
  }
  if(!window.speechSynthesis||typeof window.SpeechSynthesisUtterance!=='function')return;
  window.speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text);u.lang='de-DE';u.rate=.9;u.pitch=.95;
  window.speechSynthesis.speak(u);
}

function hasPosition(position=state.current){
  return Number.isFinite(position?.lat)&&Number.isFinite(position?.lon);
}

function bearingBetween(aLat,aLon,bLat,bLon){
  const p=Math.PI/180,y=Math.sin((bLon-aLon)*p)*Math.cos(bLat*p);
  const x=Math.cos(aLat*p)*Math.sin(bLat*p)-Math.sin(aLat*p)*Math.cos(bLat*p)*Math.cos((bLon-aLon)*p);
  return (Math.atan2(y,x)*180/Math.PI+360)%360;
}

function smoothHeading(previous,next,amount=.55){
  if(!Number.isFinite(next))return Number.isFinite(previous)?previous:0;
  if(!Number.isFinite(previous))return (next+360)%360;
  const difference=((next-previous+540)%360)-180;
  return (previous+difference*amount+360)%360;
}

function navigationCenter(position=state.current,heading=0,meters=115){
  if(!hasPosition(position))return [51.1657,10.4515];
  const angle=(Number.isFinite(heading)?heading:0)*Math.PI/180;
  const lat=position.lat+(Math.cos(angle)*meters)/111320;
  const lon=position.lon+(Math.sin(angle)*meters)/(111320*Math.max(.2,Math.cos(position.lat*Math.PI/180)));
  return [lat,lon];
}

const NAVIGATION_ZOOM=17.75;
const NAVIGATION_ANCHOR_Y=.75;

function navigationZoom(){ return NAVIGATION_ZOOM; }

function navigationAnchorOffsetMeters(position=state.current,zoom=NAVIGATION_ZOOM,map=state.map){
  const height=map?.getSize?.().y||globalThis.innerHeight||360;
  const pixelsAhead=Math.max(0,(NAVIGATION_ANCHOR_Y-.5)*height);
  const metersPerPixel=156543.03392*Math.max(.2,Math.cos((position.lat||0)*Math.PI/180))/(2**zoom);
  return Math.max(5,pixelsAhead*metersPerPixel);
}

function navigationCameraCenter(position=state.current,heading=0,zoom=NAVIGATION_ZOOM,map=state.map){
  return navigationCenter(position,heading,navigationAnchorOffsetMeters(position,zoom,map));
}

function positionDriverMarker(){
  const marker=document.querySelector('.fixed-position-marker');
  const height=state.driverMap?.getContainer?.().clientHeight||state.map?.getSize?.().y;
  const anchor=state.driverMap?DRIVER_ANCHOR_Y:NAVIGATION_ANCHOR_Y;
  if(marker&&height)marker.style.top=`${height*anchor}px`;
}

function routeGuidanceHeading(position=state.current,fallback=0){
  const coords=routeCoordinates();
  if(!hasPosition(position)||coords.length<2)return Number.isFinite(fallback)?fallback:0;
  let segment=0,best=Infinity;
  for(let index=1;index<coords.length;index++){
    const distance=pointSegmentDistance(position.lat,position.lon,coords[index-1][1],coords[index-1][0],coords[index][1],coords[index][0]);
    if(distance<best){best=distance;segment=index-1;}
  }
  const from=coords[segment],to=coords[Math.min(coords.length-1,segment+1)];
  return from&&to?bearingBetween(from[1],from[0],to[1],to[0]):fallback;
}

function driverVehicleHeading(position=state.current,fallback=0){
  const speed=Math.max(0,Number(state.current.speed)||0),measured=Number(state.current.heading);
  if(speed>=1.2&&Number.isFinite(measured))return normalizedCourse(measured);
  if(Number.isFinite(state.driverCourse))return normalizedCourse(state.driverCourse);
  return routeGuidanceHeading(position,fallback);
}

function leafletBearingForCourse(heading){ return (360-((heading%360)+360)%360)%360; }

function applyDriveOrientation(heading,immediate=false){
  const map=state.map;
  if(!map?.setBearing||!Number.isFinite(heading))return;
  // Leaflet Rotate dreht die Kartenebene entgegengesetzt zum GPS-Kurs.
  const target=leafletBearingForCourse(heading);
  if(state.bearingAnimation)cancelAnimationFrame(state.bearingAnimation);
  const from=Number.isFinite(state.cameraBearing)?state.cameraBearing:target;
  const difference=((target-from+540)%360)-180;
  if(immediate){
    state.cameraBearing=target;map.setBearing(target);state.bearingAnimation=0;return;
  }
  // Kleine GPS-/Course-Schwankungen nicht sichtbar als hektisches Kartenwackeln weitergeben.
  if(Math.abs(difference)<1.25){state.bearingAnimation=0;return;}
  const started=performance.now(),duration=520;
  const frame=now=>{
    if(state.map!==map)return;
    const t=Math.min(1,(now-started)/duration),eased=t*t*(3-2*t);
    state.cameraBearing=(from+difference*eased+360)%360;
    map.setBearing(state.cameraBearing);
    if(t<1)state.bearingAnimation=requestAnimationFrame(frame);else state.bearingAnimation=0;
  };
  state.bearingAnimation=requestAnimationFrame(frame);
}

function acceptGpsPosition(pos){
  const now=Date.now();
  const accuracy=Number.isFinite(pos?.coords?.accuracy)?pos.coords.accuracy:100;
  if(!Number.isFinite(pos?.coords?.latitude)||!Number.isFinite(pos?.coords?.longitude)||accuracy>300)return false;
  let derivedSpeed=0,moved=0,derivedHeading=state.current.heading||0;
  if(state.lastFix){
    moved=haversine(state.lastFix.lat,state.lastFix.lon,pos.coords.latitude,pos.coords.longitude);
    const seconds=Math.max(1,(now-state.lastFix.time)/1000);
    derivedSpeed=moved/seconds;
    if(moved>3)derivedHeading=bearingBetween(state.lastFix.lat,state.lastFix.lon,pos.coords.latitude,pos.coords.longitude);
    if(seconds<5&&moved>Math.max(500,accuracy*8))return false;
  }
  const previous=hasPosition()?state.current:null;
  state.lastFix={lat:pos.coords.latitude,lon:pos.coords.longitude,time:now};
  const hasReportedSpeed=Number.isFinite(pos.coords.speed);
  const gpsSpeed=hasReportedSpeed?Math.max(0,pos.coords.speed):derivedSpeed;
  const displacement=previous?haversine(previous.lat,previous.lon,pos.coords.latitude,pos.coords.longitude):0;
  const movementThreshold=Math.max(5,Math.min(18,accuracy*.8));
  const movementEvidence=hasReportedSpeed
    ?gpsSpeed>=1.1&&displacement>=2
    :derivedSpeed>=2&&displacement>=movementThreshold;
  state.motionFixes=movementEvidence?Math.min(4,state.motionFixes+1):0;
  const moving=!previous||state.motionFixes>=(hasReportedSpeed?2:3);
  const alpha=!previous?1:(gpsSpeed>3?.78:accuracy<25?.55:.35);
  // Im Stillstand bleibt die dargestellte Position exakt verriegelt. Rohmessungen
  // werden weiterhin in lastFix erfasst, bewegen aber weder Pfeil noch Kamera.
  const target=!previous
    ?{lat:pos.coords.latitude,lon:pos.coords.longitude}
    :moving
      ?{lat:previous.lat+(pos.coords.latitude-previous.lat)*alpha,lon:previous.lon+(pos.coords.longitude-previous.lon)*alpha}
      :{lat:previous.lat,lon:previous.lon};
  const measuredHeading=Number.isFinite(pos.coords.heading)&&gpsSpeed>1?pos.coords.heading:derivedHeading;
  const heading=moving?smoothHeading(previous?.heading,measuredHeading,gpsSpeed>5?.68:.48):(previous?.heading||0);
  const displayedMove=previous?haversine(previous.lat,previous.lon,target.lat,target.lon):0;
  if(moving&&displayedMove>3)state.hasMoved=true;
  state.current={...target,accuracy,speed:moving?(gpsSpeed||0):0,heading};
  state.hasLiveFix=true;state.lastFixTime=now;state.gpsLastError='';
  if(state.gpsRetryTimer){clearTimeout(state.gpsRetryTimer);state.gpsRetryTimer=0;}
  if(moving||!previous)smoothVehicleMove(target,displayedMove);
  maybeReroute();
  maybeCheckLiveTraffic();
  if(state.screen==='drive'){
    if(!state.userMarker&&!state.driverMap)render();else updateStatusOnly();
  }
  return true;
}

function ensureGpsFix(){
  if(state.hasLiveFix&&hasPosition()&&Date.now()-state.lastFixTime<30000)return Promise.resolve(true);
  if(!navigator.geolocation?.getCurrentPosition)return Promise.resolve(false);
  return new Promise(resolve=>navigator.geolocation.getCurrentPosition(pos=>resolve(acceptGpsPosition(pos)),()=>resolve(false),{enableHighAccuracy:true,maximumAge:0,timeout:15000}));
}

function startGps() {
  if(!navigator.geolocation)return;
  if(state.gpsRetryTimer){clearTimeout(state.gpsRetryTimer);state.gpsRetryTimer=0;}
  if(state.gpsWatchId!==null){try{navigator.geolocation.clearWatch(state.gpsWatchId);}catch{}state.gpsWatchId=null;}
  const retry=error=>{
    state.gpsLastError=error?.code===1?'Standortfreigabe fehlt':error?.code===2?'GPS vorübergehend nicht verfügbar':'GPS-Zeitüberschreitung';
    if(state.gpsRetryTimer)clearTimeout(state.gpsRetryTimer);
    state.gpsRetryTimer=setTimeout(()=>{state.gpsRetryTimer=0;startGps();},4000);
  };
  try{
    state.gpsWatchId=navigator.geolocation.watchPosition(acceptGpsPosition,retry,{enableHighAccuracy:true,maximumAge:1000,timeout:12000});
    navigator.geolocation.getCurrentPosition(acceptGpsPosition,retry,{enableHighAccuracy:true,maximumAge:10000,timeout:12000});
  }catch(error){retry(error);}
}

function smoothVehicleMove(target,jump=0){
  const driver=isDriverMode();
  const guide=driverVehicleHeading(target,state.current.heading);
  if(driver&&state.driverMap){updateDriverCamera(target,guide,jump>220);return;}
  if(!state.userMarker)return;
  if(state.positionAnimation)cancelAnimationFrame(state.positionAnimation);
  const from=state.userMarker.getLatLng();
  const markerElement=state.userMarker.getElement?.()?.querySelector('.position-marker');
  if(markerElement)markerElement.style.transform=`rotate(${state.current.heading||guide}deg)`;
  const zoom=navigationZoom();
  const center=driver?navigationCameraCenter(target,guide,zoom,state.map):[target.lat,target.lon];
  if(driver)applyDriveOrientation(guide);
  if(jump>220){state.userMarker.setLatLng(target);state.map?.setView(center,driver?zoom:state.map.getZoom(),{animate:false});return;}
  const started=performance.now(),duration=650;
  const frame=now=>{
    if(!state.userMarker)return;
    const t=Math.min(1,(now-started)/duration),eased=1-(1-t)*(1-t);
    state.userMarker.setLatLng([from.lat+(target.lat-from.lat)*eased,from.lng+(target.lon-from.lng)*eased]);
    if(t<1)state.positionAnimation=requestAnimationFrame(frame);else state.positionAnimation=0;
  };
  state.positionAnimation=requestAnimationFrame(frame);
  if(state.screen==='drive'&&state.follow&&state.map){state.map.stop();if(driver&&state.map.getZoom()!==zoom)state.map.setZoom(zoom);state.map.panTo(center,{animate:true,duration:.65,easeLinearity:.35,noMoveStart:true});}
}
function updateStatusOnly(){
  const step=currentStep(),stats=routeStats(),speed=Number.isFinite(state.current.speed)?Math.max(0,Math.round(state.current.speed*3.6)):0;
  const distance=step?distanceToStep(step):0;
  const shouldShowJunction=!!step&&junctionActive(step,distance);
  if(shouldShowJunction!==!!document.querySelector('.junction-view')){render();return;}
  document.querySelectorAll('[data-drive="speed"]').forEach(el=>el.textContent=String(speed));
  document.querySelectorAll('[data-drive="distance"]').forEach(el=>el.textContent=step?formatDistance(distance):'—');
  document.querySelectorAll('[data-drive="arrival"]').forEach(el=>el.textContent=state.route?timeText(stats.arrival):'--:--');
  const remaining=document.querySelector('[data-drive="remaining"]');
  if(remaining)remaining.textContent=state.route?formatDistance(stats.distance):'—';
  updateManeuverSurfaceArrow();
}

async function maybeReroute(){
  if(!state.route)return;
  const destinationDistance=haversine(state.current.lat,state.current.lon,state.destination.lat,state.destination.lon);
  if(destinationDistance<30){
    if(!state.lastSpoken.startsWith('Sie haben Ihr Ziel erreicht.'))speak(arrivalText({maneuver:{modifier:''}},true));
    if(isDriverMode()&&!state.arrived){state.arrived=true;state.navigationMode='overview';if(window.AndroidNavi?.keepScreenOn)window.AndroidNavi.keepScreenOn(false);setTimeout(()=>go('summary'),0);}
    return;
  }
  if(!state.hasMoved||state.rerouting||state.trafficCheckInProgress||Date.now()-state.lastReroute<8000)return;
  let nearest=Infinity;
  const steps=state.route.legs?.[0]?.steps||[];
  const from=Math.max(0,state.routeStepIndex-2),to=Math.min(steps.length-1,state.routeStepIndex+12);
  for(let stepIndex=from;stepIndex<=to;stepIndex++){
    const coords=steps[stepIndex]?.geometry?.coordinates||[];
    for(let i=1;i<coords.length;i++)nearest=Math.min(nearest,pointSegmentDistance(state.current.lat,state.current.lon,coords[i-1][1],coords[i-1][0],coords[i][1],coords[i][0]));
  }
  if(!Number.isFinite(nearest)){
    const coords=state.route.geometry.coordinates;
    for(let i=1;i<coords.length;i++)nearest=Math.min(nearest,pointSegmentDistance(state.current.lat,state.current.lon,coords[i-1][1],coords[i-1][0],coords[i][1],coords[i][0]));
  }
  const tolerance=Math.max(70,(state.current.accuracy||0)*1.5);
  if(nearest<tolerance){state.offRouteFixes=0;return;}
  state.offRouteFixes++;
  if(state.offRouteFixes<3)return;
  state.offRouteFixes=0;
  state.rerouting=true; state.lastReroute=Date.now(); speak('Die Route wird neu berechnet.');
  const rerouteMessage=document.querySelector('.xl-status-message span');
  if(rerouteMessage)rerouteMessage.textContent='Route wird neu berechnet…';
  try{await calculateRoute(false,true);if(state.screen==='drive')render();}catch{}
  finally{state.rerouting=false;}
}

function routeRoadSignature(route,startIndex=0){
  return (route?.legs?.[0]?.steps||[]).slice(startIndex,startIndex+12).filter(step=>step.maneuver?.type!=='depart').map(step=>step.ref||step.name).filter(Boolean).slice(0,8).join('|').toLowerCase();
}

async function maybeCheckLiveTraffic(){
  const now=Date.now();
  if(!state.route||!state.destination||!state.hasMoved||state.current.speed<2||state.rerouting||state.trafficCheckInProgress||!canUseTomTom()||now-state.lastTrafficCheck<600000)return;
  state.lastTrafficCheck=now;state.trafficCheckInProgress=true;
  const requestToken=++state.trafficRouteToken;
  const oldSignature=routeRoadSignature(state.route,state.routeStepIndex);
  const oldDistance=routeStats().distance,oldDelay=state.route.trafficDelay||0;
  try{
    const candidate=await calculateTomTomRoute(false);
    if(requestToken!==state.trafficRouteToken||!state.destination)return;
    const newSignature=routeRoadSignature(candidate,0);
    const changed=oldSignature&&newSignature&&oldSignature!==newSignature&&(Math.abs(candidate.distance-oldDistance)>350||Math.abs((candidate.trafficDelay||0)-oldDelay)>60);
    const navigationMode=state.navigationMode;
    state.route=candidate;state.trafficStatus=`Live-Verkehr aktiv · ${formatTrafficDelay(candidate.trafficDelay)}`;resetRouteProgress(navigationMode==='driving'?'driving':'overview');
    if(changed)speak('Die Verkehrslage hat sich geändert. Die Route wurde angepasst.');
    await refreshTrafficIncidents(false);
    if(state.screen==='drive')render();
  }catch(error){handleTomTomError(error);}
  finally{state.trafficCheckInProgress=false;}
}

function startVoiceAddress(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR)return notify('Spracheingabe wird von diesem Browser nicht unterstützt. Bitte „Adresse“ verwenden.');
  const r=new SR();r.lang='de-DE';r.interimResults=false;r.onresult=e=>{const text=e.results[0][0].transcript;resetAddress();state.address.city=text;state.wizardStep='street';go('wizard');};r.onerror=()=>notify('Adresse wurde nicht verstanden. Bitte erneut versuchen.');r.start();notify('Bitte Ort und Adresse deutlich sprechen…');
}
function askCoordinates(){const text=prompt('Breitengrad, Längengrad',hasPosition()?`${state.current.lat.toFixed(5)}, ${state.current.lon.toFixed(5)}`:'');if(!text)return;const [lat,lon]=text.split(',').map(Number);if(Number.isFinite(lat)&&Number.isFinite(lon))planTo({lat,lon,display_name:`Koordinaten ${lat.toFixed(5)}, ${lon.toFixed(5)}`});else notify('Koordinaten nicht erkannt.');}
async function searchNearby(term){if(!await ensureGpsFix())return notify('Für die Suche in der Nähe wird ein gültiges GPS-Signal benötigt.');state.loading=true;state.notice=`${term} wird gesucht…`;render();try{const data=await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(term)}&lang=de&limit=1&lat=${state.current.lat}&lon=${state.current.lon}`).then(r=>r.json());if(!data.features?.length)throw new Error();await planTo(photonItem(data.features[0]));}catch{notify(`${term} konnte nicht gefunden werden.`);}}

async function showCurrentAddress(){
  if(!await ensureGpsFix())return notify('Noch kein gültiges GPS-Signal. Bitte kurz unter freiem Himmel warten.');
  state.loading=true;state.notice='Aktuelle Straße wird gesucht…';render();
  const params=new URLSearchParams({key:TOMTOM_API_KEY,radius:'100',language:'de-DE',returnSpeedLimit:'true',heading:String(Math.round(state.current.heading||0))});
  try{
    const response=await fetch(`https://api.tomtom.com/search/2/reverseGeocode/${state.current.lat},${state.current.lon}.json?${params}`);
    if(!response.ok)throw new Error();
    const address=(await response.json()).addresses?.[0]?.address;if(!address)throw new Error();
    const name=address.freeformAddress||[address.streetNameAndNumber||address.streetName,address.postalCode,address.municipality].filter(Boolean).join(', ');
    const speed=address.speedLimit?`\nZulässige Geschwindigkeit: ${String(address.speedLimit).replace('KPH','km/h')}`:'';
    notify(`${name}${speed}\nGPS-Genauigkeit: ${Math.round(state.current.accuracy||0)} m`);
  }catch{notify(`Position: ${state.current.lat.toFixed(5)}, ${state.current.lon.toFixed(5)}\nGPS-Genauigkeit: ${Math.round(state.current.accuracy||0)} m`);}
}

function shortName(name='Ziel'){return name.split(',').slice(0,2).join(',').slice(0,30);}
function escapeHtml(value=''){return String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

function enableDriveDemo() {
  const demo=new URLSearchParams(location.search).get('demo');
  if(demo!=='route'&&demo!=='junction'&&demo!=='overview'&&demo!=='turn')return;
  const turning=demo==='turn';
  const motorway=demo==='junction';
  const overview=demo==='overview';
  state.screen=overview?'summary':'drive';
  const start=motorway?{lat:48.7758,lon:9.1829}:{lat:51.588507,lon:7.314882};
  const finish=motorway?{lat:48.86,lon:9.32}:{lat:51.5730,lon:7.2990};
  if(turning){
    const before={lat:51.58810,lon:7.31420},current={lat:51.58842,lon:7.31420},corner={lat:51.58882,lon:7.31420},after={lat:51.58882,lon:7.31545};
    state.demoMode=true;state.navigationMode='driving';state.screen='drive';state.hasMoved=true;state.hasLiveFix=true;state.lastFixTime=Date.now();state.current={...current,accuracy:4,speed:10,heading:0};
    state.destination={...after,display_name:'Testziel nach der Kreuzung'};
    state.route={distance:150,duration:24,geometry:{coordinates:[[before.lon,before.lat],[corner.lon,corner.lat],[after.lon,after.lat]]},legs:[{steps:[
      {distance:80,duration:12,name:'Geradeausstraße',maneuver:{type:'depart',modifier:'straight',location:[before.lon,before.lat]},geometry:{coordinates:[[before.lon,before.lat],[corner.lon,corner.lat]]}},
      {distance:70,duration:12,name:'Abbiegestraße',maneuver:{type:'turn',modifier:'right',location:[corner.lon,corner.lat]},geometry:{coordinates:[[corner.lon,corner.lat],[after.lon,after.lat]]}}
    ]}]};
    state.routeStepIndex=0;state.instructionStepIndex=1;
  }else{
  state.demoMode=true;state.navigationMode=overview?'overview':'driving';state.hasMoved=true;state.hasLiveFix=true;state.lastFixTime=Date.now();state.current={...start,accuracy:5,speed:25,heading:0};
  state.destination={...finish,display_name:motorway?'Hamburg':'Castrop-Rauxel Hauptbahnhof'};
  state.route={distance:3000,duration:360,geometry:{coordinates:[[start.lon,start.lat],[finish.lon,finish.lat]]},legs:[{steps:[{distance:3000,duration:360,name:motorway?'A 8':'Römerstraße',ref:motorway?'A 8':'',maneuver:{type:motorway?'off ramp':'depart',modifier:motorway?'right':'straight',location:[start.lon,start.lat]},geometry:{coordinates:[[start.lon,start.lat],[finish.lon,finish.lat]]},intersections:motorway?[{lanes:[{indications:['straight'],valid:false},{indications:['straight'],valid:false},{indications:['slight right'],valid:true},{indications:['right'],valid:true}]}]:[]}]}]};
  if(!motorway)fetch(`https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${finish.lon},${finish.lat}?steps=true&geometries=geojson&overview=full`).then(response=>response.ok?response.json():null).then(data=>{
    if(data?.routes?.[0]&&state.demoMode){state.route=data.routes[0];const [lon,lat]=data.routes[0].geometry.coordinates[0];state.current={...state.current,lat,lon};render();}
  }).catch(()=>{});
  }
  window.__classicDriveDebug=()=>{
    const driver=state.driverMap;
    const point=driver?.project?.([state.current.lon,state.current.lat]);
    const roadNameLayer=driver?.getStyle?.()?.layers?.find(layer=>layer.id==='highway-name-minor');
    const roadLayer=driver?.getStyle?.()?.layers?.find(layer=>layer.id==='road_minor');
    return driver
      ?{renderer:'maplibre',zoom:driver.getZoom(),bearing:driver.getBearing(),pitch:driver.getPitch(),mapSize:{x:driver.getContainer().clientWidth,y:driver.getContainer().clientHeight},gpsPoint:point&&{x:point.x,y:point.y},roadNameSize:roadNameLayer?.layout?.['text-size'],roadWidth:roadLayer?.paint?.['line-width']}
      :{renderer:'leaflet',zoom:state.map?.getZoom?.(),bearing:state.cameraBearing,pitch:0,mapSize:state.map?.getSize?.(),gpsPoint:state.map?.latLngToContainerPoint?.([state.current.lat,state.current.lon])};
  };
}

window.handleClassicBack=handleSystemBack;
document.addEventListener?.('contextmenu',event=>event.preventDefault());
document.addEventListener?.('selectstart',event=>event.preventDefault());
document.addEventListener?.('dragstart',event=>event.preventDefault());
if('serviceWorker' in navigator && location.hostname !== 'app.local') window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js'));
enableDriveDemo();
startGps();
document.addEventListener?.('visibilitychange',()=>{if(document.visibilityState==='visible'&&(!state.hasLiveFix||Date.now()-state.lastFixTime>15000))startGps();});
window.addEventListener('online',()=>{if(!state.hasLiveFix)startGps();});
window.__classicGpsDebug=()=>({hasFix:state.hasLiveFix,lastFixTime:state.lastFixTime,lastError:state.gpsLastError,accuracy:state.current.accuracy,watchActive:state.gpsWatchId!==null});
render();
// Erst nach erfolgreichem Parsen und dem ersten Rendern gilt ein Hotfix als startfähig.
try { window.AndroidNavi?.confirmHotfix?.(); } catch { /* APK-Version ohne Updater */ }
