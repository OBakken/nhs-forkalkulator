import { useState, useCallback } from "react";
import RegistreringWizard from "./registrering_v5.jsx";
import FeedSelection from "./forvalg_v4.jsx";
import ResultsPage from "./resultat_v4.jsx";

// --- Transformerer registreringsdata til horse-objekt ---
const CATEGORY_FACTORS = {
  ponni: 1.0, kaldblods: 1.0, varmblods: 1.05, fullblods: 1.10,
};

const TRAINING_LABELS = [
  "Vedlikehold", "Lett trening", "Moderat trening", "Hard trening", "Intens trening",
];
const TRAINING_FACTORS = [0, 0.25, 0.50, 0.75, 1.00];

const APP_STEPS = [
  { id: "registrering", label: "Registrering" },
  { id: "forvalg", label: "Fôrplan" },
  { id: "resultat", label: "Resultater" },
];

// Må matche registrering_v5.jsx sin calculateTrainingLevel eksakt
function calculateTrainingLevel(frequency, conditioning, duration) {
  const totalDager = { "1-2": 1.5, "3": 3, "4-5": 4.5, "6-7": 6.5 }[frequency] || 0;
  const hardDays   = { "0": 0, "1": 1, "2": 2, "3": 3, "4+": 4.5 }[conditioning] || 0;
  const easyDays   = Math.max(0, totalDager - hardDays);
  const durScore   = { "kort": 0.7, "middels": 1.0, "lang": 1.6, "veldig_lang": 2.8 }[duration] || 1.0;

  const raw = (hardDays / 7) * 3.0 * durScore
            + (easyDays / 7) * 0.6 * durScore;

  if (raw < 0.25) return 0;
  if (raw < 0.65) return 1;
  if (raw < 1.30) return 2;
  if (raw < 2.30) return 3;
  return 4;
}

function buildHorseObject(data) {
  const trainingLevel = data.trainingLevelOverride !== null && data.trainingLevelOverride !== undefined
    ? data.trainingLevelOverride
    : calculateTrainingLevel(data.frequency, data.conditioning, data.duration);

  const isYoung = data.ageMonths !== null && data.ageMonths < 36;
  const category = data.category || "kaldblods";
  const pregMonth = data.pregMonth || 0;
  const lactMonth = data.lactMonth || 0;

  let breedingFactor = 0;
  if (pregMonth >= 9) breedingFactor = { 9: 0.15, 10: 0.25, 11: 0.30 }[pregMonth] || 0;

  return {
    name:                  data.horseName || "",
    breed:                 data.breed || "",
    category:              category,
    weight:                data.weight || 0,
    ageMonths:             data.ageMonths,
    sex:                   data.sex,
    isStal:                data.sex === "hingst",
    bcs:                   data.bcs || 3,
    trainingLevel:         trainingLevel,
    trainingLabel:         TRAINING_LABELS[trainingLevel] || "Vedlikehold",
    trainingFactor:        TRAINING_FACTORS[trainingLevel] || 0,
    growthStage:           isYoung ? "young" : "adult",
    growthFactor:          0.0,
    typeFactor:            CATEGORY_FACTORS[category] || 1.0,
    pregMonth:             pregMonth,
    lactMonth:             lactMonth,
    breedingFactor:        breedingFactor,
    youngIntensiveRearing: data.youngIntensiveRearing || false,
    youngOutdoorHerd:      data.youngOutdoorHerd || false,
  };
}

// --- Toppmeny ---
function AppNavBar({ currentStep, onNavigate }) {
  const stepIndex = APP_STEPS.findIndex(s => s.id === currentStep);
  return (
    <div style={{
      background: "linear-gradient(135deg, #1a3a2a 0%, #0c1f14 100%)",
      padding: "0 16px", position: "sticky", top: 0, zIndex: 300,
    }}>
      <div style={{ display: "flex", maxWidth: 600, margin: "0 auto" }}>
        {APP_STEPS.map((s, i) => (
          <button key={s.id} onClick={() => onNavigate(s.id)} style={{
            flex: 1, padding: "12px 8px", border: "none", background: "none",
            cursor: "pointer", fontFamily: "'DM Sans', 'Nunito', sans-serif",
            textAlign: "center",
            borderBottom: i === stepIndex ? "3px solid #4ade80" : "3px solid transparent",
            transition: "border-color 0.2s",
          }}>
            <span style={{
              fontSize: 13, fontWeight: i === stepIndex ? 800 : 600,
              color: i === stepIndex ? "#fff" : "rgba(255,255,255,0.5)",
              transition: "color 0.2s",
            }}>{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [appStep, setAppStep] = useState("registrering");
  const [registreringData, setRegistreringData] = useState(null);
  const [feedData, setFeedData] = useState(null);

  const handleRegistreringChange = useCallback((data) => {
    setRegistreringData(data);
  }, []);

  const handleRegistreringComplete = useCallback((data) => {
    setRegistreringData(data);
    setAppStep("forvalg");
  }, []);

  const handleFeedChange = useCallback((feed) => {
    setFeedData(feed);
  }, []);

  const handleFeedComplete = useCallback((feed) => {
    setFeedData(feed);
    setAppStep("resultat");
  }, []);

  const handleNavigate = useCallback((stepId) => {
    // Tillat fri navigasjon, men ikke til forvalg/resultat uten registreringsdata
    if (stepId === "forvalg" && !registreringData) return;
    if (stepId === "resultat" && (!registreringData || !feedData)) return;
    setAppStep(stepId);
  }, [registreringData, feedData]);

  const handleBack = useCallback(() => {
    if (appStep === "resultat") setAppStep("forvalg");
    else if (appStep === "forvalg") setAppStep("registrering");
  }, [appStep]);

  const horse = registreringData ? buildHorseObject(registreringData) : null;
  const showReg = appStep === "registrering";
  const showForvalg = appStep === "forvalg";
  const showResultat = appStep === "resultat";

  return (
    <div>
      <AppNavBar currentStep={appStep} onNavigate={handleNavigate} />

      {/* Alle komponenter holdes montert for å bevare intern state — kun synlighet toggles */}
      <div style={{ display: showReg ? "block" : "none" }}>
        <RegistreringWizard onComplete={handleRegistreringComplete} onChange={handleRegistreringChange} />
      </div>

      {horse && (
        <div style={{ display: showForvalg ? "block" : "none" }}>
          <FeedSelection
            horse={horse}
            onChange={handleFeedChange}
            onComplete={handleFeedComplete}
            onBack={handleBack}
          />
        </div>
      )}

      {horse && feedData && (
        <div style={{ display: showResultat ? "block" : "none" }}>
          <ResultsPage horseData={horse} feedData={feedData} />
          <div style={{
            position: "fixed", bottom: 0, left: 0, right: 0,
            background: "#fff", borderTop: "1px solid #e2ddd5",
            padding: "12px 16px", display: "flex", justifyContent: "center",
            alignItems: "center", maxWidth: 600, margin: "0 auto", zIndex: 200,
          }}>
            <button onClick={handleBack} style={{
              padding: "11px 26px", border: "none", borderRadius: 10,
              background: "#f0ece6", color: "#5a5347",
              fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}>← Tilbake</button>
          </div>
        </div>
      )}
    </div>
  );
}
