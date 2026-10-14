// ============================================================================
// 🧠 SECOND BRAIN 2.0: SUPER-COACH, ANTICIPATION ENGINE, FOCUS 3 & VOICE AI
// Modulární mozek pro Cloud PWA (mobil) & Desktop Web Kokpit (Light Mode Only)
// ============================================================================

window.sb2FocusModeActive = false;
window.sb2IsSpeakingBriefing = false;
window.sb2WinsOpen = false;
window.sb2RadarOpen = true;
window.sb2LastCoachState = null;

// 1. KONTEXTOVÝ SLOVNÍK PEOPLE.md & PROJEKTŮ (Fonetická korekce hlasového přepisu)
window.PEOPLE_CONTEXT_PROMPT = `
KLÍČOVÍ LIDÉ A POJMY DAVIDA PRYCLA (pro přesný přepis jmen z hlasu):
- Pavel Háp (děkan FTK UP, Háp, Hápovi, "Hapič")
- Martin Sigmund (ředitel AC Baluo, "Sigi", řeší se jeho odchod/kamery)
- VTP Suchomel (vědeckotechnický park, doc. Suchomel, často zkomoleno jako "suchou málem")
- Tomáš Junek (kolega/operativa, často zkomoleno jako "Tomáš jehonkem" nebo "Jehonek")
- Francisco Ayala (zahraniční vědec / článek / stáž, často vyslovováno "Ajala", "Ayalovi")
- Karel Hůlka (FTK UP, cesťák Chorvatsko, IGA, "Hůlkovi")
- Rudolf Psotta (prof. Psotta, DMP protokol, GAČR, "Ruda Psota")
- Michal Šafář (proděkan FTK UP, "Šafi", pozvánka čtvrtek)
- Pavel Král ("Tajoš", tajemník FTK UP)
- David Bernatík ("Berny", kolega FTK / diagnostika)
- Jirka Veverka (správce webu UPOL / FTK, čtvrteční schůzka Active Campus)
- Zbyněk ("Zbyňa", spoluzakladatel StartItUp, VIP weby)
- Robert (StartItUp e-mailová rozesílka / kampaň)
- Vondzík & Bauer (strategické byznys výjezdko pátek/sobota)
- Pája Mrnuštík (trenér / fitness v AC Baluo)
- Janča (manželka Jana Pryclová), dcery Nelinka a Andrejka (školka, Vincík)
- Klíčové projekty a pojmy: AC Baluo, Active Campus (Active Lab, Active Space, Active Living, activecampus.cz), StartItUp (Nastartujto), Gamifiter, CPET, VALD, RFAO, Kinovea, Ochy, UNIFY.
`.trim();

window.applySmartPeopleDictionary = function(rawText) {
  if (!rawText) return '';
  let t = String(rawText);
  const replacements = [
    [/\bsuchou málem\b/gi, 'Suchomelem'],
    [/\bsuchým málem\b/gi, 'Suchomelem'],
    [/\bsuchý mal\b/gi, 'Suchomel'],
    [/\btomáš\s+jehonkem\b/gi, 'Tomášem Junkem'],
    [/\bjehonkem\b/gi, 'Tomášem Junkem'],
    [/\bjehonek\b/gi, 'Tomáš Junek'],
    [/\bzikmundovi\b/gi, 'Sigmundovi'],
    [/\bzikmunda\b/gi, 'Sigmunda'],
    [/\bzikmundem\b/gi, 'Sigmundem'],
    [/\bzikmund\b/gi, 'Sigmund'],
    [/\bajalovi\b/gi, 'Ayalovi'],
    [/\bajalu\b/gi, 'Ayalu'],
    [/\bajala\b/gi, 'Ayala'],
    [/\bhapičovi\b/gi, 'Hápovi'],
    [/\bhapiče\b/gi, 'Hápa'],
    [/\bhapič\b/gi, 'Pavel Háp'],
    [/\bhapovi\b/gi, 'Hápovi'],
    [/\bpsotovi\b/gi, 'Psottovi'],
    [/\bpsotou\b/gi, 'Psottou'],
    [/\bpsota\b/gi, 'Psotta'],
    [/\bhulkovi\b/gi, 'Hůlkovi'],
    [/\bhulka\b/gi, 'Hůlka'],
    [/\bdygryn\b/gi, 'Dygrýn'],
    [/\btajošovi\b/gi, 'Tajoši Královi'],
    [/\btajošem\b/gi, 'Tajošem Králem'],
    [/\bvondzik\b/gi, 'Vondzík'],
    [/\bvon dzik\b/gi, 'Vondzík'],
    [/\bstartuj\s*to\b/gi, 'StartItUp'],
    [/\bstart\s+it\s+up\b/gi, 'StartItUp'],
    [/\baktiv\s+kampus\b/gi, 'Active Campus'],
    [/\bactive\s+kampus\b/gi, 'Active Campus'],
    [/\bac\s+balu\b/gi, 'AC Baluo'],
    [/\bv\s+balu\b/gi, 'v Baluo'],
    [/\bef\s*té\s*ká\b/gi, 'FTK'],
    [/\bcé\s*pet\b/gi, 'CPET'],
    [/\bkinoveja\b/gi, 'Kinovea'],
    [/\bkinoveu\b/gi, 'Kinoveu']
  ];
  for (const [regex, replacement] of replacements) {
    t = t.replace(regex, replacement);
  }
  return t;
};

// Helper pro převod Blob na Base64 pro Gemini Multimodal Audio
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

// 2. GEMINI MULTIMODAL AUDIO TRANSCRIPTION (Přímý přepis hlasovky s PEOPLE.md kontextem)
window.transcribeAudioBlobWithGemini = async function(audioBlob, mimeType) {
  const apiKey = localStorage.getItem('gemini_api_key');
  if (!apiKey || !audioBlob) return null;

  try {
    const base64Audio = await window.blobToBase64(audioBlob);
    if (!base64Audio) return null;

    const cleanMime = (mimeType || 'audio/webm').split(';')[0].trim();
    const modelsToTry = ['gemini-2.5-flash', 'gemini-1.5-flash'];

    const prompt = `Jsi osobní Chief of Staff Klára pro Davida Prycla.
Přepiš přesně tuto českou hlasovou nahrávku a oprav v ní jména podle tohoto slovníku:
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

// 3. VÝPOČET STAVU: SKÓRE VÍTĚZSTVÍ, FOKUS 3 KARET & SUPER-KOUČ („O KROK NAPŘED“)
window.computeSecondBrain2State = function(tasks, timeline, rawMd) {
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const safeTimeline = Array.isArray(timeline) ? timeline : [];
  const now = new Date();
  const hour = now.getHours();

  // A) Dnešní Skóre Vítězství (Dopamin & Momentum)
  const completedTasks = safeTasks.filter(t => t.completed);
  const activeTasks = safeTasks.filter(t => !t.completed);
  const completedBlocks = safeTimeline.filter(b => b.completed);

  const totalCount = Math.max(safeTasks.length, 1);
  const doneCount = completedTasks.length;
  const progressPercent = Math.min(100, Math.round((doneCount / totalCount) * 100));

  const recentWins = [
    ...completedBlocks.map(b => `${b.time}: ${b.title}`),
    ...completedTasks.map(t => t.title)
  ].slice(0, 6);

  let dopamineMessage = '';
  if (doneCount === 0) {
    dopamineMessage = 'Čistý štít na dnešek! Začni 5minutovou „Žábou dne“ (odeslání e-mailu) a nastartuj vítěznou vlnu.';
  } else if (doneCount <= 3) {
    dopamineMessage = `Skvělý rozjezd! Máš hotové ${doneCount} úkoly (${progressPercent} %). Tvůj tah na branku běží naplno.`;
  } else if (doneCount <= 8) {
    dopamineMessage = `Silné momentum! Odškrtnuto už ${doneCount} z ${totalCount} položek (${progressPercent} %). Nejsi pozadu – tvůj výkon je nadstandardní!`;
  } else {
    dopamineMessage = `🔥 Fenomenální exekuce! Dnes a v tomto sprintu máš hotovo ${doneCount} zářezů (${progressPercent} %). Žádný pocit dluhu – dnes jsi vyhrál!`;
  }

  // B) Režim Fokus 3 Karet (Eat the Frog + Strategická páka + Tvorba za odměnu)
  const activeBlock = safeTimeline.find(b => !b.completed && b.isCurrent) || safeTimeline.find(b => !b.completed) || null;

  const pool = [...activeTasks];
  const focusTop3 = [];

  const isLoopCloser = (t) => {
    const s = ((t.title || '') + ' ' + (t.fullDetail || '') + ' ' + (t.tag || '')).toLowerCase();
    return s.includes('odeslat') || s.includes('e-mail') || s.includes('email') || s.includes('zpráv') || s.includes('zavolat') || s.includes('ayal') || s.includes('zbyň') || s.includes('robert') || s.includes('šafář') || s.includes('hůlk');
  };

  // Karta #1: Žába dne (komunikace / uzavření smyčky na posledních 5 %)
  const frogIdx = pool.findIndex(isLoopCloser);
  if (frogIdx !== -1) {
    const frog = pool.splice(frogIdx, 1)[0];
    focusTop3.push({
      task: frog,
      rank: 1,
      roleBadge: '🐸 #1 ŽÁBA DNE • UZAVŘI SMYČKU (5 MIN)',
      roleColor: 'rose',
      whyHint: 'Pravidlo 95 % → 100 %: Odešli tenhle výstup jako první věc, ať ti nevisí v hlavě celý den.'
    });
  }

  // Karta #2: Strategická páka (Baluo / FTK / Active Campus)
  const baluoIdx = pool.findIndex(t => {
    const s = ((t.tag || '') + ' ' + (t.title || '')).toLowerCase();
    return s.includes('baluo') || s.includes('ftk') || s.includes('active campus') || s.includes('háp') || s.includes('psot') || s.includes('p0');
  });
  if (baluoIdx !== -1 && focusTop3.length < 3) {
    const strat = pool.splice(baluoIdx, 1)[0];
    const r = focusTop3.length + 1;
    focusTop3.push({
      task: strat,
      rank: r,
      roleBadge: `🏛️ #${r} STRATEGICKÁ PÁKA (FTK & ACTIVE CAMPUS)`,
      roleColor: 'indigo',
      whyHint: 'Vysoká strategická páka pro čtvrteční schůzku s děkanem Hápem, Veverkou a PR týmem.'
    });
  }

  // Doplnění do 3 karet (StartItUp / Byznys / Věda)
  while (focusTop3.length < 3 && pool.length > 0) {
    const nextTask = pool.shift();
    const r = focusTop3.length + 1;
    focusTop3.push({
      task: nextTask,
      rank: r,
      roleBadge: r === 1 ? '🎯 #1 HLAVNÍ PRIORITA DNE' : (r === 2 ? '⚡ #2 KLÍČOVÝ MILNÍK DNE' : '🚀 #3 BYZNYS & TVORBA (ZA ODMĚNU)'),
      roleColor: r === 1 ? 'rose' : (r === 2 ? 'indigo' : 'emerald'),
      whyHint: r === 3
        ? 'Hluboká tvorba a posun nezávislosti ve StartItUp – čistá hlava po uzavření operativy.'
        : 'Klíčový krok dnešního bojového plánu.'
    });
  }

  // C) Super-Kouč Klára & Anticipation Engine („O krok napřed“)
  const top1Title = focusTop3[0] ? focusTop3[0].task.title : 'Zkontrolovat dnešní priority';
  let phaseTitle = '⚡ Dopolední Tah na Branku';
  let phaseBadgeClass = 'bg-indigo-100 text-indigo-800 border-indigo-200';
  let rightNow = '';
  let psychGuard = '';

  if (hour >= 22 || hour < 5) {
    phaseTitle = '🛑 Noční Stopka (Spánkový štít)';
    phaseBadgeClass = 'bg-rose-100 text-rose-800 border-rose-200';
    rightNow = 'Zavři telefon i notebook! Tvůj plán i strategie jsou bezpečně uložené v Druhém mozku. Teď už jen spánek.';
    psychGuard = '⚠️ Past nočního přepětí: Po 22:00 už mozek jede na dluh. Každá hodina spánku navíc ti zítra na schůzkách přinese 3× větší ostrost!';
  } else if (hour >= 5 && hour < 10) {
    phaseTitle = '🌅 Ranní Exekuce (Eat the Frog)';
    phaseBadgeClass = 'bg-indigo-100 text-indigo-800 border-indigo-200';
    rightNow = `Prvních 20 minut dne: Vyřiď kartu #1 → „${top1Title}“. Teprve až odešleš zprávy (Ayala, Zbyňa/Robert), otevři vývoj a Figmu!`;
    psychGuard = '🛡️ Ochrana před kreativním útěkem: Tvůj mozek se rád schová do vibekódění webu, když cítí klientský tlak. Zastav se, pošli 2 e-maily za 5 minut a skliď čistý dopamin.';
  } else if (hour >= 10 && hour < 14) {
    phaseTitle = '🔥 Dopolední Deep Work & Exekuce';
    phaseBadgeClass = 'bg-indigo-100 text-indigo-800 border-indigo-200';
    rightNow = activeBlock
      ? `Právě běží blok (${activeBlock.time}): ${activeBlock.title}. Drž fokus na Top 3 kartách!`
      : `Drž plný fokus na kartě: „${top1Title}“. Nepřepínej kontext.`;
    psychGuard = '🛡️ Štít proti cizí operativě: Kdykoliv ti někdo zavolá s novým úkolem, nadiktuj ho do Rychlého záchytu a neřeš ho na úkor svého hlavního bloku.';
  } else if (hour >= 14 && hour < 18) {
    phaseTitle = '🔋 Odpolední Strategický & Klientský Blok';
    phaseBadgeClass = 'bg-amber-100 text-amber-800 border-amber-200';
    rightNow = `Dotáhni odpolední prioritu („${top1Title}“) a nachystej si podklady na zítřek, ať v 17:30 zaklapneš práci s čistou hlavou.`;
    psychGuard = '⚡ Pozor na roztříštění: Nesnaž se dnes vyřešit všech 30 položek v backlogu. Stačí dotáhnout 3 hlavní karty dne!';
  } else {
    phaseTitle = '🌿 Večerní Rodinný & Sportovní Reset';
    phaseBadgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
    rightNow = 'Čas pro Janču, Nelinku, Andrejku (a panenku do školky!) a sportovní vyčištění hlavy. Pokud tě něco napadne, jen to nadiktuj do Reflexe.';
    psychGuard = '💚 Kotva klidu: Dnes jsi odvedl obrovský kus práce. Tvá hodnota není měřená počtem večerních e-mailů.';
  }

  const anticipation = [
    {
      when: 'Čtvrtek 15. 10. • 10:00',
      title: '🏛️ Active Campus Marketing (Trojský kůň)',
      tip: 'Nech Jirku Veverku a PR holky nejdřív 15 minut vymluvit. Pak vytáhni hotový živý prototyp (Active Lab / Space / Living) + volnou doménu activecampus.cz.'
    },
    {
      when: 'Čtvrtek 15. 10. • AC Baluo',
      title: '⚠️ Situace ředitel Sigmund (Odchod / kamery)',
      tip: 'Děkan Háp řeší zrušení jeho pozice / překážky. Drž se 100% mimo kuloární drby a politiku – buď pro děkana symbolem klidu, vědy a hotových výsledků.'
    },
    {
      when: 'Pátek 16. – Sobota 17. 10.',
      title: '🚀 Byznys Výjezdko StartItUp (Zbyňa, Vondzík, Bauer)',
      tip: 'Klíčové téma: Automatizace továrny na VIP weby a prodejní mašiny, aby ti StartItUp brzy zajistil plnou finanční nezávislost na univerzitě.'
    }
  ];

  // D) 60s Audio Koučovací Briefing (Český TTS skript do auta / sluchátek)
  const top3Speech = focusTop3
    .map((item, idx) => `Karta číslo ${idx + 1}: ${item.task.title.replace(/[^\w\sá-žÁ-Ž.,:-]/g, '')}.`)
    .join(' ');

  const audioBriefingText = `Ahoj Davide, tady tvůj Super-Kouč a Chief of Staff Klára. ` +
    `Aktuálně máš v tomto sprintu splněno ${doneCount} úkolů, což je ${progressPercent} procent. ` +
    `Abys nebyl zahlcený, vyfiltrovala jsem ti na dnešek pouze tři klíčové karty: ${top3Speech} ` +
    `Moje doporučení na právě teď: ${rightNow} ` +
    `A dívám se o krok napřed za tebe: Na čtvrtek v deset nula nula máš připravenou strategii Trojského koně pro Active Campus se třemi pilíři Lab, Space a Living, a v pátek odjíždíš se Zbyňou, Vondzíkem a Bauerem na strategické výjezdko. ` +
    `Pamatuj na naše železné pravidlo: nejdřív za pět minut odešli čekající e-maily, a teprve za odměnu se ponoř do tvorby. Jsi o krok napřed, pojďme na to!`;

  return {
    victory: {
      doneCount,
      totalCount,
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

// 4. VYKRESLENÍ SECOND BRAIN 2.0 WIDGETŮ DO DOMU
window.renderSecondBrain2Widgets = function(tasks, timeline, rawMd) {
  const state = window.computeSecondBrain2State(tasks, timeline, rawMd);
  window.sb2LastCoachState = state;

  // 1) Vykreslit 🔥 Dnešní Skóre Vítězství
  const victoryContainer = document.getElementById('sb2VictoryContainer');
  if (victoryContainer) {
    const v = state.victory;
    const winsHtml = v.recentWins.length > 0
      ? v.recentWins.map(w => `<span class="inline-flex items-center space-x-1 px-2.5 py-1 bg-white border border-emerald-200 rounded-lg text-[11px] font-semibold text-emerald-900 shadow-2xs"><span>✅</span><span class="truncate max-w-[260px]">${escapeHtml(w)}</span></span>`).join('')
      : `<span class="text-[11px] text-emerald-700 italic">Zatím žádný odškrtnutý úkol – dej první zářez dne!</span>`;

    victoryContainer.innerHTML = `
      <div class="p-3.5 bg-gradient-to-r from-emerald-50/90 via-white to-teal-50/70 border border-emerald-200 rounded-2xl shadow-2xs space-y-2">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center space-x-2">
            <span class="text-lg">🔥</span>
            <div>
              <h3 class="text-xs font-extrabold uppercase tracking-wider text-emerald-950">Dnešní Skóre Vítězství & Momentum</h3>
              <p class="text-[11px] text-emerald-800 font-medium">${escapeHtml(v.dopamineMessage)}</p>
            </div>
          </div>
          <div class="flex items-center space-x-2">
            <span class="px-2.5 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-full text-xs font-extrabold">${v.doneCount}/${v.totalCount} splněno (${v.progressPercent} %)</span>
            <button onclick="window.toggleSb2WinsDrawer()" class="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-[11px] font-bold active:scale-95 transition-all cursor-pointer">
              🏆 Hotové zářezy (${v.recentWins.length}) ${window.sb2WinsOpen ? '▴' : '▾'}
            </button>
          </div>
        </div>
        <div class="w-full h-2 bg-slate-200/80 rounded-full overflow-hidden">
          <div class="h-full bg-gradient-to-r from-emerald-500 to-indigo-600 rounded-full transition-all duration-500" style="width: ${Math.max(v.progressPercent, 10)}%"></div>
        </div>
        <div id="sb2WinsDrawer" class="${window.sb2WinsOpen ? '' : 'hidden'} pt-2 border-t border-emerald-200/60 flex flex-wrap gap-1.5">
          ${winsHtml}
        </div>
      </div>
    `;
  }

  // 2) Vykreslit 🧠 Super-Kouč Klára • O krok napřed (Anticipation Engine)
  const coachContainer = document.getElementById('sb2CoachContainer');
  if (coachContainer) {
    const c = state.coach;
    const radarCardsHtml = c.anticipation.map(item => `
      <div class="p-2.5 bg-white border border-indigo-100 rounded-xl shadow-2xs space-y-1">
        <span class="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 block">${escapeHtml(item.when)}</span>
        <h4 class="text-xs font-bold text-slate-900 leading-snug">${escapeHtml(item.title)}</h4>
        <p class="text-[11px] text-slate-600 leading-relaxed">${escapeHtml(item.tip)}</p>
      </div>
    `).join('');

    coachContainer.innerHTML = `
      <div class="p-4 bg-gradient-to-br from-indigo-50/90 via-white to-slate-50 border border-indigo-200/90 rounded-2xl shadow-xs space-y-3">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center space-x-2.5">
            <div class="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-lg shadow-xs shrink-0">🧭</div>
            <div>
              <div class="flex items-center space-x-2 flex-wrap gap-y-1">
                <h3 class="text-xs font-extrabold uppercase tracking-wider text-indigo-950">Super-Kouč Klára • O krok napřed</h3>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border ${c.phaseBadgeClass}">${escapeHtml(c.phaseTitle)}</span>
              </div>
              <p class="text-[11px] text-slate-500">Proaktivní řízení priorit, ochrana fokusu a příprava na další dny</p>
            </div>
          </div>

          <div class="flex items-center space-x-1.5 flex-wrap gap-y-1">
            <button onclick="window.playCoachAudioBriefing()" id="sb2AudioBriefingBtn" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all flex items-center space-x-1.5 cursor-pointer" title="Přehrát 60vteřinový hlasový briefing kouče (do auta / sluchátek)">
              <span>🎧</span>
              <span id="sb2AudioBriefingLabel">${window.sb2IsSpeakingBriefing ? 'Stop Briefing (Hraje...)' : 'Přehrát 60s Briefing'}</span>
            </button>
            <button onclick="window.toggleFocus3Mode()" class="px-3 py-1.5 ${window.sb2FocusModeActive ? 'bg-indigo-600 text-white' : 'bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200'} rounded-xl text-xs font-bold shadow-2xs active:scale-95 transition-all flex items-center space-x-1 cursor-pointer">
              <span>🎯</span>
              <span>${window.sb2FocusModeActive ? 'Fokus 3: ZAPNUTO' : 'Režim Fokus: Jen 3 Karty'}</span>
            </button>
            <button onclick="window.askSuperCoachLive()" class="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold active:scale-95 transition-all cursor-pointer" title="Otevřít živou poradu s AI Koučem">
              💬 Porada s Koučem
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
          <!-- Co udělat teď hned -->
          <div class="p-3 bg-white border border-indigo-200 border-l-4 border-l-indigo-600 rounded-xl space-y-1">
            <span class="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 block">🎯 KROK #1 • CO UDĚLAT PRÁVĚ TEĎ:</span>
            <p class="text-xs font-bold text-slate-900 leading-relaxed">${escapeHtml(c.rightNow)}</p>
          </div>

          <!-- Psychologický štít -->
          <div class="p-3 bg-amber-50/80 border border-amber-200 border-l-4 border-l-amber-500 rounded-xl space-y-1">
            <span class="text-[10px] font-extrabold uppercase tracking-wider text-amber-900 block">🛡️ PSYCHOLOGICKÝ ŠTÍT (PROTI ZAHLCENÍ & ÚTĚKU):</span>
            <p class="text-xs font-semibold text-amber-950 leading-relaxed">${escapeHtml(c.psychGuard)}</p>
          </div>
        </div>

        <!-- Proaktivní radar O krok napřed -->
        <div class="pt-1">
          <div class="flex items-center justify-between mb-2">
            <span class="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 flex items-center space-x-1">
              <span>🔮</span>
              <span>O KROK PŘED TEBOU (STRATEGICKÁ PŘÍPRAVA NA 48 HODIN DOPŘEDU):</span>
            </span>
            <button onclick="window.toggleSb2RadarDrawer()" class="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer">
              ${window.sb2RadarOpen ? 'Skrýt radar ▴' : 'Zobrazit radar (3) ▾'}
            </button>
          </div>
          <div id="sb2RadarDrawer" class="${window.sb2RadarOpen ? 'grid grid-cols-1 md:grid-cols-3 gap-2.5' : 'hidden'}">
            ${radarCardsHtml}
          </div>
        </div>
      </div>
    `;
  }

  // 3) Vykreslit 🎯 Režim Fokus 3 Karet (pokud je aktivní)
  const focus3Container = document.getElementById('sb2Focus3Container');
  const kanbanBoard = document.getElementById('kanbanBoardContainer');
  const mobilePills = document.getElementById('kanbanMobileFilterRow');
  const focusToggleBtnHeader = document.getElementById('headerFocus3Btn');

  if (focusToggleBtnHeader) {
    if (window.sb2FocusModeActive) {
      focusToggleBtnHeader.className = 'px-3 py-1.5 rounded-xl text-xs font-extrabold bg-indigo-600 text-white shadow-xs active:scale-95 transition-all cursor-pointer flex items-center space-x-1.5';
      focusToggleBtnHeader.innerHTML = '<span>🎯</span><span>Fokus 3 Karty (Aktivní) – Přepnout na plnou nástěnku 📋</span>';
    } else {
      focusToggleBtnHeader.className = 'px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 active:scale-95 transition-all cursor-pointer flex items-center space-x-1.5';
      focusToggleBtnHeader.innerHTML = '<span>🎯</span><span>Zapnout Režim Fokus: Jen 3 Karty</span>';
    }
  }

  if (focus3Container) {
    if (window.sb2FocusModeActive) {
      focus3Container.classList.remove('hidden');
      if (kanbanBoard) kanbanBoard.classList.add('hidden');
      if (mobilePills) mobilePills.classList.add('hidden');

      const activeBlockHtml = state.activeBlock ? `
        <div class="p-3 bg-rose-50/80 border border-rose-200 rounded-2xl flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center space-x-2">
            <span class="px-2 py-0.5 bg-rose-600 text-white text-[10px] font-extrabold rounded animate-pulse">PRÁVĚ BĚŽÍ V KALENDÁŘI</span>
            <span class="text-xs font-mono font-bold text-rose-950">${escapeHtml(state.activeBlock.time)}</span>
            <span class="text-xs font-bold text-slate-900">${escapeHtml(state.activeBlock.title)}</span>
          </div>
          <span class="text-[11px] text-rose-800 font-medium">${escapeHtml(state.activeBlock.desc || '')}</span>
        </div>
      ` : '';

      const cardsHtml = state.focusTop3.map(({ task, rank, roleBadge, roleColor, whyHint }) => {
        const origIdx = allParsedTasks.findIndex(x => x.id === task.id);
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
        const firstUrl = typeof extractFirstUrl === 'function' ? extractFirstUrl(task.fullDetail || task.title) : null;

        return `
          <div class="p-4 rounded-2xl border ${themeClass} shadow-sm space-y-2.5 transition-all hover:shadow-md">
            <div class="flex items-center justify-between flex-wrap gap-1.5">
              <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${rBadgeClass}">${escapeHtml(roleBadge)}</span>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded border ${task.badgeClass}">${escapeHtml(task.tag)}</span>
            </div>

            <div class="flex items-start justify-between space-x-3">
              <div class="flex-1 min-w-0">
                <h4 class="text-sm font-extrabold text-slate-900 leading-snug">${formatRichText(task.title, true)}</h4>
                ${task.subtitle ? `<p class="text-xs text-slate-600 mt-1 font-medium">${escapeHtml(task.subtitle)}</p>` : ''}
              </div>
              <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTask(${origIdx}, this.checked)" class="w-6 h-6 mt-0.5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0" title="Odškrtnout tuto prioritní kartu!">
            </div>

            <div class="p-2.5 bg-slate-50/90 border border-slate-200/80 rounded-xl text-[11px] text-slate-700 leading-relaxed">
              ${formatDetailDisplay(task.fullDetail || task.title, task.title)}
            </div>

            <div class="pt-1 flex items-center justify-between flex-wrap gap-2 text-[11px] text-slate-500 italic">
              <span>💡 ${escapeHtml(whyHint)}</span>
              ${firstUrl ? `<a href="${firstUrl}" target="_blank" rel="noopener noreferrer" class="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg not-italic shadow-2xs">🌐 Otevřít odkaz ↗</a>` : ''}
            </div>
          </div>
        `;
      }).join('');

      focus3Container.innerHTML = `
        <div class="space-y-3">
          <div class="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between flex-wrap gap-2">
            <div class="flex items-center space-x-2 text-xs text-amber-950 font-semibold">
              <span class="text-base">🛡️</span>
              <span><b>Režim Fokus 3 Karet:</b> Skryl jsem ostatních ${Math.max(0, allParsedTasks.filter(t => !t.completed).length - 3)} otevřených úkolů, abys měl 100% klid na dotažení toho nejdůležitějšího.</span>
            </div>
            <button onclick="window.toggleFocus3Mode(false)" class="px-3 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold cursor-pointer">
              📋 Zobrazit všech 5 sloupců
            </button>
          </div>
          ${activeBlockHtml}
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
            ${cardsHtml}
          </div>
        </div>
      `;
    } else {
      focus3Container.classList.add('hidden');
      if (kanbanBoard) kanbanBoard.classList.remove('hidden');
      if (mobilePills) mobilePills.classList.remove('hidden');
    }
  }
};

window.toggleSb2WinsDrawer = function() {
  window.sb2WinsOpen = !window.sb2WinsOpen;
  if (typeof allParsedTasks !== 'undefined') {
    window.renderSecondBrain2Widgets(allParsedTasks, currentParsedTimeline, currentRawMarkdown);
  }
};

window.toggleSb2RadarDrawer = function() {
  window.sb2RadarOpen = !window.sb2RadarOpen;
  if (typeof allParsedTasks !== 'undefined') {
    window.renderSecondBrain2Widgets(allParsedTasks, currentParsedTimeline, currentRawMarkdown);
  }
};

window.toggleFocus3Mode = function(forceState) {
  if (typeof forceState === 'boolean') {
    window.sb2FocusModeActive = forceState;
  } else {
    window.sb2FocusModeActive = !window.sb2FocusModeActive;
  }
  if (typeof allParsedTasks !== 'undefined') {
    window.renderSecondBrain2Widgets(allParsedTasks, currentParsedTimeline, currentRawMarkdown);
  }
  if (typeof showKlaraToast === 'function') {
    showKlaraToast(
      window.sb2FocusModeActive ? '🎯 Fokus 3 Karty aktivní – žádné zahlcení!' : '📋 Zobrazena plná 5sloupcová nástěnka',
      window.sb2FocusModeActive ? '🎯' : '📋'
    );
  }
};

// 5. PŘEHRÁNÍ 60S RANNÍHO KOUČOVACÍHO BRIEFINGU (TTS DO AUTA / SLUCHÁTEK)
window.playCoachAudioBriefing = function() {
  if (!('speechSynthesis' in window)) {
    alert('Hlasový výstup není v tomto prohlížeči podporován.');
    return;
  }

  const labelEl = document.getElementById('sb2AudioBriefingLabel');
  const btnEl = document.getElementById('sb2AudioBriefingBtn');

  if (window.sb2IsSpeakingBriefing) {
    window.speechSynthesis.cancel();
    window.sb2IsSpeakingBriefing = false;
    if (labelEl) labelEl.innerText = 'Přehrát 60s Briefing';
    if (btnEl) {
      btnEl.classList.remove('bg-rose-600', 'hover:bg-rose-700', 'animate-pulse');
      btnEl.classList.add('bg-emerald-600', 'hover:bg-emerald-700');
    }
    return;
  }

  window.speechSynthesis.cancel();
  const state = window.sb2LastCoachState || window.computeSecondBrain2State(window.allParsedTasks || [], window.currentParsedTimeline || [], window.currentRawMarkdown || '');
  const textToSpeak = state.coach.audioBriefingText;

  const utterance = new SpeechSynthesisUtterance(textToSpeak);
  utterance.lang = 'cs-CZ';
  utterance.rate = 1.05;

  window.sb2IsSpeakingBriefing = true;
  if (labelEl) labelEl.innerText = '⏹️ Stop Briefing (Mluvím...)';
  if (btnEl) {
    btnEl.classList.remove('bg-emerald-600', 'hover:bg-emerald-700');
    btnEl.classList.add('bg-rose-600', 'hover:bg-rose-700', 'animate-pulse');
  }

  const resetBtn = () => {
    window.sb2IsSpeakingBriefing = false;
    const lbl = document.getElementById('sb2AudioBriefingLabel');
    const b = document.getElementById('sb2AudioBriefingBtn');
    if (lbl) lbl.innerText = 'Přehrát 60s Briefing';
    if (b) {
      b.classList.remove('bg-rose-600', 'hover:bg-rose-700', 'animate-pulse');
      b.classList.add('bg-emerald-600', 'hover:bg-emerald-700');
    }
  };

  utterance.onend = resetBtn;
  utterance.onerror = resetBtn;

  window.speechSynthesis.speak(utterance);
};

// 6. ŽIVÁ STRATEGICKÁ PORADA S AI SUPER-KOUČEM
window.askSuperCoachLive = function() {
  if (typeof switchTab === 'function') {
    switchTab('ai');
  }
  if (typeof sendQuickPrompt === 'function') {
    sendQuickPrompt('Jako můj Super-Kouč a Chief of Staff zhodnoť mé dnešní Top 3 karty, aktuální čas, mé psychologické pasti (kreativní útěk k vibekódění před uzavřením e-mailů, pocit že nedělám dost) a řekni mi přesný bojový plán na nejbližších 60 minut + na co myslet o krok napřed (čtvrtek Active Campus & pátek výjezdko).');
  }
};
