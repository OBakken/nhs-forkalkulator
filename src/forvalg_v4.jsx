import { useState, useMemo } from "react";

// ============================================================
// NHS Fôrkalkulator — Fôrvalg-side v4
// ============================================================
// Endringer v3 → v4:
//   - Liter/kg-toggle for kraftfôr med egenvektstabell
//   - Nye fôrtyper: Hvetekli, Bygg (valset)
//   - «Vei din boks»-kalibrering for nøyaktig litermåling
//   - Pedagogisk InfoBox om volum vs. vekt (kilden: PDF side 34)
//   - Densitetsverdier (kg/liter) for alle produkter
// ============================================================

// --- GROVFÔR DATA (SPEC seksjon 5) ---
const ROUGHAGE_TYPES = [
  { id: "hoy", label: "Høy", shortLabel: "Høy 87%", ts: 87 },
  { id: "ens_55", label: "Ensilasje – svært fuktig", shortLabel: "Ensilasje våt 55%", ts: 55, group: "ensilasje" },
  { id: "ens_65", label: "Ensilasje – fuktig", shortLabel: "Ensilasje fuktig 65%", ts: 65, group: "ensilasje" },
  { id: "ens_72", label: "Fortørka ensilasje – normal", shortLabel: "Ensilasje normal 72%", ts: 72, group: "ensilasje", default: true },
  { id: "ens_78", label: "Fortørka ensilasje – tørr", shortLabel: "Ensilasje tørr 78%", ts: 78, group: "ensilasje" },
  { id: "ens_82", label: "Veldig tørr ensilasje", shortLabel: "Ensilasje/høy 82%", ts: 82, group: "ensilasje" },
  { id: "halm", label: "Halm", shortLabel: "Halm 85%", ts: 85 },
];

const CUTTING_TIMES = [
  { id: "tidlig", label: "Tidlig slått", FEh: 0.60, protein: 80, Ca: 4.0, P: 2.5, lysin: 4.1, desc: "Høy energi, mye protein" },
  { id: "middels", label: "Middels slått", FEh: 0.55, protein: 60, Ca: 3.4, P: 2.2, lysin: 3.2, desc: "Balansert — vanligst", default: true },
  { id: "sent", label: "Sent slått", FEh: 0.50, protein: 40, Ca: 2.8, P: 1.8, lysin: 2.0, desc: "Mye fiber, mindre energi" },
  { id: "halm", label: "Halm", FEh: 0.23, protein: 0, Ca: 0, P: 0, lysin: 0, desc: "Fiber og metthet" },
];

// --- KRAFTFÔR DATA (SPEC seksjon 6 + nye: Hvetekli, Bygg) ---
// density = kg per liter (gjennomsnittstall for volumberegning)
// form: "pellets" | "korn" | "musli" | "fiber" — brukes for standard egenvekt
const CONCENTRATES = [
  // Champion
  { id: "ch_komplett", name: "Komplett", supplier: "Champion", FEh: 0.88, protein: 75, Ca: 7, P: 4, cat: "basis", form: "pellets", density: 0.70 },
  { id: "ch_energi", name: "Energi", supplier: "Champion", FEh: 0.98, protein: 75, Ca: 10, P: 5, cat: "sport", form: "pellets", density: 0.70 },
  { id: "ch_oppdrett", name: "Oppdrett", supplier: "Champion", FEh: 0.88, protein: 130, Ca: 16, P: 7, cat: "oppdrett", form: "pellets", density: 0.70 },
  { id: "ch_havre", name: "Havre (hel)", supplier: "Champion", FEh: 0.80, protein: 68, Ca: 0.6, P: 3.1, cat: "korn", form: "korn", density: 0.52 },
  { id: "ch_betfiber", name: "Betfiber", supplier: "Champion", FEh: 0.98, protein: 40, Ca: 6, P: 1, cat: "fiber", form: "fiber", density: 0.55 },
  { id: "ch_gull", name: "Gull", supplier: "Champion", FEh: 0.99, protein: 80, Ca: 10, P: 5, cat: "sport", form: "pellets", density: 0.70 },
  { id: "ch_ekstrem", name: "Ekstrem", supplier: "Champion", FEh: 1.10, protein: 83, Ca: 10, P: 6, cat: "sport", form: "pellets", density: 0.70 },
  { id: "ch_diamant", name: "Diamant", supplier: "Champion", FEh: 0.88, protein: 70, Ca: 12.2, P: 4, cat: "basis", form: "pellets", density: 0.70 },
  { id: "ch_foll", name: "Føll", supplier: "Champion", FEh: 1.00, protein: 150, Ca: 25, P: 10, cat: "oppdrett", form: "pellets", density: 0.70 },
  { id: "ch_spenst", name: "Spenst", supplier: "Champion", FEh: 0.95, protein: 80, Ca: 5, P: 1.6, cat: "sport", form: "musli", density: 0.45 },
  { id: "ch_superfiber", name: "Superfiber", supplier: "Champion", FEh: 0.84, protein: 100, Ca: 10, P: 3, cat: "fiber", form: "fiber", density: 0.55 },
  { id: "ch_luserne_o3", name: "Luserne Omega-3", supplier: "Champion", FEh: 0.80, protein: 85, Ca: 11, P: 2, cat: "fiber", form: "fiber", density: 0.55 },
  { id: "ch_luserne", name: "Lusernepellets", supplier: "Champion", FEh: 0.60, protein: 100, Ca: 10, P: 3, cat: "fiber", form: "pellets", density: 0.55 },
  { id: "ch_gras", name: "Graspellets", supplier: "Champion", FEh: 0.59, protein: 95, Ca: 8, P: 2.9, cat: "fiber", form: "pellets", density: 0.55 },
  { id: "ch_vital", name: "Vital", supplier: "Champion", FEh: 1.10, protein: 87, Ca: 15.5, P: 17, cat: "spesial", form: "pellets", density: 0.70 },
  { id: "ch_linomega", name: "Linomega", supplier: "Champion", FEh: 1.10, protein: 165, Ca: 5, P: 5, cat: "spesial", form: "pellets", density: 0.70 },
  { id: "ch_mais", name: "Mikronisert Mais", supplier: "Champion", FEh: 1.05, protein: 60, Ca: 0.1, P: 2.5, cat: "korn", form: "korn", density: 0.55 },
  { id: "ch_soya", name: "Soyapellets", supplier: "Champion", FEh: 0.98, protein: 420, Ca: 3, P: 6.3, cat: "spesial", form: "pellets", density: 0.70 },
  // Rene fôrmidler (nye)
  { id: "rf_hvetekli", name: "Hvetekli", supplier: "Rent fôrmiddel", FEh: 0.77, protein: 120, Ca: 0.95, P: 10.0, cat: "korn", form: "korn", density: 0.25 },
  { id: "rf_bygg", name: "Bygg (valset)", supplier: "Rent fôrmiddel", FEh: 1.00, protein: 80, Ca: 0.40, P: 3.5, cat: "korn", form: "korn", density: 0.42 },
  // Norgesfôr
  { id: "nf_balanse", name: "Pioner Balanse", supplier: "Norgesfôr", FEh: 0.86, protein: 85, Ca: 21, P: 7.5, form: "pellets", density: 0.70 },
  { id: "nf_oppdrett", name: "Pioner Oppdrett", supplier: "Norgesfôr", FEh: 0.91, protein: 135, Ca: 17, P: 8, form: "pellets", density: 0.70 },
  { id: "nf_sport", name: "Pioner Sport", supplier: "Norgesfôr", FEh: 0.97, protein: 85, Ca: 18, P: 6, form: "pellets", density: 0.70 },
  { id: "nf_standard", name: "Pioner Standard", supplier: "Norgesfôr", FEh: 0.89, protein: 85, Ca: 9.2, P: 4, form: "pellets", density: 0.70 },
  { id: "nf_super", name: "Pioner Super", supplier: "Norgesfôr", FEh: 0.99, protein: 80, Ca: 12, P: 6, form: "pellets", density: 0.70 },
  { id: "nf_trivsel", name: "Pioner Trivsel", supplier: "Norgesfôr", FEh: 0.82, protein: 127, Ca: 15, P: 5.6, form: "pellets", density: 0.70 },
  { id: "nf_roe", name: "Roeblanding", supplier: "Norgesfôr", FEh: 0.90, protein: 50, Ca: 7.6, P: 2.1, form: "fiber", density: 0.55 },
];

// --- TILSKUDD DATA ---
const SUPPLEMENTS = [
  { id: "su_multi_pel", name: "Multitilskudd (pellets)", supplier: "Champion", FEh: 0.4, protein: 32, Ca: 120, P: 60, unit: "g", typical: 100 },
  { id: "su_multi_pul", name: "Multitilskudd (pulver)", supplier: "Champion", FEh: 0.1, protein: 1, Ca: 150, P: 75, unit: "g", typical: 50 },
  { id: "su_soyaolje", name: "Soyaolje m/E-vit", supplier: "Champion", FEh: 3.2, protein: 0, Ca: 0, P: 0, unit: "ml", typical: 50 },
  { id: "su_omega3", name: "Omega-3 olje", supplier: "Champion", FEh: 3.2, protein: 0, Ca: 0, P: 0, unit: "ml", typical: 50 },
  { id: "su_kalsium", name: "Kalsiumtilskudd", supplier: "Champion", FEh: 0, protein: 0, Ca: 370, P: 0, unit: "g", typical: 30 },
  { id: "su_salt", name: "Saltstein", supplier: "Champion", FEh: 0, protein: 0, Ca: 1, P: 0, unit: "fri", typical: 0 },
  { id: "su_vm", name: "VM-Blokk", supplier: "Champion", FEh: 0.02, protein: 8, Ca: 145, P: 50, unit: "g", typical: 30 },
  { id: "su_elektro", name: "Elektrolytter", supplier: "Champion", FEh: 0.7, protein: 4, Ca: 12, P: 0, unit: "g", typical: 30 },
  { id: "su_bvit", name: "B-Vitamin", supplier: "Champion", FEh: 0, protein: 0, Ca: 0, P: 0, unit: "g", typical: 10 },
  { id: "su_biotin", name: "Biotin", supplier: "Champion", FEh: 1.0, protein: 12, Ca: 0, P: 0, unit: "g", typical: 15 },
  { id: "su_yea", name: "Yea-Sacc", supplier: "Champion", FEh: 0.87, protein: 115, Ca: 1, P: 2.6, unit: "g", typical: 10 },
];

// --- BCS FAKTOR ---
const BCS_FACTORS = { 1: 1.2, 2: 1.1, 3: 1.0, 4: 0.9, 5: 0.8 };
// ============================================================
// SPEC v2.4: Tabeller og hjelpefunksjoner fra PDF «Fôring av hest»
// Synkronisert med registrering_v5
// ============================================================
const GROWTH_CURVE = {
  0: 10, 3: 30, 6: 47, 9: 58, 12: 67, 15: 75, 18: 82,
  21: 86, 24: 89, 27: 92, 30: 94, 33: 96, 36: 97,
};
function growthPct(ageMonths) {
  if (ageMonths <= 0) return 10;
  if (ageMonths >= 36) return 97;
  const keys = Object.keys(GROWTH_CURVE).map(Number).sort((a, b) => a - b);
  for (let i = 0; i < keys.length - 1; i++) {
    if (ageMonths >= keys[i] && ageMonths <= keys[i + 1]) {
      const t = (ageMonths - keys[i]) / (keys[i + 1] - keys[i]);
      return GROWTH_CURVE[keys[i]] + t * (GROWTH_CURVE[keys[i + 1]] - GROWTH_CURVE[keys[i]]);
    }
  }
  return 97;
}
const DAILY_GAIN_500 = {
  3: 1093, 6: 765, 9: 546, 12: 464, 15: 410, 18: 301,
  21: 191, 24: 164, 27: 137, 30: 109, 33: 82, 36: 55,
};
function dailyGain(ageMonths, adultWeight) {
  if (ageMonths <= 0 || ageMonths >= 36) return 0;
  const keys = Object.keys(DAILY_GAIN_500).map(Number).sort((a, b) => a - b);
  let gain500 = 55;
  if (ageMonths <= 3) {
    gain500 = DAILY_GAIN_500[3];
  } else {
    for (let i = 0; i < keys.length - 1; i++) {
      if (ageMonths >= keys[i] && ageMonths <= keys[i + 1]) {
        const t = (ageMonths - keys[i]) / (keys[i + 1] - keys[i]);
        gain500 = DAILY_GAIN_500[keys[i]] + t * (DAILY_GAIN_500[keys[i + 1]] - DAILY_GAIN_500[keys[i]]);
        break;
      }
    }
  }
  return gain500 * (adultWeight / 500);
}
function youngMaintenanceCoeff(ageMonths) {
  if (ageMonths <= 6) return 0.047;
  if (ageMonths <= 12) return 0.044;
  return 0.042;
}
const YOUNG_PROTEIN_RATIO = { 3: 180, 6: 130, 12: 95, 18: 85, 24: 80, 30: 80, 36: 80 };
function youngProteinRatio(ageMonths) {
  if (ageMonths <= 3) return 180;
  if (ageMonths >= 36) return 80;
  const keys = Object.keys(YOUNG_PROTEIN_RATIO).map(Number).sort((a, b) => a - b);
  for (let i = 0; i < keys.length - 1; i++) {
    if (ageMonths >= keys[i] && ageMonths <= keys[i + 1]) {
      const t = (ageMonths - keys[i]) / (keys[i + 1] - keys[i]);
      return Math.round(YOUNG_PROTEIN_RATIO[keys[i]] + t * (YOUNG_PROTEIN_RATIO[keys[i + 1]] - YOUNG_PROTEIN_RATIO[keys[i]]));
    }
  }
  return 80;
}
// Mineraler voksen (SPEC v2.6 seksjon 5D — NRC 2007 × 1,25, gram per 100 kg)
const ADULT_MINERALS = {
  vedlikehold: { ca: 5.00, p: 3.50 },
  lett:        { ca: 7.50, p: 4.53 },
  moderat:     { ca: 8.75, p: 5.25 },
  hard:        { ca: 10.00, p: 7.25 },
  intens:      { ca: 11.25, p: 8.25 },
  drektig_9:   { ca: 7.75,  p: 5.50 },
  drektig_10:  { ca: 8.50,  p: 6.00 },
  drektig_11:  { ca: 9.00,  p: 6.50 },
};

// Laktasjon: individuelle månedsverdier (SPEC v2.6 seksjon 5C — NRC 2007 × 1,25)
const LACT_MINERALS_PER_100KG = {
  1: { ca: 14.75, p: 9.50 },
  2: { ca: 14.25, p: 9.25 },
  3: { ca: 14.00, p: 9.00 },
  4: { ca: 12.00, p: 7.50 },
  5: { ca: 10.00, p: 6.25 },
  6: { ca:  9.00, p: 5.50 },
};

function adultMinerals(level, pregMonth, lactMonth) {
  if (lactMonth >= 1 && lactMonth <= 6) {
    return LACT_MINERALS_PER_100KG[lactMonth] || LACT_MINERALS_PER_100KG[6];
  }
  if (pregMonth >= 11) return ADULT_MINERALS.drektig_11;
  if (pregMonth >= 10) return ADULT_MINERALS.drektig_10;
  if (pregMonth >= 9)  return ADULT_MINERALS.drektig_9;
  const keys = ["vedlikehold", "lett", "moderat", "hard", "intens"];
  return ADULT_MINERALS[keys[level] || "vedlikehold"];
}
const LACT_ENERGY_LARGE = { 1: 0.80, 2: 0.83, 3: 0.83, 4: 0.66, 5: 0.66, 6: 0.66 };
const LACT_ENERGY_SMALL = { 1: 0.96, 2: 0.97, 3: 0.97, 4: 0.79, 5: 0.79, 6: 0.79 };
const LACT_MILK_LARGE = { 1: 2.5, 2: 3.0, 3: 3.0, 4: 2.5, 5: 2.5, 6: 2.5 };
const LACT_MILK_SMALL = { 1: 3.0, 2: 3.5, 3: 3.5, 4: 3.0, 5: 3.0, 6: 3.0 };
const LACT_PROT_PER_KG_MILK = { 1: 50, 2: 44, 3: 44, 4: 40, 5: 40, 6: 40 };
const PREG_PROTEIN_PER_100KG = { 8: 12, 9: 25, 10: 33, 11: 50 };


// --- BEREGNINGSMOTOR (SPEC v2.4, PDF «Fôring av hest» s. 206-215) ---
function calculateNeeds(horse) {
  const w = horse.weight;
  const isYoung = horse.growthStage && horse.growthStage !== "adult";
  const lm = horse.lactMonth || 0;
  const applyBcs = !(isYoung && horse.ageMonths < 12);
  const bcsFactor = (applyBcs && horse.bcs) ? (BCS_FACTORS[horse.bcs] || 1.0) : 1.0;

  if (isYoung) {
    // ═══ UNGHEST — SPEC v2.4 / PDF formler ═══
    const age = horse.ageMonths;
    const pct = growthPct(age);
    const currentWeight = w * pct / 100;
    const dtv = dailyGain(age, w) / 1000;
    const koeff = youngMaintenanceCoeff(age);
    const metW = Math.pow(currentWeight, 0.75);
    const fehVedlikehold = koeff * metW;
    const fehVekst = dtv > 0
      ? dtv * (1350 + 67.94 * age - 1.093 * age * age) / 1000
      : 0;
    const tFactors = [0, 0.20, 0.40, 0.60];
    const cappedLevel = Math.min(horse.trainingLevel, 3);
    const tF = tFactors[cappedLevel] || 0;
    // Oppdrettstillegg (PDF: +25 % intensiv, +10 % utegang i flokk)
    let rearingF = 0;
    if (horse.youngIntensiveRearing) rearingF += 0.25;
    if (horse.youngOutdoorHerd) rearingF += 0.10;
    const fehBeforeBcs = (fehVedlikehold + fehVekst) * (1 + tF + rearingF);
    const fehFinal = fehBeforeBcs * bcsFactor;
    const protRatio = youngProteinRatio(age);
    const proteinTotal = fehFinal * protRatio;
    const ca = (currentWeight * 0.072 + 32 * dtv) * 1.25;
    const p = (currentWeight * 0.040 + 17.8 * dtv) * 1.25;
    return {
      FEh: parseFloat(fehFinal.toFixed(2)),
      FEh_unadjusted: parseFloat(fehBeforeBcs.toFixed(2)),
      protein: Math.round(proteinTotal),
      proteinRatio: protRatio,
      Ca: parseFloat(ca.toFixed(1)),
      P: parseFloat(p.toFixed(1)),
      bcsFactor,
      FEh_base: parseFloat(fehVedlikehold.toFixed(2)),
    };
  }

  // ═══ VOKSEN — SPEC v2.4 / PDF formler ═══
  const tf = horse.typeFactor || 1.0;
  const sf = horse.isStal ? 1.1 : 1.0;
  const metW = Math.pow(w, 0.75);
  const base = 0.0373 * metW * tf * sf;
  const trainingFactors = [0, 0.25, 0.50, 0.75, 1.00];
  const tF = trainingFactors[horse.trainingLevel] || 0;
  const fehTrening = base * tF;
  const pregFactors = { 0: 0, 9: 0.15, 10: 0.25, 11: 0.30 };
  const dF = pregFactors[horse.pregMonth] || 0;
  const fehDrekt = base * dF;
  let lactFEh = 0;
  if (lm > 0) {
    const lactTable = w < 200 ? LACT_ENERGY_SMALL : LACT_ENERGY_LARGE;
    lactFEh = (lactTable[lm] || 0) * w / 100;
  }
  const fehBeforeBcs = base + fehTrening + fehDrekt + lactFEh;
  const fehFinal = fehBeforeBcs * bcsFactor;

  // Protein — 80 g/FEh for vedlikehold + trening + drektighet (PDF s. 213)
  let proteinBase = (base + fehTrening + fehDrekt) * 80;
  let proteinDrekt = 0;
  if (horse.pregMonth >= 8) {
    proteinDrekt = (PREG_PROTEIN_PER_100KG[horse.pregMonth] || 0) * w / 100;
  }
  let proteinLakt = 0;
  if (lm > 0) {
    const milkTable = w < 200 ? LACT_MILK_SMALL : LACT_MILK_LARGE;
    const milkKgDay = (milkTable[lm] || 0) * w / 100;
    proteinLakt = milkKgDay * (LACT_PROT_PER_KG_MILK[lm] || 0);
  }
  const proteinTotal = proteinBase + proteinDrekt + proteinLakt;

  // Mineraler voksen
  const minerals = adultMinerals(horse.trainingLevel, horse.pregMonth, lm);
  const ca = minerals.ca * w / 100;
  const p = minerals.p * w / 100;

  return {
    FEh: parseFloat(fehFinal.toFixed(2)),
    FEh_unadjusted: parseFloat(fehBeforeBcs.toFixed(2)),
    protein: Math.round(proteinTotal),
    proteinRatio: 80,
    Ca: parseFloat(ca.toFixed(1)),
    P: parseFloat(p.toFixed(1)),
    bcsFactor,
    FEh_base: parseFloat(base.toFixed(2)),
  };
}

// --- FARGEFUNKSJONER ---
function getNutrientColor(pct) {
  if (pct < 80) return { color: "#c0392b", label: "Mangler" };
  if (pct < 90) return { color: "#e67e22", label: "Noe lavt" };
  if (pct <= 120) return { color: "#27ae60", label: "Dekket" };
  return { color: "#2980b9", label: "Overskudd" };
}
function getProteinColor(pct) {
  if (pct < 90) return { color: "#c0392b", label: "Mangler" };
  if (pct <= 120) return { color: "#27ae60", label: "Dekket" };
  if (pct <= 150) return { color: "#7cb342", label: "Litt over" };
  if (pct <= 180) return { color: "#f9a825", label: "Høyt" };
  if (pct <= 200) return { color: "#e67e22", label: "For høyt" };
  return { color: "#c0392b", label: "Mye for høyt" };
}

// --- KONTEKSTUELLE TIPS ---
function getContextualTips(horse) {
  const tips = [];
  if (horse.typeFactor <= 0.9) tips.push({ section: "grovfor", icon: "⚡", title: "Lettfôret rase", text: `${horse.breed || "Denne rasen"} er lettfôret. Sent slått grovfôr med mye fiber er ofte et godt valg. Vær forsiktig med energirike kraftfôrblandinger.` });
  if (horse.typeFactor >= 1.1) tips.push({ section: "grovfor", icon: "🔥", title: "Høy forbrenning", text: "Fullblodshester har høyere forbrenning. Tidlig slått grovfôr gir mer energi. Kombiner med energirikt kraftfôr om nødvendig." });
  if (horse.bcs >= 4) tips.push({ section: "grovfor", icon: "📉", title: "Overvektig — redusert energi", text: `Hesten har høy holdscore (${horse.bcs}/5). Fôrplanen gir bevisst ${Math.round((1 - (BCS_FACTORS[horse.bcs] || 1.0)) * 100)} % redusert energi. Velg sent slått grovfôr, men hold grovfôrmengden over 1,5 kg TS per 100 kg.` });
  if (horse.bcs <= 2) tips.push({ section: "grovfor", icon: "📈", title: "Lav holdpoeng — økt energi", text: `Hesten er under normalt hold (${horse.bcs}/5). Fôrplanen gir ${Math.round(((BCS_FACTORS[horse.bcs] || 1.0) - 1) * 100)} % ekstra energi. Tidlig slått grovfôr og fri tilgang kan hjelpe.` });
  if (horse.trainingLevel >= 3) tips.push({ section: "kraftfor", icon: "💪", title: "Hard trening — økt behov", text: "Hester i hard trening har høyt energibehov som sjelden dekkes av grovfôr alene. Kraftfôr med høy energitetthet (Ekstrem, Gull, Pioner Sport) kan være nødvendig." });
  if (horse.growthStage !== "adult") tips.push({ section: "kraftfor", icon: "🐴", title: "Unghest i vekst", text: "Unghester har høyere protein- og mineralbehov. Bruk kraftfôr for oppdrett (Oppdrett, Føll, Pioner Oppdrett) med riktig Ca:P." });
  if (horse.pregMonth >= 9) tips.push({ section: "kraftfor", icon: "🤰", title: "Siste del av drektigheten", text: "60–65 % av fosterutviklingen skjer de siste 90 dagene. Bruk kraftfôr beregnet for avl." });
  if (horse.lactMonth >= 1) tips.push({ section: "kraftfor", icon: "🍼", title: "Laktasjon — høyt behov", text: "Hoppa kan trenge opp mot dobbelt vedlikeholdsbehov i tidlig laktasjon. Olje kan være et godt energitilskudd." });
  return tips;
}

// --- HELPERS ---
function InfoBox({ title, children, icon, defaultOpen = false, variant = "default" }) {
  const [open, setOpen] = useState(defaultOpen);
  const themes = {
    default: { bg: "#f7f5f0", bgC: "#faf9f6", border: "#e2ddd5", text: "#5a5347" },
    tip: { bg: "#e8f5e8", bgC: "#f0f7f0", border: "#c5dcc5", text: "#3a5a3a" },
    warning: { bg: "#fef3e4", bgC: "#fef8f0", border: "#f0d4a8", text: "#7a5a2e" },
  };
  const t = themes[variant] || themes.default;
  return (
    <div style={{ background: open ? t.bg : t.bgC, border: `1px solid ${t.border}`, borderRadius: 10, marginBottom: 12, overflow: "hidden" }}>
      <button onClick={() => setOpen(!open)} style={{
        width: "100%", padding: "10px 14px", background: "none", border: "none",
        cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
        fontFamily: "inherit", fontSize: 14, fontWeight: 600, color: t.text, textAlign: "left",
      }}>
        {icon && <span style={{ fontSize: 15 }}>{icon}</span>}
        <span style={{ fontSize: 11, transition: "transform 0.2s", transform: open ? "rotate(90deg)" : "rotate(0)" }}>▶</span>
        <span style={{ flex: 1 }}>{title}</span>
      </button>
      {open && <div style={{ padding: "0 14px 12px", fontSize: 13.5, lineHeight: 1.6, color: t.text }}>{children}</div>}
    </div>
  );
}

function NutrientBar({ label, value, target, unit, colorFn }) {
  const pct = target > 0 ? (value / target) * 100 : 0;
  const clamped = Math.min(pct, 150);
  const { color, label: statusLabel } = (colorFn || getNutrientColor)(pct);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#3a3632" }}>{label}</span>
        <span style={{ fontSize: 12, color }}>
          <span style={{ fontWeight: 700 }}>{value.toFixed(1)}</span>
          <span style={{ color: "#8a8378" }}> / {target.toFixed(1)} {unit}</span>
          <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: `${color}15`, color }}>{statusLabel} ({Math.round(pct)} %)</span>
        </span>
      </div>
      <div style={{ height: 6, background: "#e8e4dd", borderRadius: 3, overflow: "hidden", position: "relative" }}>
        <div style={{ position: "absolute", left: `${(100 / 150) * 100}%`, top: 0, bottom: 0, width: 1.5, background: "#888", opacity: 0.3 }} />
        <div style={{ height: "100%", width: `${(clamped / 150) * 100}%`, background: color, borderRadius: 3, transition: "width 0.3s" }} />
      </div>
    </div>
  );
}

function MiniBar({ value, target, color }) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0;
  return (
    <div style={{ height: 3, background: "#ffffff30", borderRadius: 2, flex: 1 }}>
      <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 2, transition: "width 0.3s" }} />
    </div>
  );
}

// ============================================================
// GROVFÔR ENTRY (uendret fra v3)
// ============================================================
function RoughageEntry({ entry, index, onChange, onRemove, weight }) {
  const typeInfo = ROUGHAGE_TYPES.find(t => t.id === entry.typeId);
  const cutInfo = CUTTING_TIMES.find(c => c.id === entry.cutting);
  const ts = entry.customTS || (typeInfo?.ts || 72);
  const perKg = cutInfo ? {
    FEh: cutInfo.FEh * (ts / 100), protein: cutInfo.protein * (ts / 100),
    Ca: cutInfo.Ca * (ts / 100), P: cutInfo.P * (ts / 100),
  } : { FEh: 0, protein: 0, Ca: 0, P: 0 };

  const isHalm = entry.typeId === "halm";

  return (
    <div style={{ background: "#fff", border: "1px solid #e2ddd5", borderRadius: 12, padding: 14, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: "#3a3632" }}>Grovfôr {index + 1}</span>
        <button onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#c0b8ad", padding: "0 4px" }}>×</button>
      </div>
      <label style={labelStyle}>Type</label>
      <div style={{ display: "flex", gap: 5, marginBottom: 12, flexWrap: "wrap" }}>
        {ROUGHAGE_TYPES.map(t => (
          <button key={t.id} onClick={() => onChange({ ...entry, typeId: t.id, customTS: null, cutting: t.id === "halm" ? "halm" : (entry.cutting === "halm" ? "middels" : entry.cutting) })} style={pillStyle(entry.typeId === t.id)}>{t.shortLabel}</button>
        ))}
      </div>
      {isHalm && (
        <div style={{ background: "#fef5e7", border: "1px solid #f0d4a8", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 12.5, color: "#7a5a2e", lineHeight: 1.5 }}>
          🌾 Halm brukes som fiber og metthet, ikke som næringskilde. Dekker minimalt av energi- og proteinbehovet.
        </div>
      )}
      {!isHalm && (
        <>
          <label style={labelStyle}>Slåttetid</label>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {CUTTING_TIMES.filter(c => c.id !== "halm").map(c => (
              <button key={c.id} onClick={() => onChange({ ...entry, cutting: c.id })} style={{ ...pillStyle(entry.cutting === c.id), flex: 1, textAlign: "center" }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{c.label}</div>
                <div style={{ fontSize: 10.5, opacity: 0.7 }}>{c.desc}</div>
              </button>
            ))}
          </div>
        </>
      )}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 8, flexWrap: "wrap" }}>
        <div>
          <label style={labelStyle}>Mengde (kg/dag)</label>
          <input type="number" value={entry.kgPerDay || ""} min={0} max={30} step={0.5}
            onChange={e => onChange({ ...entry, kgPerDay: Math.max(0, parseFloat(e.target.value) || 0) })} style={inputStyle} placeholder="0" />
        </div>
        {entry.kgPerDay > 0 && (
          <div style={{ fontSize: 12, color: "#5a5347", paddingBottom: 8, lineHeight: 1.6 }}>
            = <strong>{(entry.kgPerDay * ts / 100).toFixed(1)} kg TS</strong>
            {weight > 0 && <span style={{ color: "#8a8378" }}> ({((entry.kgPerDay * ts / 100) / (weight / 100)).toFixed(1)} kg TS/100 kg)</span>}
          </div>
        )}
      </div>
      {entry.kgPerDay > 0 && (
        <div style={{ background: "#f7f5f0", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#5a5347", display: "flex", gap: 16, flexWrap: "wrap" }}>
          <span><strong>{(entry.kgPerDay * perKg.FEh).toFixed(2)}</strong> FEh</span>
          <span><strong>{(entry.kgPerDay * perKg.protein).toFixed(0)}</strong> g protein</span>
          <span><strong>{(entry.kgPerDay * perKg.Ca).toFixed(1)}</strong> g Ca</span>
          <span><strong>{(entry.kgPerDay * perKg.P).toFixed(1)}</strong> g P</span>
        </div>
      )}
      {!entry.customMode ? (
        <button onClick={() => onChange({ ...entry, customMode: true })}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#8a8378", marginTop: 6, textDecoration: "underline", padding: 0 }}>
          Jeg har egen grovfôranalyse →
        </button>
      ) : (
        <div style={{ marginTop: 8, background: "#f0f7ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#2676a8", marginBottom: 6 }}>Egne analyseverdier (per kg fôr)</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[["FEh/kg", "customFEh", perKg.FEh], ["Prot g/kg", "customProt", perKg.protein], ["Ca g/kg", "customCa", perKg.Ca], ["P g/kg", "customP", perKg.P]].map(([lbl, key, def]) => (
              <div key={key}>
                <label style={{ fontSize: 11, color: "#5a5347" }}>{lbl}</label>
                <input type="number" step="0.01" min={0} placeholder={def.toFixed(2)} value={entry[key] || ""}
                  onChange={e => onChange({ ...entry, [key]: Math.max(0, parseFloat(e.target.value) || 0) })}
                  style={{ ...inputStyle, width: 72, fontSize: 13 }} />
              </div>
            ))}
          </div>
          <button onClick={() => onChange({ ...entry, customMode: false, customFEh: 0, customProt: 0, customCa: 0, customP: 0 })}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#8a8378", marginTop: 4, padding: 0 }}>← Bruk standardverdier</button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// KRAFTFÔR ENTRY — med kg/liter-toggle og kalibrering
// ============================================================
function ConcentrateEntry({ entry, onChange, onRemove, weight }) {
  const product = CONCENTRATES.find(c => c.id === entry.productId);
  const density = entry.customDensity || product?.density || 0.70;
  const inputMode = entry.inputMode || "kg"; // "kg" | "liter" | "boks"

  // Beregn kg per måltid uansett inputmodus
  let effectiveKgPerMeal = 0;
  if (inputMode === "kg") {
    effectiveKgPerMeal = entry.kgPerMeal || 0;
  } else if (inputMode === "liter") {
    effectiveKgPerMeal = (entry.literPerMeal || 0) * density;
  } else if (inputMode === "boks") {
    effectiveKgPerMeal = (entry.boxesPerMeal || 0) * (entry.boxWeightKg || 0);
  }

  const totalKg = effectiveKgPerMeal * (entry.mealsPerDay || 0);
  const maxPerMeal = weight > 0 ? (weight / 100) * 0.3 : 999;
  const overLimit = effectiveKgPerMeal > maxPerMeal;

  return (
    <div style={{ background: "#fff", border: overLimit ? "2px solid #e67e22" : "1px solid #e2ddd5", borderRadius: 10, padding: 12, marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: 14, color: "#3a3632" }}>{product?.name || "?"}</span>
          <span style={{ fontSize: 12, color: "#8a8378", marginLeft: 6 }}>{product?.supplier}</span>
          {product?.density && <span style={{ fontSize: 10.5, color: "#b0a898", marginLeft: 6 }}>({product.density} kg/l)</span>}
        </div>
        <button onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#c0b8ad" }}>×</button>
      </div>

      {/* === Mengde-input med kg/liter/boks-toggle === */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 11.5, color: "#5a5347", fontWeight: 600, display: "block", marginBottom: 5 }}>Hvor mye gir du per måltid?</label>

        {/* Toggle: Kilo | Liter | Min boks */}
        <div style={{ display: "flex", gap: 0, marginBottom: 8, borderRadius: 7, overflow: "hidden", border: "1.5px solid #d5cfc6", width: "fit-content" }}>
          {[
            { mode: "kg", label: "Kilo" },
            { mode: "liter", label: "Liter" },
            { mode: "boks", label: "Min boks" },
          ].map(({ mode, label }) => (
            <button key={mode} onClick={() => onChange({ ...entry, inputMode: mode })} style={{
              padding: "6px 14px", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: inputMode === mode ? 700 : 400,
              background: inputMode === mode ? "#2d8a56" : "#fff", color: inputMode === mode ? "#fff" : "#5a5347", transition: "all 0.15s",
            }}>{label}</button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          {/* Kg input */}
          {inputMode === "kg" && (
            <div>
              <label style={{ fontSize: 11, color: "#8a8378" }}>Kg per måltid</label>
              <input type="number" value={entry.kgPerMeal || ""} min={0} max={10} step={0.1}
                onChange={e => onChange({ ...entry, kgPerMeal: parseFloat(e.target.value) || 0 })}
                style={{ ...inputStyle, width: 80 }} placeholder="0" />
            </div>
          )}

          {/* Liter input */}
          {inputMode === "liter" && (
            <div>
              <label style={{ fontSize: 11, color: "#8a8378" }}>Liter per måltid</label>
              <input type="number" value={entry.literPerMeal || ""} min={0} max={20} step={0.1}
                onChange={e => onChange({ ...entry, literPerMeal: parseFloat(e.target.value) || 0 })}
                style={{ ...inputStyle, width: 80 }} placeholder="0" />
              {(entry.literPerMeal || 0) > 0 && (
                <div style={{ fontSize: 11, color: "#5a5347", marginTop: 3 }}>
                  = <strong>{effectiveKgPerMeal.toFixed(2)} kg</strong>
                  <span style={{ color: "#8a8378" }}> (× {density} kg/l)</span>
                </div>
              )}
            </div>
          )}

          {/* Min boks input */}
          {inputMode === "boks" && (
            <div>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <div>
                  <label style={{ fontSize: 11, color: "#8a8378" }}>Bokser per måltid</label>
                  <input type="number" value={entry.boxesPerMeal || ""} min={0} max={10} step={0.5}
                    onChange={e => onChange({ ...entry, boxesPerMeal: parseFloat(e.target.value) || 0 })}
                    style={{ ...inputStyle, width: 70 }} placeholder="1" />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#8a8378" }}>Boks veier (kg)</label>
                  <input type="number" value={entry.boxWeightKg || ""} min={0} max={5} step={0.05}
                    onChange={e => onChange({ ...entry, boxWeightKg: parseFloat(e.target.value) || 0 })}
                    style={{ ...inputStyle, width: 80 }} placeholder="0.00" />
                </div>
              </div>
              {(entry.boxesPerMeal || 0) > 0 && (entry.boxWeightKg || 0) > 0 && (
                <div style={{ fontSize: 11, color: "#5a5347", marginTop: 3 }}>
                  = <strong>{effectiveKgPerMeal.toFixed(2)} kg</strong> per måltid
                </div>
              )}
              {!(entry.boxWeightKg > 0) && (
                <div style={{ fontSize: 11, color: "#e67e22", marginTop: 3 }}>
                  💡 Vei én full boks på kjøkkenvekta og legg inn vekten her.
                </div>
              )}
            </div>
          )}

          {/* Måltider per dag */}
          <div>
            <label style={{ fontSize: 11, color: "#8a8378", fontWeight: 600 }}>Måltider/dag</label>
            <div style={{ display: "flex", gap: 3 }}>
              {[1, 2, 3, 4].map(n => (
                <button key={n} onClick={() => onChange({ ...entry, mealsPerDay: n })} style={{
                  width: 34, height: 34, borderRadius: 7,
                  border: entry.mealsPerDay === n ? "2px solid #2d8a56" : "1.5px solid #d5cfc6",
                  background: entry.mealsPerDay === n ? "#eaf7f0" : "#fff",
                  fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
                  color: entry.mealsPerDay === n ? "#1a6b3a" : "#5a5347",
                }}>{n}</button>
              ))}
            </div>
          </div>

          {totalKg > 0 && (
            <div style={{ fontSize: 12, color: "#5a5347", paddingBottom: 6 }}>
              = <strong>{totalKg.toFixed(1)} kg/dag</strong>
              <span style={{ marginLeft: 6, color: "#8a8378" }}>({(totalKg * (product?.FEh || 0)).toFixed(2)} FEh)</span>
            </div>
          )}
        </div>
      </div>

      {overLimit && (
        <div style={{ padding: "5px 10px", background: "#fef5e7", border: "1px solid #f0c36d", borderRadius: 6, fontSize: 12, color: "#92600e", marginBottom: 6 }}>
          ⚠️ Over maks ({maxPerMeal.toFixed(1)} kg/måltid for {weight} kg hest). Fordel på flere måltider.
        </div>
      )}
      {totalKg > 0 && product && (
        <div style={{ background: "#f7f5f0", borderRadius: 6, padding: "5px 10px", fontSize: 11.5, color: "#5a5347", display: "flex", gap: 12, flexWrap: "wrap" }}>
          <span>{(totalKg * product.FEh).toFixed(2)} FEh</span>
          <span>{(totalKg * product.protein).toFixed(0)} g prot</span>
          <span>{(totalKg * product.Ca).toFixed(1)} g Ca</span>
          <span>{(totalKg * product.P).toFixed(1)} g P</span>
        </div>
      )}
    </div>
  );
}

// ============================================================
// TILSKUDD ENTRY (uendret)
// ============================================================
function SupplementEntry({ entry, onChange, onRemove }) {
  const product = SUPPLEMENTS.find(s => s.id === entry.productId);
  const amountKg = (entry.amount || 0) / 1000;
  return (
    <div style={{ background: "#fff", border: "1px solid #e2ddd5", borderRadius: 10, padding: 12, marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontWeight: 700, fontSize: 13.5, color: "#3a3632" }}>{product?.name || "?"}</span>
        <button onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#c0b8ad" }}>×</button>
      </div>
      {product?.unit !== "fri" ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <input type="number" value={entry.amount || ""} min={0} max={1000} step={5}
            onChange={e => onChange({ ...entry, amount: parseFloat(e.target.value) || 0 })}
            style={{ ...inputStyle, width: 80 }} placeholder={product?.typical || "0"} />
          <span style={{ fontSize: 13, color: "#5a5347" }}>{product?.unit}/dag</span>
          {amountKg > 0 && product && (
            <span style={{ fontSize: 11.5, color: "#8a8378" }}>
              ({(amountKg * product.FEh).toFixed(2)} FEh, {(amountKg * product.Ca).toFixed(1)} g Ca)
            </span>
          )}
        </div>
      ) : (
        <span style={{ fontSize: 12.5, color: "#8a8378" }}>Fri tilgang — ikke medregnet i næringsstoffer</span>
      )}
    </div>
  );
}

// ============================================================
// PRODUKTVELGER
// ============================================================
function ProductPicker({ products, onSelect, onClose, title }) {
  const [search, setSearch] = useState("");
  const grouped = {};
  products.forEach(p => { const k = p.supplier || "Annet"; if (!grouped[k]) grouped[k] = []; grouped[k].push(p); });
  const filtered = search ? products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) || (p.supplier || "").toLowerCase().includes(search.toLowerCase())) : null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 200, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: "16px 16px 0 0", maxWidth: 600, width: "100%", maxHeight: "75vh", overflow: "auto", padding: 16 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontWeight: 800, fontSize: 16, color: "#3a3632" }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#8a8378" }}>×</button>
        </div>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Søk produktnavn eller leverandør..." style={{ ...inputStyle, width: "100%", marginBottom: 12, textAlign: "left" }} />
        {filtered ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {filtered.map(p => (
              <button key={p.id} onClick={() => onSelect(p)} style={productBtnStyle}>
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{p.name} {p.density && <span style={{ fontSize: 10.5, color: "#b0a898" }}>({p.density} kg/l)</span>}</div>
                <div style={{ fontSize: 11, color: "#8a8378" }}>{p.supplier} · {p.FEh} FEh/kg · {p.protein} g prot/kg</div>
              </button>
            ))}
            {filtered.length === 0 && <div style={{ textAlign: "center", padding: 16, color: "#8a8378", fontSize: 13 }}>Ingen treff.</div>}
          </div>
        ) : (
          Object.entries(grouped).map(([supplier, items]) => (
            <div key={supplier} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#8a8378", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>{supplier}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {items.map(p => (
                  <button key={p.id} onClick={() => onSelect(p)} style={productBtnStyle}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{p.name} {p.density && <span style={{ fontSize: 10.5, color: "#b0a898" }}>({p.density} kg/l)</span>}</div>
                    <div style={{ fontSize: 11, color: "#8a8378" }}>{p.FEh} FEh/kg · {p.protein} g prot/kg · Ca {p.Ca} · P {p.P}</div>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================
// STYLES
// ============================================================
const labelStyle = { fontWeight: 600, fontSize: 12.5, color: "#5a5347", display: "block", marginBottom: 4 };
const pillStyle = (active) => ({
  padding: "6px 10px", border: active ? "2px solid #2d8a56" : "1.5px solid #d5cfc6",
  borderRadius: 7, background: active ? "#eaf7f0" : "#fff",
  cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: active ? 700 : 400,
  color: active ? "#1a6b3a" : "#5a5347", textAlign: "left", transition: "all 0.12s",
});
const inputStyle = {
  padding: "8px 10px", border: "2px solid #d5cfc6", borderRadius: 8,
  fontSize: 16, fontWeight: 700, fontFamily: "inherit", textAlign: "center", width: 90,
};
const productBtnStyle = {
  width: "100%", padding: "10px 12px", border: "1.5px solid #e2ddd5", borderRadius: 8,
  background: "#fff", cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "all 0.12s",
};

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function FeedSelection({ horse: horseProp, onComplete, onBack }) {
  const horse = horseProp;

  const needs = useMemo(() => calculateNeeds(horse), [horse]);
  const tips = useMemo(() => getContextualTips(horse), [horse]);

  const [roughages, setRoughages] = useState([
    { typeId: "ens_72", cutting: "middels", kgPerDay: 0, customMode: false, customTS: null, customFEh: 0, customProt: 0, customCa: 0, customP: 0 }
  ]);
  const [concentrates, setConcentrates] = useState([]);
  const [supplements, setSupplements] = useState([]);
  const [showConcPicker, setShowConcPicker] = useState(false);
  const [showSuppPicker, setShowSuppPicker] = useState(false);
  const [activeSection, setActiveSection] = useState("grovfor");

  // --- Hjelpefunksjon: beregn effektiv kg for et kraftfôr-entry ---
  const getEffectiveKg = (c) => {
    const product = CONCENTRATES.find(p => p.id === c.productId);
    const density = c.customDensity || product?.density || 0.70;
    const mode = c.inputMode || "kg";
    let kgPerMeal = 0;
    if (mode === "kg") kgPerMeal = c.kgPerMeal || 0;
    else if (mode === "liter") kgPerMeal = (c.literPerMeal || 0) * density;
    else if (mode === "boks") kgPerMeal = (c.boxesPerMeal || 0) * (c.boxWeightKg || 0);
    return kgPerMeal * (c.mealsPerDay || 0);
  };

  // --- TOTALER ---
  const totals = useMemo(() => {
    let FEh = 0, protein = 0, Ca = 0, P = 0, tsKg = 0, grovTsKg = 0;
    roughages.forEach(r => {
      const typeInfo = ROUGHAGE_TYPES.find(t => t.id === r.typeId);
      const cutInfo = CUTTING_TIMES.find(c => c.id === r.cutting);
      const ts = r.customTS || (typeInfo?.ts || 72);
      const tsFrac = ts / 100;
      if (r.customMode && r.customFEh > 0) {
        FEh += r.kgPerDay * r.customFEh; protein += r.kgPerDay * (r.customProt || 0);
        Ca += r.kgPerDay * (r.customCa || 0); P += r.kgPerDay * (r.customP || 0);
      } else if (cutInfo) {
        FEh += r.kgPerDay * cutInfo.FEh * tsFrac; protein += r.kgPerDay * cutInfo.protein * tsFrac;
        Ca += r.kgPerDay * cutInfo.Ca * tsFrac; P += r.kgPerDay * cutInfo.P * tsFrac;
      }
      const kgTs = r.kgPerDay * tsFrac; tsKg += kgTs; grovTsKg += kgTs;
    });
    concentrates.forEach(c => {
      const prod = CONCENTRATES.find(p => p.id === c.productId);
      const totalKg = getEffectiveKg(c);
      if (prod) { FEh += totalKg * prod.FEh; protein += totalKg * prod.protein; Ca += totalKg * prod.Ca; P += totalKg * prod.P; tsKg += totalKg * 0.88; }
    });
    supplements.forEach(s => {
      const prod = SUPPLEMENTS.find(p => p.id === s.productId);
      if (prod && prod.unit !== "fri") { const kg = (s.amount || 0) / 1000; FEh += kg * prod.FEh; protein += kg * prod.protein; Ca += kg * prod.Ca; P += kg * prod.P; }
    });
    const grovforTsPer100 = horse.weight > 0 ? grovTsKg / (horse.weight / 100) : 0;
    const kraftTsKg = tsKg - grovTsKg;
    const kraftforAndel = tsKg > 0 ? (kraftTsKg / tsKg) * 100 : 0;
    const caP = P > 0 ? Ca / P : 0;
    const totalKraftforKg = concentrates.reduce((sum, c) => sum + getEffectiveKg(c), 0);
    return { FEh, protein, Ca, P, tsKg, grovTsKg, grovforTsPer100, kraftforAndel, caP, totalKraftforKg };
  }, [roughages, concentrates, supplements, horse.weight]);

  const avgGrovTs = useMemo(() => {
    let totalKg = 0, totalTsKg = 0;
    roughages.forEach(r => {
      const typeInfo = ROUGHAGE_TYPES.find(t => t.id === r.typeId);
      const ts = r.customTS || (typeInfo?.ts || 72);
      totalKg += r.kgPerDay; totalTsKg += r.kgPerDay * (ts / 100);
    });
    return totalKg > 0 ? (totalTsKg / totalKg) * 100 : 72;
  }, [roughages]);

  const minTsKg = horse.weight / 100 * 1.5;
  const minFeedKg = minTsKg / (avgGrovTs / 100);

  // --- ADVARSLER ---
  const warnings = useMemo(() => {
    const w = [];
    const gp = totals.grovforTsPer100;
    if (gp > 0 && gp < 1.0) w.push({ color: "#c0392b", text: "Kritisk lite grovfôr! Minimum 1,5 kg TS per 100 kg. Risiko for fordøyelsesproblemer og magesår.", p: 1 });
    else if (gp > 0 && gp < 1.5) w.push({ color: "#e67e22", text: `For lite grovfôr (${gp.toFixed(1)} kg TS/100 kg). Minimum 1,5 kg TS per 100 kg.`, p: 2 });
    if (totals.kraftforAndel > 30) w.push({ color: "#e67e22", text: `Høy andel kraftfôr (${Math.round(totals.kraftforAndel)} % av total TS). Bør ikke overstige 30 %.`, p: 3 });

    // Kraftfôr per måltid — sjekk med effektiv kg
    concentrates.forEach(c => {
      const prod = CONCENTRATES.find(p => p.id === c.productId);
      const max = (horse.weight / 100) * 0.3;
      const totalKg = getEffectiveKg(c);
      const kgPerMeal = (c.mealsPerDay || 1) > 0 ? totalKg / (c.mealsPerDay || 1) : totalKg;
      if (kgPerMeal > max) w.push({ color: "#e67e22", text: `${prod?.name}: For stort måltid (${kgPerMeal.toFixed(1)} kg). Maks ${max.toFixed(1)} kg.`, p: 4 });
    });
    if (totals.totalKraftforKg > 2) {
      const maxM = Math.max(...concentrates.map(c => c.mealsPerDay || 0), 0);
      if (maxM < 3) w.push({ color: "#e67e22", text: `Over 2 kg kraftfôr/dag (${totals.totalKraftforKg.toFixed(1)} kg) bør fordeles på minst 3 måltider.`, p: 4 });
    }
    if (totals.caP > 0 && totals.caP < 1.2) w.push({ color: "#c0392b", text: `Ca:P = ${totals.caP.toFixed(2)} — Farlig lavt kalsiumnivå!`, p: 1 });
    else if (totals.caP >= 1.2 && totals.caP < 1.5) w.push({ color: "#e67e22", text: `Ca:P = ${totals.caP.toFixed(2)} — Bør ligge over 1,5.`, p: 3 });
    else if (totals.caP > 2.5) w.push({ color: "#2980b9", text: `Ca:P = ${totals.caP.toFixed(2)} — Høyt kalsium. Sjekk mineraltilskudd.`, p: 5 });

    if (totals.FEh > needs.FEh * 1.2) w.push({ color: "#2980b9", text: `Energioverskudd (${Math.round((totals.FEh / needs.FEh) * 100)} %).`, p: 4 });
    if (totals.FEh > 0 && totals.FEh < needs.FEh * 0.8) w.push({ color: "#e67e22", text: `Energiunderskudd (${Math.round((totals.FEh / needs.FEh) * 100)} %).`, p: 3 });
    if (totals.protein > 0 && totals.protein < needs.protein * 0.9) w.push({ color: "#c0392b", text: `Proteinmangel (${Math.round((totals.protein / needs.protein) * 100)} %).`, p: 2 });

    const pp = needs.protein > 0 ? (totals.protein / needs.protein) * 100 : 0;
    if (pp > 200) w.push({ color: "#c0392b", text: `Høyt proteinoverskudd (${Math.round(pp)} %). Vurder lavere protein i grovfôr eller kraftfôr.`, p: 3 });
    else if (pp > 150) w.push({ color: "#f9a825", text: `Proteinoverskudd (${Math.round(pp)} %). Ofte uproblematisk, men sjekk om kraftfôr/tilskudd kan forenkles.`, p: 5 });

    // Nytt: Advarsel for rene kornprodukter uten mineralbalanse
    const kornUtenMineral = concentrates.filter(c => {
      const prod = CONCENTRATES.find(p => p.id === c.productId);
      return prod && (prod.cat === "korn") && getEffectiveKg(c) > 0;
    });
    if (kornUtenMineral.length > 0) {
      const hasMinSupplement = supplements.some(s => {
        const prod = SUPPLEMENTS.find(p => p.id === s.productId);
        return prod && prod.Ca > 50 && (s.amount || 0) > 0;
      });
      if (!hasMinSupplement) {
        w.push({ color: "#e67e22", text: "Korn/hvetekli har mye fosfor og lite kalsium. Legg til et mineraltilskudd for å opprettholde Ca:P-balansen.", p: 3 });
      }
    }

    w.sort((a, b) => a.p - b.p);
    return w;
  }, [totals, concentrates, supplements, horse, needs]);

  const addRoughage = () => setRoughages([...roughages, { typeId: "ens_72", cutting: "middels", kgPerDay: 0, customMode: false, customTS: null, customFEh: 0, customProt: 0, customCa: 0, customP: 0 }]);

  const sections = [
    { id: "grovfor", label: "Grovfôr", icon: "🌾", count: roughages.length },
    { id: "kraftfor", label: "Kraftfôr", icon: "🌽", count: concentrates.length + supplements.length },
    { id: "oppsummering", label: "Oversikt", icon: "📊", count: warnings.length > 0 ? warnings.length : null },
  ];

  const fehPct = needs.FEh > 0 ? (totals.FEh / needs.FEh) * 100 : 0;
  const fehHeaderColor = fehPct >= 90 && fehPct <= 120 ? "#8fdb8f" : fehPct > 0 ? "#f0c36d" : "#ffffff60";

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(170deg, #f5f2ec 0%, #eae6de 100%)", fontFamily: "'Nunito', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Quicksand:wght@500;600;700;800&display=swap" rel="stylesheet" />

      {/* === STICKY HEADER === */}
      <div style={{ background: "linear-gradient(135deg, #1a3a2a 0%, #0c1f14 100%)", color: "#fff", padding: "12px 20px", position: "sticky", top: 41, zIndex: 150 }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontFamily: "'Quicksand'", fontWeight: 800, fontSize: 15 }}>Fôrplan — {horse.name}</div>
              <div style={{ fontSize: 11, opacity: 0.6 }}>{horse.weight} kg {horse.breed} · {horse.trainingLabel}{needs.bcsFactor !== 1.0 && ` · BCS ${horse.bcs}`}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: fehHeaderColor, lineHeight: 1 }}>
                {totals.FEh.toFixed(1)} <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.6 }}>/ {needs.FEh}</span>
              </div>
              <div style={{ fontSize: 10, opacity: 0.5 }}>FEh inntak / behov</div>
            </div>
          </div>
          {totals.FEh > 0 && (
            <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
              <span style={{ fontSize: 9, opacity: 0.5, width: 22 }}>FEh</span>
              <MiniBar value={totals.FEh} target={needs.FEh} color={fehHeaderColor} />
              <span style={{ fontSize: 9, opacity: 0.5, width: 22 }}>Prot</span>
              <MiniBar value={totals.protein} target={needs.protein} color={getProteinColor(needs.protein > 0 ? (totals.protein / needs.protein) * 100 : 0).color} />
              <span style={{ fontSize: 9, opacity: 0.5, width: 16 }}>Ca</span>
              <MiniBar value={totals.Ca} target={needs.Ca} color={getNutrientColor(needs.Ca > 0 ? (totals.Ca / needs.Ca) * 100 : 0).color} />
              <span style={{ fontSize: 9, opacity: 0.5, width: 12 }}>P</span>
              <MiniBar value={totals.P} target={needs.P} color={getNutrientColor(needs.P > 0 ? (totals.P / needs.P) * 100 : 0).color} />
            </div>
          )}
        </div>
      </div>

      {/* === SECTION TABS === */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2ddd5", position: "sticky", top: 109, zIndex: 100 }}>
        <div style={{ display: "flex", maxWidth: 600, margin: "0 auto" }}>
          {sections.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
              flex: 1, padding: "10px 8px", border: "none", background: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "center",
              borderBottom: activeSection === s.id ? "3px solid #2d8a56" : "3px solid transparent",
            }}>
              <div style={{ fontSize: 14 }}>{s.icon}</div>
              <div style={{ fontSize: 12, fontWeight: activeSection === s.id ? 800 : 600, color: activeSection === s.id ? "#1a6b3a" : "#8a8378" }}>
                {s.label} {s.count > 0 && <span style={{ fontSize: 10, background: s.id === "oppsummering" && warnings.length > 0 ? "#fef3e4" : "#eaf7f0", padding: "1px 5px", borderRadius: 4, color: s.id === "oppsummering" && warnings.length > 0 ? "#c0392b" : "#2d8a56" }}>{s.count}</span>}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* === CONTENT === */}
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "12px 16px 160px" }}>

        {/* === GROVFÔR TAB === */}
        {activeSection === "grovfor" && (
          <div>
            <h2 style={{ fontFamily: "'Quicksand'", fontSize: 20, fontWeight: 800, color: "#2a2520", margin: "0 0 4px" }}>Grovfôr</h2>
            <p style={{ fontSize: 13.5, color: "#6a6358", margin: "0 0 4px" }}>Grovfôr er grunnlaget i fôrplanen. Legg inn alt grovfôr hesten får per dag.</p>
            <p style={{ fontSize: 13, color: "#8a8378", margin: "0 0 12px" }}>Dersom hesten din får flere typer grovfôr: trykk «+ Legg til grovfôr» nederst.</p>

            <div style={{ background: "#fff", border: "1px solid #d5e8d5", borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#2a5a2a", marginBottom: 4 }}>Minimum grovfôr for {horse.name}</div>
              <div style={{ fontSize: 13, color: "#3a5a3a", lineHeight: 1.7 }}>
                <div>TS-behov: <strong>{minTsKg.toFixed(1)} kg TS/dag</strong> <span style={{ color: "#8a8378" }}>(1,5 kg TS per 100 kg × {horse.weight} kg)</span></div>
                <div>Tilsvarer ca. <strong>{minFeedKg.toFixed(1)} kg fôr/dag</strong> <span style={{ color: "#8a8378" }}>ved {Math.round(avgGrovTs)} % TS</span></div>
                {totals.grovTsKg > 0 && (
                  <div style={{ marginTop: 4, paddingTop: 4, borderTop: "1px solid #e8f0e8" }}>
                    Nå lagt inn: <strong style={{ color: totals.grovforTsPer100 >= 1.5 ? "#27ae60" : "#e67e22" }}>{totals.grovTsKg.toFixed(1)} kg TS</strong>
                    <span style={{ color: "#8a8378" }}> ({totals.grovforTsPer100.toFixed(1)} kg TS/100 kg)</span>
                    {totals.grovforTsPer100 >= 1.5 ? " ✅" : " ⚠️"}
                  </div>
                )}
              </div>
            </div>

            <InfoBox title="Hvorfor er grovfôr så viktig?" icon="📚">
              <p>Hester skal ha <strong>minimum 1,5 kg tørrstoff (TS) per 100 kg kroppsvekt</strong> i grovfôr daglig.</p>
              <p style={{ marginTop: 6 }}><strong>Hva betyr TS?</strong> TS viser hvor mye av fôret som er «tørt» (næringsstoffer), og hvor mye som er vann. Et grovfôr med 70 % TS inneholder 30 % vann — ca. 3 dl vann per kg fôr.</p>
              <p style={{ marginTop: 6 }}><strong>Omregning:</strong> kg fôr = kg TS ÷ (TS% / 100). Eksempel: {minTsKg.toFixed(1)} kg TS ved 72 % TS = {(minTsKg / 0.72).toFixed(1)} kg fôr.</p>
              <p style={{ marginTop: 6 }}><strong>Gi grovfôr FØR kraftfôr.</strong> Hesten tygger 3–4 ganger mer på grovfôr enn kraftfôr, som gir mer spytt og bedre bufring av magesyre.</p>
            </InfoBox>
            <InfoBox title="Hva betyr slåttetid?" icon="🌿">
              <p><strong>Tidlig slått:</strong> Mer energi og protein. Passer høyt behov.</p>
              <p style={{ marginTop: 4 }}><strong>Middels slått:</strong> Vanligst. De fleste hester i lett til moderat arbeid.</p>
              <p style={{ marginTop: 4 }}><strong>Sent slått:</strong> Mye fiber, lite energi. Lettfôrede raser, vektreduksjon.</p>
              <p style={{ marginTop: 8, fontSize: 12, color: "#7a7368" }}>💡 Har du grovfôranalyse? Trykk «Jeg har egen analyse» på kortet.</p>
            </InfoBox>

            {tips.filter(t => t.section === "grovfor").map((tip, i) => (
              <InfoBox key={i} title={tip.title} icon={tip.icon} variant="tip"><p>{tip.text}</p></InfoBox>
            ))}

            {roughages.map((r, i) => (
              <RoughageEntry key={i} entry={r} index={i} weight={horse.weight}
                onChange={u => { const n = [...roughages]; n[i] = u; setRoughages(n); }}
                onRemove={() => roughages.length > 1 && setRoughages(roughages.filter((_, j) => j !== i))} />
            ))}
            <button onClick={addRoughage} style={{ width: "100%", padding: "10px", border: "2px dashed #d5cfc6", borderRadius: 10, background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: "#8a8378" }}>+ Legg til grovfôr</button>

            <div style={{ marginTop: 16 }}>
              <InfoBox title="Vann og fôringsrutiner" icon="🌡️">
                <p>En hest på ca. {horse.weight} kg drikker ofte 30–50 liter vann per døgn, men behovet øker ved varme, trening, mer kraftfôr/salt, feber og laktasjon. Sørg for fri tilgang til rent vann, og sjekk drikkekar daglig. Et drikkekar bør levere ca. 6–8 liter per minutt.</p>
                <p style={{ marginTop: 6 }}>Gi alltid grovfôr før kraftfôr — det øker tygging og spyttproduksjon og er bedre for mage og fordøyelse. Hold gjerne en jevn fôringsrytme og unngå lange pauser uten grovfôr.</p>
                <p style={{ marginTop: 6 }}>Fôrbytte skal alltid skje gradvis, helst over 2–3 uker. Mikrobene i blindtarmen trenger tid til å tilpasse seg nytt fôr. Følg med på appetitt og avføring.</p>
              </InfoBox>
            </div>
          </div>
        )}

        {/* === KRAFTFÔR & TILSKUDD TAB === */}
        {activeSection === "kraftfor" && (
          <div>
            <h2 style={{ fontFamily: "'Quicksand'", fontSize: 20, fontWeight: 800, color: "#2a2520", margin: "0 0 4px" }}>Kraftfôr</h2>
            <p style={{ fontSize: 13.5, color: "#6a6358", margin: "0 0 12px" }}>Legg til kraftfôr bare hvis grovfôret ikke dekker behovet. Oppgi mengde per måltid.</p>

            <InfoBox title="Regler for kraftfôr" icon="📏">
              <p><strong>Maks 0,3 kg per 100 kg per måltid.</strong> For {horse.name} ({horse.weight} kg): maks <strong>{(horse.weight / 100 * 0.3).toFixed(1)} kg</strong> per måltid.</p>
              <p style={{ marginTop: 6 }}><strong>Over 2 kg kraftfôr/dag?</strong> Fordel på minst 3 måltider.</p>
              <p style={{ marginTop: 6 }}>Gi alltid grovfôr først, vent 15–20 min, deretter kraftfôr.</p>
            </InfoBox>

            {/* NY: Volum vs. vekt InfoBox */}
            <InfoBox title="Veier du eller måler du? — Kilo vs. liter" icon="⚖️" variant="warning">
              <p>Kraftfôr bør ideelt sett veies i kilo, men mange bruker litermål eller en fast boks i stallen. Det er helt greit — men husk at egenvekten varierer mellom fôrtyper:</p>
              <div style={{ background: "#fff", border: "1px solid #e8e0d6", borderRadius: 8, padding: "8px 12px", margin: "8px 0", fontSize: 12.5 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "3px 16px", color: "#5a5347" }}>
                  <span style={{ fontWeight: 600 }}>Fôrtype</span><span style={{ fontWeight: 600, textAlign: "right" }}>kg/liter</span>
                  <span>Havre (hel)</span><span style={{ textAlign: "right" }}>0,50–0,55</span>
                  <span>Havre (valset) / Bygg (valset)</span><span style={{ textAlign: "right" }}>0,40–0,45</span>
                  <span>Hvetekli</span><span style={{ textAlign: "right" }}>0,20–0,30</span>
                  <span>Standard pellets (Champion/Pioner)</span><span style={{ textAlign: "right" }}>0,65–0,75</span>
                  <span>Müsli-blandinger</span><span style={{ textAlign: "right" }}>0,40–0,50</span>
                  <span>Luserne-/betfiberpellets</span><span style={{ textAlign: "right" }}>0,50–0,60</span>
                </div>
              </div>
              <p><strong>Eksempel:</strong> 2 liter standard pellets = ca. 2 × 0,70 = 1,4 kg.</p>
              <p style={{ marginTop: 6 }}>💡 <strong>Tips:</strong> Bruker du en fast boks? Vei den på kjøkkenvekta når den er full — da kan du bruke «Min boks»-funksjonen for helt nøyaktig beregning!</p>
            </InfoBox>

            {tips.filter(t => t.section === "kraftfor").map((tip, i) => (
              <InfoBox key={i} title={tip.title} icon={tip.icon} variant="tip"><p>{tip.text}</p></InfoBox>
            ))}

            {concentrates.length === 0 && (
              <div style={{ textAlign: "center", padding: "24px 16px", color: "#8a8378" }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>🌽</div>
                <div style={{ fontSize: 14 }}>Ingen kraftfôr lagt til ennå.</div>
                <div style={{ fontSize: 12.5, marginTop: 2 }}>Mange hester klarer seg fint med bare grovfôr og et mineraltilskudd.</div>
              </div>
            )}

            {concentrates.map((c, i) => (
              <ConcentrateEntry key={c.productId + i} entry={c} weight={horse.weight}
                onChange={u => { const n = [...concentrates]; n[i] = u; setConcentrates(n); }}
                onRemove={() => setConcentrates(concentrates.filter((_, j) => j !== i))} />
            ))}

            <button onClick={() => setShowConcPicker(true)} style={{ width: "100%", padding: "10px", border: "2px dashed #d5cfc6", borderRadius: 10, background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: "#8a8378" }}>+ Legg til kraftfôr</button>

            {/* --- TILSKUDD --- */}
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: "2px solid #e2ddd5" }}>
              <h2 style={{ fontFamily: "'Quicksand'", fontSize: 18, fontWeight: 800, color: "#2a2520", margin: "0 0 4px" }}>💊 Tilskudd</h2>
              <p style={{ fontSize: 13, color: "#6a6358", margin: "0 0 12px" }}>Mineraltilskudd, oljer og vitaminer. Mengde i gram eller ml per dag.</p>

              <InfoBox title="Trenger hesten min tilskudd?" icon="❓">
                <p>Mange hester som får godt grovfôr og et balansert kraftfôr trenger lite eller ingen ekstra tilskudd.</p>
                <p style={{ marginTop: 6 }}><strong>Hvorfor regner vi ikke på alle vitaminer og mineraler?</strong></p>
                <p>I praksis er det stor usikkerhet i innhold (varierer mellom partier, år, lagring) og i hestens faktiske behov. Detaljerte beregninger kan gi falsk trygghet.</p>
                <p style={{ marginTop: 4 }}>Vi beregner <strong>kalsium (Ca) og fosfor (P)</strong> fordi disse er sentrale for skjelett, muskler og prestasjon — og fordi ubalanse er vanlig og viktig å fange opp.</p>
                <p style={{ marginTop: 6 }}><strong>Viktig:</strong> Får hesten ca. 2–3 kg kraftfôrblanding med tilsatte vitaminer/mineraler? Da anbefaler vi som regel <em>ikke</em> ekstra mineraltilskudd i tillegg.</p>
              </InfoBox>

              <InfoBox title="Når kan tilskudd likevel være aktuelt?" icon="💊">
                <p>Mineraltilskudd kan være nødvendig når:</p>
                <p style={{ marginTop: 4 }}>• Hesten får lite kraftfôr med tilsatte vitaminer/mineraler</p>
                <p>• Grovfôret har dårlig mineralbalanse (avdekket med analyse)</p>
                <p>• Ved særskilte behov (unghest i vekst, avlshoppe, høy svettebelastning)</p>
              </InfoBox>

              <InfoBox title="Viktige enkeltmineraler og vitaminer" icon="⚠️" variant="warning">
                <p><strong>Salt / natrium (NaCl)</strong></p>
                <p>Saltstein bør alltid være tilgjengelig, men ikke alle hester dekker behovet alene. Hester i arbeid kan trenge 25–50 g salt/dag om vinteren og 50–75 g om sommeren.</p>
                <p style={{ marginTop: 8 }}><strong>Selen (Se)</strong></p>
                <p>Lite i norske råvarer, lett å få for lite av — men selen er svært giftig i overdose. Vær ekstra forsiktig med å gi flere produkter som inneholder selen samtidig.</p>
                <p style={{ marginTop: 8 }}><strong>Jod (I)</strong></p>
                <p>Kan bli for høyt ved kombinasjon av flere tilskudd. Unngå «mange små» produkter uten oversikt.</p>
                <p style={{ marginTop: 8 }}><strong>Vitamin E</strong></p>
                <p>Aktuelt ved lite friskt gras, høy treningsbelastning, eller dårlig grovfôrkvalitet. Virker som antioksidant sammen med selen.</p>
                <p style={{ marginTop: 8 }}><strong>Olje som energitilskudd</strong></p>
                <p>Olje gir mye energi uten stivelse/sukker. Krever gradvis tilvenning over ca. 3 uker. Opptil 3–5 dl/dag for en 500 kg hest.</p>
              </InfoBox>

              {supplements.length === 0 && <div style={{ textAlign: "center", padding: "16px", color: "#8a8378", fontSize: 13 }}>Ingen tilskudd lagt til.</div>}

              {supplements.map((s, i) => (
                <SupplementEntry key={s.productId + i} entry={s}
                  onChange={u => { const n = [...supplements]; n[i] = u; setSupplements(n); }}
                  onRemove={() => setSupplements(supplements.filter((_, j) => j !== i))} />
              ))}
              <button onClick={() => setShowSuppPicker(true)} style={{ width: "100%", padding: "10px", border: "2px dashed #d5cfc6", borderRadius: 10, background: "transparent", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: "#8a8378" }}>+ Legg til tilskudd</button>
            </div>
          </div>
        )}

        {/* === OPPSUMMERING TAB === */}
        {activeSection === "oppsummering" && (
          <div>
            <h2 style={{ fontFamily: "'Quicksand'", fontSize: 20, fontWeight: 800, color: "#2a2520", margin: "0 0 8px" }}>Oppsummering fôrplan</h2>

            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2ddd5", padding: 16, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#3a3632", marginBottom: 10 }}>Dekning av behov</div>
              <NutrientBar label="Energi (FEh)" value={totals.FEh} target={needs.FEh} unit="FEh" />
              <NutrientBar label="Protein (DCP)" value={totals.protein} target={needs.protein} unit="g" colorFn={getProteinColor} />
              <NutrientBar label="Kalsium (Ca)" value={totals.Ca} target={needs.Ca} unit="g" />
              <NutrientBar label="Fosfor (P)" value={totals.P} target={needs.P} unit="g" />
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #e8e4dd", display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#5a5347", flexWrap: "wrap", gap: 8 }}>
                <span>Ca:P = <strong style={{ color: totals.caP >= 1.5 && totals.caP <= 2.5 ? "#27ae60" : totals.caP < 1.2 ? "#c0392b" : "#e67e22" }}>{totals.caP > 0 ? totals.caP.toFixed(2) : "—"}</strong> (mål: 1,5–2,5)</span>
                <span>Grovfôr: <strong>{totals.grovforTsPer100.toFixed(1)}</strong> kg TS/100 kg</span>
              </div>
            </div>

            {warnings.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                {warnings.map((w, i) => (
                  <div key={i} style={{ padding: "8px 12px", background: `${w.color}0d`, border: `1px solid ${w.color}40`, borderRadius: 8, marginBottom: 6, fontSize: 13, color: w.color, fontWeight: 600, lineHeight: 1.5 }}>
                    {w.color === "#c0392b" ? "🔴" : w.color === "#e67e22" ? "🟡" : w.color === "#f9a825" ? "🟡" : "🔵"} {w.text}
                  </div>
                ))}
              </div>
            )}

            {totals.FEh === 0 && (
              <div style={{ textAlign: "center", padding: "24px 16px", color: "#8a8378", fontSize: 13, background: "#fff", borderRadius: 12, border: "1px solid #e2ddd5" }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>📋</div>
                Legg inn grovfôrmengder for å se oppsummering.
              </div>
            )}

            {totals.FEh > 0 && (
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2ddd5", padding: 16, marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#3a3632", marginBottom: 8 }}>Slik beregnes behovet</div>
                <div style={{ fontSize: 12.5, color: "#5a5347", lineHeight: 1.7 }}>
                  <div>{horse.name} ({horse.weight} kg {horse.breed}):</div>
                  <div style={{ marginTop: 4, paddingLeft: 8 }}>
                    <div>Vedlikehold: {needs.FEh_base.toFixed(2)} FEh</div>
                    {horse.trainingFactor > 0 && <div>+ {horse.trainingLabel}: +{(needs.FEh_base * horse.trainingFactor).toFixed(2)} FEh</div>}
                    {horse.growthFactor > 0 && <div>+ Vekst: +{(needs.FEh_base * horse.growthFactor).toFixed(2)} FEh</div>}
                    {horse.breedingFactor > 0 && <div>+ Avl: +{(needs.FEh_base * horse.breedingFactor).toFixed(2)} FEh</div>}
                    {needs.bcsFactor !== 1.0 && <div style={{ color: needs.bcsFactor < 1 ? "#2980b9" : "#c0392b" }}>× Hold BCS {horse.bcs} ({needs.bcsFactor < 1 ? "" : "+"}{Math.round((needs.bcsFactor - 1) * 100)} %)</div>}
                    <div style={{ borderTop: "1px solid #e8e4dd", marginTop: 4, paddingTop: 4, fontWeight: 700 }}>= {needs.FEh} FEh/dag</div>
                  </div>
                  <div style={{ marginTop: 6 }}>Protein: {needs.protein} g/dag ({needs.proteinRatio} g per FEh)</div>
                  {needs.bcsFactor !== 1.0 && <div style={{ fontSize: 11.5, color: "#8a8378" }}>(Protein beregnes FØR holdjustering)</div>}
                  <div>Kalsium: {needs.Ca} g · Fosfor: {needs.P} g</div>
                </div>
              </div>
            )}

            {/* Fôrliste */}
            {totals.FEh > 0 && (
              <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2ddd5", padding: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#3a3632", marginBottom: 8 }}>Fôrliste</div>
                {roughages.filter(r => r.kgPerDay > 0).map((r, i) => {
                  const ti = ROUGHAGE_TYPES.find(t => t.id === r.typeId);
                  const ci = CUTTING_TIMES.find(c => c.id === r.cutting);
                  return (
                    <div key={`r${i}`} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f0ece6", fontSize: 13 }}>
                      <span style={{ color: "#5a5347" }}>🌾 {ti?.shortLabel || "Grovfôr"}, {ci?.label?.toLowerCase()}</span>
                      <span style={{ fontWeight: 700 }}>{r.kgPerDay} kg</span>
                    </div>
                  );
                })}
                {concentrates.filter(c => getEffectiveKg(c) > 0).map((c, i) => {
                  const prod = CONCENTRATES.find(p => p.id === c.productId);
                  const totalKg = getEffectiveKg(c);
                  const mode = c.inputMode || "kg";
                  let detail = "";
                  if (mode === "liter") detail = ` (${c.literPerMeal}L × ${c.mealsPerDay})`;
                  else if (mode === "boks") detail = ` (${c.boxesPerMeal} boks × ${c.mealsPerDay})`;
                  else detail = ` (${(totalKg / (c.mealsPerDay || 1)).toFixed(1)} kg × ${c.mealsPerDay})`;
                  return (
                    <div key={`c${i}`} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f0ece6", fontSize: 13 }}>
                      <span style={{ color: "#5a5347" }}>🌽 {prod?.name} ({prod?.supplier})</span>
                      <span style={{ fontWeight: 700 }}>{totalKg.toFixed(1)} kg <span style={{ fontWeight: 400, color: "#8a8378" }}>{detail}</span></span>
                    </div>
                  );
                })}
                {supplements.filter(s => (s.amount || 0) > 0).map((s, i) => {
                  const prod = SUPPLEMENTS.find(p => p.id === s.productId);
                  return (
                    <div key={`s${i}`} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f0ece6", fontSize: 13 }}>
                      <span style={{ color: "#5a5347" }}>💊 {prod?.name}</span>
                      <span style={{ fontWeight: 700 }}>{s.amount} {prod?.unit}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: "1px solid #e2ddd5", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 600, margin: "0 auto", zIndex: 200 }}>
        {onBack && (
          <button onClick={onBack} style={{ padding: "11px 22px", border: "none", borderRadius: 10, background: "#f0ece6", color: "#5a5347", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>← Tilbake</button>
        )}
        {onComplete && (
          <button onClick={() => {
            const enrichedRoughages = roughages.map(r => {
              const typeInfo = ROUGHAGE_TYPES.find(t => t.id === r.typeId);
              const cutInfo = CUTTING_TIMES.find(c => c.id === r.cutting);
              const ts = r.customTS || (typeInfo?.ts || 72);
              const tsFrac = ts / 100;
              if (r.customMode && r.customFEh > 0) {
                return { name: `${typeInfo?.shortLabel || "Grovfôr"}, ${cutInfo?.label?.toLowerCase() || ""}`, kgPerDay: r.kgPerDay, tsPercent: ts, FEh: r.customFEh, protein: r.customProt || 0, Ca: r.customCa || 0, P: r.customP || 0 };
              }
              return { name: `${typeInfo?.shortLabel || "Grovfôr"}, ${cutInfo?.label?.toLowerCase() || ""}`, kgPerDay: r.kgPerDay, tsPercent: ts, FEh: (cutInfo?.FEh || 0) * tsFrac, protein: (cutInfo?.protein || 0) * tsFrac, Ca: (cutInfo?.Ca || 0) * tsFrac, P: (cutInfo?.P || 0) * tsFrac };
            });
            const enrichedConcentrates = concentrates.map(c => {
              const prod = CONCENTRATES.find(p => p.id === c.productId);
              return { ...c, name: prod?.name || "", supplier: prod?.supplier || "", FEh: prod?.FEh || 0, protein: prod?.protein || 0, Ca: prod?.Ca || 0, P: prod?.P || 0, density: c.customDensity || prod?.density || 0.70 };
            });
            const enrichedSupplements = supplements.map(s => {
              const prod = SUPPLEMENTS.find(p => p.id === s.productId);
              return { ...s, name: prod?.name || "", FEh: prod?.FEh || 0, protein: prod?.protein || 0, Ca: prod?.Ca || 0, P: prod?.P || 0, unit: prod?.unit || "g" };
            });
            onComplete({ roughages: enrichedRoughages, concentrates: enrichedConcentrates, supplements: enrichedSupplements });
          }} style={{ padding: "11px 26px", border: "none", borderRadius: 10, background: "linear-gradient(135deg, #2d8a56, #0d9488)", color: "#fff", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 10px #2d8a5630", marginLeft: "auto" }}>Se resultater →</button>
        )}
      </div>

      {/* Product pickers */}
      {showConcPicker && (
        <ProductPicker title="Velg kraftfôr" products={CONCENTRATES} onClose={() => setShowConcPicker(false)}
          onSelect={p => { setConcentrates([...concentrates, { productId: p.id, inputMode: "kg", kgPerMeal: 0, literPerMeal: 0, boxesPerMeal: 0, boxWeightKg: 0, mealsPerDay: 2 }]); setShowConcPicker(false); }} />
      )}
      {showSuppPicker && (
        <ProductPicker title="Velg tilskudd" products={SUPPLEMENTS} onClose={() => setShowSuppPicker(false)}
          onSelect={p => { setSupplements([...supplements, { productId: p.id, amount: p.typical || 0 }]); setShowSuppPicker(false); }} />
      )}
    </div>
  );
}
