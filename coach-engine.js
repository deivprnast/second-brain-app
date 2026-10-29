// ============================================================================
// 🧠 SECOND BRAIN 3.0: SUPER-COACH, ANTICIPATION ENGINE, FOCUS 3 & VOICE AI
// Zero-Knowledge Cloud PWA (Mobil & Desktop Kokpit • Offline-Ready)
// ============================================================================

window.sb2FocusModeActive = false;
window.sb2IsSpeakingBriefing = false;
window.sb2WinsOpen = false;
window.sb2CoachOpen = window.innerWidth >= 1024; // Na mobilu kompaktní lišta nahoře, rozbalení 1 klikem
window.sb2RadarOpen = false;
window.sb2LastCoachState = null;

// 1. DYNAMICKÝ TREZOR (Načítá se ze soukromého repozitáře po ověření GitHub Tokenu + Offline Cache)
window.PEOPLE_CONTEXT_PROMPT = '';
window.PRIVATE_SMART_REPLACEMENTS = [];
window.PRIVATE_DRAWER_DATA = null;
window.PRIVATE_WORLD_KEYWORDS = null;

window.applyVaultPayload = function(parsed) {
  if (!parsed || typeof parsed !== 'object') return;
  if (parsed.peopleContextPrompt) window.PEOPLE_CONTEXT_PROMPT = parsed.peopleContextPrompt;
  if (Array.isArray(parsed.smartReplacements)) window.PRIVATE_SMART_REPLACEMENTS = parsed.smartReplacements;
  if (parsed.drawers) window.PRIVATE_DRAWER_DATA = parsed.drawers;
  if (parsed.worldKeywords) window.PRIVATE_WORLD_KEYWORDS = parsed.worldKeywords;
  if (parsed.ownerTitle) {
    document.title = parsed.ownerTitle;
    const lockTitle = document.getElementById('lockScreenTitle');
    if (lockTitle) lockTitle.textContent = parsed.ownerTitle;
  }
};

// Hydratace z lokální mezipaměti (pro okamžitý start v letadle / mimo EU bez roamingu)
try {
  if (localStorage.getItem('github_token')) {
    const cachedVault = localStorage.getItem('sb_cache_vault_json');
    if (cachedVault) {
      window.applyVaultPayload(JSON.parse(cachedVault));
    }
  }
} catch (e) {}

window.loadPrivateAppVaultData = async function(ghToken) {
  if (!ghToken) return;
  try {
    const res = await fetch('https://api.github.com/repos/deivprnast/david-second-brain/contents/BRAIN/PRIVATE_APP_DATA.json', {
      headers: {
        'Authorization': `Bearer ${ghToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (res.ok) {
      const fileData = await res.json();
      const jsonStr = decodeURIComponent(escape(atob(fileData.content.replace(/\s/g, ''))));
      localStorage.setItem('sb_cache_vault_json', jsonStr);
      const parsed = JSON.parse(jsonStr);
      window.applyVaultPayload(parsed);
      if (typeof renderUI === 'function' && window.lastRenderedData) {
        renderUI(window.lastRenderedData);
      }
    }
  } catch (e) {
    console.warn('Offline režim – používám uložený trezor z mezipaměti.');
  }

  // Tichý pre-cache myšlenkové mapy pro 100% offline čtení na cestách
  try {
    if (!localStorage.getItem('sb_cache_mapa_html')) {
      const mapRes = await fetch('https://api.github.com/repos/deivprnast/david-second-brain/contents/BRAIN/MAPA_ZIVOTA_DAVID_PRYCL.html', {
        headers: {
          'Authorization': `Bearer ${ghToken}`,
          'Accept': 'application/vnd.github.v3.raw'
        }
      });
      if (mapRes.ok) {
        const html = await mapRes.text();
        localStorage.setItem('sb_cache_mapa_html', html);
      }
    }
  } catch (e) {}
};

window.applySmartPeopleDictionary = function(rawText) {
  if (!rawText) return '';
  let t = String(rawText);
  const rules = Array.isArray(window.PRIVATE_SMART_REPLACEMENTS) ? window.PRIVATE_SMART_REPLACEMENTS : [];
  for (const pair of rules) {
    if (Array.isArray(pair) && pair.length === 2) {
      try {
        t = t.replace(new RegExp(pair[0], 'gi'), pair[1]);
      } catch (e) {}
    }
  }
  return t;
};

window.blobToBase64 = function(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result || '';
      const base64 = String(dataUrl).split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// 2. GEMINI MULTIMODAL AUDIO TRANSCRIPTION
window.transcribeAudioBlobWithGemini = async function(audioBlob, mimeType) {
  const apiKey = localStorage.getItem('gemini_api_key');
  if (!apiKey || !audioBlob) return null;

  try {
    const base64Audio = await window.blobToBase64(audioBlob);
    if (!base64Audio) return null;

    const cleanMime = (mimeType || 'audio/webm').split(';')[0].trim();
    const modelsToTry = ['gemini-2.5-flash', 'gemini-1.5-flash'];

    const prompt = `Jsi osobní Chief of Staff & Digitální dvojče.
Přepiš přesně tuto českou hlasovou nahrávku a oprav v ní jména a odborné pojmy podle tohoto slovníku:
${window.PEOPLE_CONTEXT_PROMPT}

Vrať POUZE čistý přepsaný text v češtině bez uvozovek a bez komentářů.`;

    for (const model of modelsToTry) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [
                { text: prompt },
                { inline_data: { mime_type: cleanMime, data: base64Audio } }
              ]
            }],
            generationConfig: { temperature: 0.1 }
          })
        });
        if (res.ok) {
          const data = await res.json();
          const transcript = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if (transcript) {
            return window.applySmartPeopleDictionary(transcript);
          }
        }
      } catch (innerErr) {
        console.warn('Gemini audio model attempt failed:', model, innerErr);
      }
    }
  } catch (err) {
    console.warn('Chyba při multimodálním přepisu audia:', err);
  }
  return null;
};

// 3. VÝPOČET STAVU: SKÓRE VÍTĚZSTVÍ, FOKUS 3 KARET & SUPER-KOUČ
window.computeSecondBrain2State = function(tasks, timeline) {
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const safeTimeline = Array.isArray(timeline) ? timeline : [];
  const now = new Date();
  const hour = now.getHours();

  // Oddělit aktivní sprint (next + week + waiting) od backlogu a hotových zářezů
  const completedTasks = safeTasks.filter(t => t.completed);
  const nextTasks = safeTasks.filter(t => !t.completed && t.section === 'next');
  const weekTasks = safeTasks.filter(t => !t.completed && t.section === 'week');
  const activePriorityPool = nextTasks.length > 0
    ? [...nextTasks, ...weekTasks]
    : safeTasks.filter(t => !t.completed && t.section !== 'backlog');
  const fallbackPool = activePriorityPool.length > 0 ? activePriorityPool : safeTasks.filter(t => !t.completed);

  const completedBlocks = safeTimeline.filter(b => b.completed);

  // Skóre počítáme vůči aktuálnímu fokusu + hotovým zářezům (aby backlog nezkresloval procenta)
  const sprintTotal = Math.max(completedTasks.length + nextTasks.length, 1);
  const doneCount = completedTasks.length;
  const progressPercent = Math.min(100, Math.round((doneCount / sprintTotal) * 100));

  const recentWins = [
    ...completedBlocks.map(b => `${b.time}: ${b.title}`),
    ...completedTasks.map(t => t.title.replace(/\*\*/g, ''))
  ].slice(0, 8);

  let dopamineMessage = '';
  if (doneCount === 0) {
    dopamineMessage = 'Čistý štít! Začni kartou #1 (Ranní žába) a nastartuj vítěznou vlnu.';
  } else if (doneCount <= 3) {
    dopamineMessage = `Skvělý rozjezd! Máš ${doneCount} hotové zářezy (${progressPercent} % sprintu).`;
  } else if (doneCount <= 8) {
    dopamineMessage = `Silné momentum: ${doneCount} hotových zářezů (${progressPercent} % sprintu). Tah na branku běží!`;
  } else {
    dopamineMessage = `🔥 Špičková exekuce: ${doneCount} hotových zářezů v paměti (${progressPercent} % sprintu) • ${nextTasks.length} v aktuálním fokusu.`;
  }

  // Režim Fokus 3 Karet – respektuje pořadí v AKTUÁLNÍM FOKUSU (#1 Ranní žába, #2 Výjezd / Strategická páka, #3 Priorita)
  const activeBlock = safeTimeline.find(b => !b.completed && b.isCurrent) || safeTimeline.find(b => !b.completed) || null;
  const pool = [...fallbackPool];
  const focusTop3 = [];

  const roleMeta = [
    {
      badge: '🐸 #1 HLAVNÍ TAH / RANNÍ ŽÁBA',
      color: 'rose',
      hint: 'První věc na řadě – vyřeš ji s čistou hlavou bez přepínání kontextu.'
    },
    {
      badge: '🏛️ #2 STRATEGICKÁ PÁKA & KLÍČOVÉ TÉMA',
      color: 'indigo',
      hint: 'Vysoký pákový efekt pro hlavní projekty a klíčová jednání.'
    },
    {
      badge: '🚀 #3 DRUHÁ VLNA / TVORBA & SYSTÉM',
      color: 'emerald',
      hint: 'Posun systému kupředu po odbavení prvních dvou priorit.'
    }
  ];

  while (focusTop3.length < 3 && pool.length > 0) {
    const nextTask = pool.shift();
    const idx = focusTop3.length;
    focusTop3.push({
      task: nextTask,
      rank: idx + 1,
      roleBadge: roleMeta[idx].badge,
      roleColor: roleMeta[idx].color,
      whyHint: roleMeta[idx].hint
    });
  }

  const cleanTitleForCoach = (str) => String(str || '').replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
  const top1Title = focusTop3[0] ? cleanTitleForCoach(focusTop3[0].task.title) : 'Zkontrolovat dnešní priority';

  let phaseTitle = '⚡ Dopolední Tah na Branku';
  let phaseBadgeClass = 'bg-indigo-100 text-indigo-800 border-indigo-200';
  let rightNow = '';
  let psychGuard = '';

  if (hour >= 22 || hour < 5) {
    phaseTitle = '🛑 Noční Stopka (Spánkový štít)';
    phaseBadgeClass = 'bg-rose-100 text-rose-800 border-rose-200';
    rightNow = 'Všechny podklady, mapy i briefingy jsou bezpečně uložené (včetně Offline mezipaměti). Zavři obrazovku a spi.';
    psychGuard = '⚠️ Po 22:00 už mozek jede na dluh – spánek ti zítra přinese 3× větší ostrost v autě i na jednáních.';
  } else if (hour >= 5 && hour < 10) {
    phaseTitle = '🌅 Ranní Exekuce (Eat the Frog)';
    phaseBadgeClass = 'bg-indigo-100 text-indigo-800 border-indigo-200';
    rightNow = `Krok #1 hned ráno: „${top1Title}“.`;
    psychGuard = '🛡️ Nejdřív uzavři rychlou ranní žábu, pak teprve naskoč do zbytku dne s čistou hlavou.';
  } else if (hour >= 10 && hour < 14) {
    phaseTitle = '🔥 Hlavní Blok & Fokus';
    phaseBadgeClass = 'bg-indigo-100 text-indigo-800 border-indigo-200';
    rightNow = activeBlock
      ? `Právě běží blok (${activeBlock.time}): ${activeBlock.title}.`
      : `Drž fokus na kartě: „${top1Title}“.`;
    psychGuard = '🛡️ Nové nápady jen bleskově nadiktuj nahoru do Rychlého záchytu a nepřepínej hlavní kontext.';
  } else if (hour >= 14 && hour < 18) {
    phaseTitle = '🔋 Odpolední Strategie & Dotahování';
    phaseBadgeClass = 'bg-amber-100 text-amber-800 border-amber-200';
    rightNow = `Dotáhni otevřenou prioritu: „${top1Title}“.`;
    psychGuard = '⚡ Stačí dotáhnout Top 3 karty – nesnaž se vyřešit celý backlog najednou.';
  } else {
    phaseTitle = '🌿 Večerní Klid & Regenerace';
    phaseBadgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
    rightNow = 'Čas na klid, rodinu a regeneraci. Vše na zítřek je připravené v kartách níže.';
    psychGuard = '💚 Dnes jsi odvedl velký kus práce. Pokud tě něco napadne, jen to odlož jedním klepnutím do záchytu.';
  }

  const anticipation = [...nextTasks, ...weekTasks].slice(0, 3).map(t => ({
    when: t.time || t.tag || 'Priorita',
    title: cleanTitleForCoach(t.title),
    tip: (t.fullDetail || '').slice(0, 180) + ((t.fullDetail || '').length > 180 ? '…' : '')
  }));

  const top3Speech = focusTop3
    .map((item, idx) => `Priorita ${idx + 1}: ${cleanTitleForCoach(item.task.title).replace(/[^\w\sá-žÁ-Ž0-9.,:-]/g, '')}.`)
    .join(' ');

  const audioBriefingText = `Tady tvůj mobilní kokpit a Chief of Staff. ` +
    `V aktuálním fokusu máš ${nextTasks.length} aktivních úkolů a ${doneCount} hotových zářezů. ` +
    `${top3Speech} ` +
    `Doporučení na právě teď: ${rightNow}`;

  return {
    victory: {
      doneCount,
      nextCount: nextTasks.length,
      sprintTotal,
      progressPercent,
      recentWins,
      dopamineMessage
    },
    focusTop3,
    activeBlock,
    coach: {
      phaseTitle,
      phaseBadgeClass,
      rightNow,
      psychGuard,
      anticipation,
      audioBriefingText
    }
  };
};

// 4. VYKRESLENÍ KOMPAKTNÍHO MOBILNÍHO BARU + FOKUS 3 DO DOMU
window.renderSecondBrain2Widgets = function(tasks, timeline, rawMd) {
  const state = window.computeSecondBrain2State(tasks, timeline, rawMd);
  window.sb2LastCoachState = state;
  const esc = typeof escapeHtml === 'function'
    ? escapeHtml
    : (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Kompaktní sjednocený pruh Skóre + Kouč (nezabírá půl displeje na mobilu!)
  const coachContainer = document.getElementById('sb2CoachContainer');
  const victoryContainer = document.getElementById('sb2VictoryContainer');
  if (victoryContainer) victoryContainer.innerHTML = ''; // Sjednoceno do kompaktního baru

  if (coachContainer) {
    const v = state.victory;
    const c = state.coach;
    const winsHtml = v.recentWins.length > 0
      ? v.recentWins.map(w => `<span class="inline-flex items-center space-x-1 px-2 py-1 bg-white border border-emerald-200 rounded-lg text-[11px] font-semibold text-emerald-900"><span>✅</span><span class="truncate max-w-[260px]">${esc(w)}</span></span>`).join('')
      : `<span class="text-[11px] text-slate-500 italic">Zatím žádný hotový zářez.</span>`;

    coachContainer.innerHTML = `
      <div class="bg-gradient-to-r from-indigo-50/90 via-white to-emerald-50/60 border border-indigo-200/80 rounded-2xl p-2.5 sm:p-3 shadow-2xs space-y-2">
        <!-- Rychlá akční lišta na 1 řádek -->
        <div class="flex items-center justify-between gap-1.5 flex-wrap">
          <button onclick="window.toggleSb2CoachDrawer()" class="flex items-center space-x-2 text-left min-w-0 flex-1 py-0.5 cursor-pointer">
            <span class="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-sm shrink-0 shadow-2xs">🧭</span>
            <div class="min-w-0 flex-1">
              <div class="flex items-center space-x-1.5">
                <span class="text-[11px] font-extrabold text-slate-900 truncate">${esc(c.phaseTitle)}</span>
                <span class="text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-200 shrink-0">🏆 ${v.doneCount} hotovo</span>
              </div>
              <p class="text-[11px] text-slate-600 truncate">${esc(c.rightNow)}</p>
            </div>
            <span class="text-slate-400 text-xs font-bold px-1">${window.sb2CoachOpen ? '▴' : '▾'}</span>
          </button>

          <div class="flex items-center space-x-1 shrink-0">
            <button onclick="window.playCoachAudioBriefing()" id="sb2AudioBriefingBtn" class="px-2.5 py-1.5 ${window.sb2IsSpeakingBriefing ? 'bg-rose-600 animate-pulse' : 'bg-emerald-600 hover:bg-emerald-700'} text-white rounded-xl text-[11px] font-bold shadow-2xs active:scale-95 transition-all flex items-center space-x-1 cursor-pointer" title="Přehrát 60s hlasový briefing do auta / sluchátek">
              <span>🎧</span>
              <span id="sb2AudioBriefingLabel">${window.sb2IsSpeakingBriefing ? 'Stop' : '60s Audio'}</span>
            </button>
            <a href="./mapa.html" class="px-2.5 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-[11px] font-bold active:scale-95 transition-all flex items-center space-x-1" title="Otevřít Mapu života (funguje i offline)">
              <span>🗺️</span>
              <span class="hidden sm:inline">Mapa</span>
            </a>
          </div>
        </div>

        <!-- Rozbalovací detail kouče a posledních vítězství -->
        <div id="sb2CoachExpandedBody" class="${window.sb2CoachOpen ? 'space-y-2.5 pt-2 border-t border-indigo-100' : 'hidden'}">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div class="p-2.5 bg-white border border-indigo-200 border-l-4 border-l-indigo-600 rounded-xl">
              <span class="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 block">🎯 KROK #1 PRÁVĚ TEĎ:</span>
              <p class="text-xs font-bold text-slate-900 mt-0.5 leading-relaxed">${esc(c.rightNow)}</p>
            </div>
            <div class="p-2.5 bg-amber-50/80 border border-amber-200 border-l-4 border-l-amber-500 rounded-xl">
              <span class="text-[10px] font-extrabold uppercase tracking-wider text-amber-900 block">🛡️ PSYCHOLOGICKÝ ŠTÍT:</span>
              <p class="text-xs font-semibold text-amber-950 mt-0.5 leading-relaxed">${esc(c.psychGuard)}</p>
            </div>
          </div>

          <div class="flex items-center justify-between flex-wrap gap-2 pt-0.5">
            <span class="text-[11px] font-semibold text-emerald-800">${esc(v.dopamineMessage)}</span>
            <div class="flex items-center space-x-1.5">
              <button onclick="window.toggleSb2WinsDrawer()" class="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-bold cursor-pointer">
                🏆 Poslední zářezy (${v.recentWins.length}) ${window.sb2WinsOpen ? '▴' : '▾'}
              </button>
              <button onclick="window.askSuperCoachLive()" class="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold cursor-pointer">
                💬 Porada s AI
              </button>
            </div>
          </div>

          <div id="sb2WinsDrawer" class="${window.sb2WinsOpen ? 'flex flex-wrap gap-1.5 pt-1.5 border-t border-emerald-100' : 'hidden'}">
            ${winsHtml}
          </div>
        </div>
      </div>
    `;
  }

  // Vykreslit 🎯 Režim Fokus 3 Karet (pokud je aktivní)
  const focus3Container = document.getElementById('sb2Focus3Container');
  if (focus3Container && window.sb2FocusModeActive) {
    const cardsHtml = state.focusTop3.map(({ task, roleBadge, roleColor, whyHint }) => {
      const origIdx = (window.allParsedTasks || []).findIndex(x => x.id === task.id);
      const borderThemes = {
        rose: 'border-rose-300 border-l-4 border-l-rose-600 bg-gradient-to-br from-rose-50/50 via-white to-white',
        indigo: 'border-indigo-300 border-l-4 border-l-indigo-600 bg-gradient-to-br from-indigo-50/50 via-white to-white',
        emerald: 'border-emerald-300 border-l-4 border-l-emerald-600 bg-gradient-to-br from-emerald-50/50 via-white to-white'
      };
      const badgeThemes = {
        rose: 'bg-rose-100 text-rose-900 border-rose-300',
        indigo: 'bg-indigo-100 text-indigo-900 border-indigo-300',
        emerald: 'bg-emerald-100 text-emerald-900 border-emerald-300'
      };
      const themeClass = borderThemes[roleColor] || borderThemes.indigo;
      const rBadgeClass = badgeThemes[roleColor] || badgeThemes.indigo;
      const titleHtml = typeof formatRichText === 'function' ? formatRichText(task.title, true) : esc(task.title);
      const detailHtml = typeof formatDetailDisplay === 'function' ? formatDetailDisplay(task.fullDetail || '', task.title, task.id) : esc(task.fullDetail || '');

      return `
        <div class="p-4 rounded-2xl border ${themeClass} shadow-sm space-y-3">
          <div class="flex items-center justify-between flex-wrap gap-1.5">
            <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${rBadgeClass}">${esc(roleBadge)}</span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded border ${task.badgeClass}">${esc(task.tag)}</span>
          </div>

          <div class="flex items-start justify-between space-x-3">
            <div class="flex-1 min-w-0">
              <h4 class="text-sm font-extrabold text-slate-900 leading-snug">${titleHtml}</h4>
              ${task.time ? `<p class="text-xs text-indigo-700 mt-1 font-bold">⏱️ ${esc(task.time)}</p>` : ''}
            </div>
            <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTask(${origIdx}, this.checked)" class="w-6 h-6 mt-0.5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0">
          </div>

          ${task.hasDetail ? `
            <div class="flex items-center justify-between pt-1">
              <button onclick="openReaderModal('${task.id}')" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-2xs active:scale-95 transition-all flex items-center space-x-1.5">
                <span>📖</span>
                <span>Otevřít čtecí briefing</span>
              </button>
              <button onclick="speakTaskDetail('${task.id}')" class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold active:scale-95 transition-all">
                🔊 Přečíst
              </button>
            </div>
            <div class="p-3 bg-slate-50/90 border border-slate-200/80 rounded-xl text-[12.5px] text-slate-700 leading-relaxed max-h-[320px] overflow-y-auto">
              ${detailHtml}
            </div>
          ` : ''}

          <div class="pt-1 text-[11px] text-slate-500 italic">💡 ${esc(whyHint)}</div>
        </div>
      `;
    }).join('');

    const hiddenCount = Math.max(0, (tasks || []).filter(t => !t.completed).length - 3);
    focus3Container.innerHTML = `
      <div class="space-y-3">
        <div class="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between flex-wrap gap-2">
          <span class="text-xs text-amber-950 font-semibold">🎯 <b>Režim Fokus 3:</b> Skryto ostatních ${hiddenCount} úkolů pro 100% klid na dotažení hlavních priorit.</span>
          <button onclick="window.setBoardViewMode('stream')" class="px-3 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold cursor-pointer">
            📱 Zpět na seznam úkolů
          </button>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
          ${cardsHtml}
        </div>
      </div>
    `;
  }
};

window.toggleSb2CoachDrawer = function() {
  window.sb2CoachOpen = !window.sb2CoachOpen;
  if (typeof window.allParsedTasks !== 'undefined') {
    window.renderSecondBrain2Widgets(window.allParsedTasks, window.currentParsedTimeline, window.currentRawMarkdown);
  }
};

window.toggleSb2WinsDrawer = function() {
  window.sb2WinsOpen = !window.sb2WinsOpen;
  if (typeof window.allParsedTasks !== 'undefined') {
    window.renderSecondBrain2Widgets(window.allParsedTasks, window.currentParsedTimeline, window.currentRawMarkdown);
  }
};

window.toggleFocus3Mode = function(forceState) {
  const next = typeof forceState === 'boolean' ? forceState : !window.sb2FocusModeActive;
  if (typeof window.setBoardViewMode === 'function') {
    window.setBoardViewMode(next ? 'focus3' : 'stream');
  } else {
    window.sb2FocusModeActive = next;
    window.renderSecondBrain2Widgets(window.allParsedTasks || [], window.currentParsedTimeline || [], window.currentRawMarkdown || '');
  }
};

// 5. PŘEHRÁNÍ 60S AUDIO BRIEFINGU DO AUTA / SLUCHÁTEK
window.playCoachAudioBriefing = function() {
  if (!('speechSynthesis' in window)) {
    alert('Hlasový výstup není v tomto prohlížeči podporován.');
    return;
  }

  if (window.sb2IsSpeakingBriefing) {
    window.speechSynthesis.cancel();
    window.sb2IsSpeakingBriefing = false;
    window.renderSecondBrain2Widgets(window.allParsedTasks || [], window.currentParsedTimeline || [], window.currentRawMarkdown || '');
    return;
  }

  window.speechSynthesis.cancel();
  const state = window.sb2LastCoachState || window.computeSecondBrain2State(window.allParsedTasks || [], window.currentParsedTimeline || []);
  const utterance = new SpeechSynthesisUtterance(state.coach.audioBriefingText);
  utterance.lang = 'cs-CZ';
  utterance.rate = 1.04;

  window.sb2IsSpeakingBriefing = true;
  window.renderSecondBrain2Widgets(window.allParsedTasks || [], window.currentParsedTimeline || [], window.currentRawMarkdown || '');

  const resetBtn = () => {
    window.sb2IsSpeakingBriefing = false;
    window.renderSecondBrain2Widgets(window.allParsedTasks || [], window.currentParsedTimeline || [], window.currentRawMarkdown || '');
  };

  utterance.onend = resetBtn;
  utterance.onerror = resetBtn;
  window.speechSynthesis.speak(utterance);
};

// 6. ŽIVÁ STRATEGICKÁ PORADA S AI KOUČEM
window.askSuperCoachLive = function() {
  if (typeof switchTab === 'function') switchTab('ai');
  if (typeof sendQuickPrompt === 'function') {
    sendQuickPrompt('Jako můj Chief of Staff zhodnoť mé aktuální Top 3 priority v PRIORITIES.md, upozorni mě na případné hrozby nebo termíny na nejbližší 3 dny a dej mi jasný mikro-plán na nejbližších 30 minut.');
  }
};
