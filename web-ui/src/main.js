import "@fontsource-variable/space-grotesk";
import "@fontsource/dm-mono/400.css";
import "@fontsource/dm-mono/500.css";
import "./style.css";
import {
  Activity,
  ArrowUpRight,
  CircleAlert,
  Crosshair,
  createIcons,
  Droplets,
  Gauge,
  Power,
  Radio,
  RefreshCw,
  Thermometer,
  Wifi,
} from "lucide";

const app = document.querySelector("#app");
const configuredTarget = __ESP32_TARGET__;
const isDevelopment = import.meta.env.DEV;

app.innerHTML = `
  <div class="min-h-screen">
    <header class="topbar">
      <a class="brand" href="#" aria-label="Flight Desk home">
        <span class="brand-mark"><i data-lucide="radio"></i></span>
        <span class="brand-copy"><strong>FIELDNOTE</strong><small>FLIGHT SYSTEMS</small></span>
      </a>
      <div class="topbar-center"><span class="live-dot"></span> ROCKET TEST STAND <span class="topbar-divider">/</span> CONTROL 01</div>
      <div class="connection-pill" id="connectionPill"><span class="status-dot"></span><span id="connectionText">WAITING FOR DEVICE</span></div>
    </header>

    <main class="dashboard mx-auto w-full max-w-[1440px] px-5 pb-12 sm:px-8">
      <section class="page-heading">
        <div>
          <p class="eyebrow"><span class="eyebrow-line"></span> LIVE INSTRUMENTATION <span class="eyebrow-index">01 — 04</span></p>
          <h1>Flight <span>desk.</span></h1>
          <p class="heading-note">Live readings from the test stand.</p>
        </div>
        <button class="refresh-button" id="refreshButton" type="button" title="Refresh telemetry" aria-label="Refresh telemetry">
          <i data-lucide="refresh-cw"></i><span>Refresh</span>
        </button>
      </section>

      <section class="instrument-grid" aria-label="Live instrumentation">
        <article class="panel angle-panel">
          <div class="panel-heading light-heading">
            <div class="panel-label"><span class="label-icon"><i data-lucide="crosshair"></i></span><span>CALCULATED ANGLE</span></div>
            <span class="micro-tag">LIVE · 4 Hz</span>
          </div>
          <div class="angle-readout">
            <span class="angle-value" id="degreeValue">--.-</span><span class="angle-unit">°</span>
          </div>
          <div class="angle-meter" aria-label="Angle position">
            <div class="meter-track"><span class="meter-center"></span><span class="meter-marker" id="degreeMarker"></span></div>
            <div class="meter-labels"><span>−100°</span><span>0°</span><span>+100°</span></div>
          </div>
          <div class="panel-rule"></div>
          <div class="pot-readout">
            <div class="pot-readout-label"><span class="pot-readout-icon"><i data-lucide="gauge"></i></span><span>RAW POTENTIOMETER</span></div>
            <div class="pot-value-row"><strong id="potValue">----</strong><span>ADC</span></div>
          </div>
        </article>

        <article class="panel sensor-panel temperature-panel">
          <div class="panel-heading">
            <div class="panel-label"><span class="sensor-icon temp-icon"><i data-lucide="thermometer"></i></span><span>TEMPERATURE</span></div>
            <span class="micro-tag">DHT11</span>
          </div>
          <div class="sensor-value"><span id="tempC">--.-</span><small>°C</small></div>
          <div class="sensor-secondary"><span>FAHRENHEIT</span><strong id="tempF">--.- °F</strong></div>
          <div class="sensor-baseline temp-baseline"><span></span></div>
          <p class="sensor-caption">AMBIENT AIR</p>
        </article>

        <article class="panel sensor-panel humidity-panel">
          <div class="panel-heading">
            <div class="panel-label"><span class="sensor-icon humidity-icon"><i data-lucide="droplets"></i></span><span>HUMIDITY</span></div>
            <span class="micro-tag">DHT11</span>
          </div>
          <div class="sensor-value"><span id="humidityValue">--</span><small>%</small></div>
          <div class="humidity-track"><span id="humidityBar"></span></div>
          <div class="sensor-secondary"><span>RELATIVE HUMIDITY</span><strong id="humidityCondition">AWAITING DATA</strong></div>
          <p class="sensor-caption">AMBIENT AIR</p>
        </article>

        <article class="panel relay-panel pressure-relay-panel">
          <div class="panel-heading">
            <div class="panel-label"><span class="sensor-icon relay-icon"><i data-lucide="power"></i></span><span>PRESSURE RELAY</span></div>
            <span class="micro-tag">GPIO 45</span>
          </div>
          <div class="relay-state-row"><div><p class="relay-kicker">OUTPUT STATE</p><h2 id="relayValue">OFF</h2></div><span class="relay-indicator" id="relayIndicator"></span></div>
          <button class="relay-button" id="relayButton" type="button"><i data-lucide="power"></i><span id="relayButtonText">Energize relay</span><i class="button-arrow" data-lucide="arrow-up-right"></i></button>
          <p class="relay-footnote">Controls the pressure relay output.</p>
        </article>

        <article class="panel relay-panel release-relay-panel">
          <div class="panel-heading">
            <div class="panel-label"><span class="sensor-icon relay-icon"><i data-lucide="power"></i></span><span>RELEASE RELAY</span></div>
            <span class="micro-tag">GPIO 48</span>
          </div>
          <div class="relay-state-row"><div><p class="relay-kicker">OUTPUT STATE</p><h2 id="releaseRelayValue">OFF</h2></div><span class="relay-indicator" id="releaseRelayIndicator"></span></div>
          <button class="relay-button" id="releaseRelayButton" type="button"><i data-lucide="power"></i><span id="releaseRelayButtonText">Energize relay</span><i class="button-arrow" data-lucide="arrow-up-right"></i></button>
          <p class="relay-footnote">Controls the release relay output.</p>
        </article>
      </section>

      <section class="panel motor-panel" aria-labelledby="motorHeading">
        <div class="motor-heading">
          <div>
            <p class="eyebrow"><span class="eyebrow-line"></span> POSITION CONTROL</p>
            <h2 id="motorHeading">Motor <span>control.</span></h2>
          </div>
          <div class="motor-state" id="motorState" role="status">CHECKING CALIBRATION</div>
        </div>
        <div class="motor-controls">
          <form id="targetForm" class="target-form">
            <label for="targetAngle">DESIRED ANGLE <span>−100° to +100°</span></label>
            <div class="target-input-row">
              <input id="targetAngle" name="angle" type="number" min="-100" max="100" step="0.1" value="0" required>
              <span class="target-unit">°</span>
              <button class="control-button control-primary" id="moveButton" type="submit" disabled>Move to angle</button>
            </div>
          </form>
          <button class="control-button control-stop" id="stopButton" type="button" disabled>Stop motor</button>
          <button class="control-button control-calibrate" id="calibrateButton" type="button">Capture −100°</button>
          <button class="control-button control-calibrate-reset" id="resetCalibrationButton" type="button">Restart calibration</button>
        </div>
        <p class="motor-help" id="motorHelp">Calibration is required before motor movement. Keep the assembly clear while it moves.</p>
        <p class="calibration-prompt" id="calibrationPrompt" aria-live="polite">Step 1 of 3: Move the assembly by hand to −100°, then click Capture to read this position.</p>
        <ol class="calibration-progress" aria-label="Calibration positions">
          <li id="calibrationPoint1">1 <span>−100°</span></li>
          <li id="calibrationPoint2">2 <span>0°</span></li>
          <li id="calibrationPoint3">3 <span>+100°</span></li>
        </ol>
        <div class="calibration-readings" aria-label="Potentiometer calibration readings">
          <div class="calibration-reading calibration-reading-live">
            <span>LIVE POTENTIOMETER</span>
            <strong id="calibrationLiveAdc">----</strong>
            <small>ADC</small>
          </div>
          <div class="calibration-reading">
            <span>−100° CAPTURE</span>
            <strong id="calibrationMinus100Adc">----</strong>
            <small>ADC</small>
          </div>
          <div class="calibration-reading">
            <span>0° CAPTURE</span>
            <strong id="calibrationZeroAdc">----</strong>
            <small>ADC</small>
          </div>
          <div class="calibration-reading">
            <span>+100° CAPTURE</span>
            <strong id="calibrationPlus100Adc">----</strong>
            <small>ADC</small>
          </div>
        </div>
        <p class="calibration-steps">Each click averages 20 quick potentiometer readings at the current position. The firmware does not move the motor or wait on a timer during calibration; manually position the assembly before each capture.</p>
      </section>

      <section class="bottom-bar" aria-label="Device connection">
        <div class="bottom-status"><i data-lucide="activity"></i><span id="statusMessage">Connecting to the test stand…</span></div>
        <div class="device-address"><i data-lucide="wifi"></i><span>DEVICE</span><strong id="deviceAddress"></strong></div>
        <div class="last-update"><span class="last-update-dot"></span> POLL INTERVAL <strong>500 MS</strong></div>
      </section>
      <div class="toast" id="toast" role="status" aria-live="polite"></div>
      <div class="setup-note" id="setupNote" hidden><i data-lucide="circle-alert"></i><span>Set <code>ESP32_URL</code> in <code>.env.local</code> to the device IP, then restart Vite.</span></div>
    </main>
    <footer class="page-footer"><span>FIELDNOTE <b>·</b> TEST STAND INTERFACE</span><span>TELEMETRY REFRESHES AUTOMATICALLY</span></footer>
  </div>
`;

createIcons({
  icons: {
    Activity,
    ArrowUpRight,
    CircleAlert,
    Crosshair,
    Droplets,
    Gauge,
    Power,
    Radio,
    RefreshCw,
    Thermometer,
    Wifi,
  },
});

const elements = {
  connectionPill: document.querySelector("#connectionPill"),
  connectionText: document.querySelector("#connectionText"),
  statusMessage: document.querySelector("#statusMessage"),
  deviceAddress: document.querySelector("#deviceAddress"),
  setupNote: document.querySelector("#setupNote"),
  degreeValue: document.querySelector("#degreeValue"),
  degreeMarker: document.querySelector("#degreeMarker"),
  potValue: document.querySelector("#potValue"),
  tempC: document.querySelector("#tempC"),
  tempF: document.querySelector("#tempF"),
  humidityValue: document.querySelector("#humidityValue"),
  humidityBar: document.querySelector("#humidityBar"),
  humidityCondition: document.querySelector("#humidityCondition"),
  relayValue: document.querySelector("#relayValue"),
  relayIndicator: document.querySelector("#relayIndicator"),
  relayButtonText: document.querySelector("#relayButtonText"),
  releaseRelayValue: document.querySelector("#releaseRelayValue"),
  releaseRelayIndicator: document.querySelector("#releaseRelayIndicator"),
  releaseRelayButtonText: document.querySelector("#releaseRelayButtonText"),
  toast: document.querySelector("#toast"),
  motorState: document.querySelector("#motorState"),
  motorHelp: document.querySelector("#motorHelp"),
  targetForm: document.querySelector("#targetForm"),
  targetAngle: document.querySelector("#targetAngle"),
  moveButton: document.querySelector("#moveButton"),
  stopButton: document.querySelector("#stopButton"),
  calibrateButton: document.querySelector("#calibrateButton"),
  resetCalibrationButton: document.querySelector("#resetCalibrationButton"),
  calibrationPrompt: document.querySelector("#calibrationPrompt"),
  calibrationLiveAdc: document.querySelector("#calibrationLiveAdc"),
  calibrationReadings: [
    document.querySelector("#calibrationMinus100Adc"),
    document.querySelector("#calibrationZeroAdc"),
    document.querySelector("#calibrationPlus100Adc"),
  ],
  calibrationPoints: [
    document.querySelector("#calibrationPoint1"),
    document.querySelector("#calibrationPoint2"),
    document.querySelector("#calibrationPoint3"),
  ],
};

const displayTarget = isDevelopment
  ? configuredTarget || "NOT CONFIGURED"
  : window.location.host;
elements.deviceAddress.textContent = displayTarget.replace(/^https?:\/\//, "");
elements.setupNote.hidden = !isDevelopment || Boolean(configuredTarget);
if (isDevelopment && !configuredTarget) {
  elements.statusMessage.textContent = "Device address required before telemetry can start.";
}

let toastTimer;
let calibrationStepToCapture = 1;
let calibrationFinished = false;
let lastTargetReached = false;
let hasObservedMotorStatus = false;
function showToast(message, isError = false) {
  elements.toast.textContent = message;
  elements.toast.classList.toggle("toast-error", isError);
  elements.toast.classList.add("toast-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("toast-visible"), 3200);
}

async function readEndpoint(path) {
  if (isDevelopment && !configuredTarget) return null;
  try {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

async function sendCommand(path) {
  if (isDevelopment && !configuredTarget) {
    throw new Error("Set ESP32_URL in web-ui/.env.local before sending device commands.");
  }

  const response = await fetch(path, { cache: "no-store" });
  const body = await response.text();
  if (!response.ok) throw new Error(body || `Device returned HTTP ${response.status}.`);
  return body;
}

function setConnection(online) {
  elements.connectionPill.classList.toggle("is-online", online);
  elements.connectionText.textContent = online ? "DEVICE ONLINE" : "DEVICE OFFLINE";
  if (online) elements.statusMessage.textContent = "Receiving live telemetry from the test stand.";
  else if (configuredTarget) elements.statusMessage.textContent = "No response from the device. Check Wi-Fi and ESP32_URL.";
}

function updateMotorStatus(rawValue) {
  if (!rawValue) return;
  const status = Object.fromEntries(
    rawValue.split(/\r?\n/).map((line) => {
      const separator = line.indexOf("=");
      return separator < 0 ? [line, ""] : [line.slice(0, separator), line.slice(separator + 1)];
    }),
  );
  elements.calibrationLiveAdc.textContent = status.adc ?? "----";
  const capturedReadings = [
    [status.calibrationMinus100Captured, status.calibrationMinus100],
    [status.calibrationZeroCaptured, status.calibrationZero],
    [status.calibrationPlus100Captured, status.calibrationPlus100],
  ];
  elements.calibrationReadings.forEach((valueElement, index) => {
    const [captured, reading] = capturedReadings[index];
    valueElement.textContent = captured === "true" ? reading : "----";
  });

  const calibrated = status.systemReady === "true";
  const moving = status.targetActive === "true";
  const reached = status.targetReached === "true" && !moving;
  const calibrating = status.calibrationActive === "true";
  if (hasObservedMotorStatus && reached && !lastTargetReached) {
    showToast(`Desired angle reached: ${Number(status.targetAngle).toFixed(1)}°.`);
  }
  lastTargetReached = reached;
  hasObservedMotorStatus = true;
  const requestedStep = Number(status.calibrationStep);
  calibrationStepToCapture = calibrating && requestedStep >= 1 && requestedStep <= 3
    ? requestedStep
    : 1;

  elements.motorState.classList.toggle("motor-state-reached", reached);
  elements.motorState.textContent = calibrating
    ? `CALIBRATION · STEP ${calibrationStepToCapture} OF 3`
    : !calibrated
      ? "CALIBRATION REQUIRED"
      : moving
        ? `MOVING TO ${Number(status.targetAngle).toFixed(1)}°`
        : reached
          ? `TARGET REACHED · ${Number(status.targetAngle).toFixed(1)}°`
          : `READY · TARGET ${Number(status.targetAngle).toFixed(1)}°`;
  elements.moveButton.disabled = !calibrated || calibrating;
  elements.stopButton.disabled = !moving;
  elements.motorHelp.textContent = calibrated
    ? reached
      ? `Desired angle reached at ${Number(status.actualAngle).toFixed(1)}°. Enter another target to move again.`
      : `Current position: ${Number(status.actualAngle).toFixed(1)}°. ${moving ? "Motor is moving; use Stop motor to halt it." : "Enter a target between −100° and +100°."}`
    : "Run calibration before requesting motor movement. Keep the assembly clear while it moves.";
  const calibrationAngles = ["−100°", "0°", "+100°"];
  const activeAngle = calibrationAngles[calibrationStepToCapture - 1];
  elements.calibrateButton.textContent = calibrated && !calibrating
    ? "Recalibrate · capture −100°"
    : `Capture ${activeAngle}`;
  elements.calibrationPrompt.textContent = calibrationFinished && !calibrating
    ? "Calibration saved. To recalibrate, reposition the assembly at −100° and capture each of the three positions again."
    : `Step ${calibrationStepToCapture} of 3: Move the assembly by hand to ${activeAngle}, then click Capture to read this position.`;
  elements.calibrationPoints.forEach((point, index) => {
    point.classList.toggle("calibration-point-done", calibrating && index < calibrationStepToCapture - 1);
    point.classList.toggle("calibration-point-current", calibrating ? index === calibrationStepToCapture - 1 : index === 0);
  });

  if (calibrated && Number.isFinite(Number(status.actualAngle))) {
    updateAngle(status.actualAngle);
  } else {
    elements.degreeValue.textContent = "--.-";
  }
}

function updateAngle(rawValue) {
  const value = Number.parseFloat(rawValue);
  if (!Number.isFinite(value)) return;
  elements.degreeValue.textContent = value.toFixed(1);
  const clamped = Math.max(-100, Math.min(100, value));
  elements.degreeMarker.style.left = `${((clamped + 100) / 200) * 100}%`;
}

function updateTemperature(rawValue) {
  if (!rawValue || rawValue.includes("INVALID")) return;
  const [celsius, fahrenheit] = rawValue.split("|").map((part) => Number.parseFloat(part));
  if (Number.isFinite(celsius)) elements.tempC.textContent = celsius.toFixed(1);
  if (Number.isFinite(fahrenheit)) elements.tempF.textContent = `${fahrenheit.toFixed(1)} °F`;
}

function updateHumidity(rawValue) {
  const value = Number.parseFloat(rawValue);
  if (!Number.isFinite(value)) return;
  const bounded = Math.max(0, Math.min(100, value));
  elements.humidityValue.textContent = value.toFixed(1);
  elements.humidityBar.style.width = `${bounded}%`;
  elements.humidityCondition.textContent = value < 30 ? "DRY" : value > 60 ? "HUMID" : "COMFORTABLE";
}

function updateRelay(rawValue, valueElement, indicatorElement, buttonTextElement) {
  if (!rawValue) return;
  const isOn = rawValue.trim().toUpperCase() === "ON";
  valueElement.textContent = isOn ? "ON" : "OFF";
  valueElement.classList.toggle("relay-on", isOn);
  indicatorElement.classList.toggle("relay-indicator-on", isOn);
  buttonTextElement.textContent = isOn ? "De-energize relay" : "Energize relay";
}

async function refreshTelemetry() {
  if (isDevelopment && !configuredTarget) return;
  const [pot, degree, temperature, humidity, pressureRelay, releaseRelay, motorStatus] = await Promise.all([
    readEndpoint("/pot"),
    readEndpoint("/degree"),
    readEndpoint("/temp"),
    readEndpoint("/humidity"),
    readEndpoint("/pressureRelayState"),
    readEndpoint("/releaseRelayState"),
    readEndpoint("/motorStatus"),
  ]);
  const responses = [pot, degree, temperature, humidity, pressureRelay, releaseRelay, motorStatus];
  setConnection(responses.some((value) => value !== null));
  if (pot !== null) elements.potValue.textContent = pot.trim();
  if (motorStatus !== null) updateMotorStatus(motorStatus);
  else if (degree !== null) updateAngle(degree);
  if (temperature !== null) updateTemperature(temperature);
  if (humidity !== null) updateHumidity(humidity);
  if (pressureRelay !== null) {
    updateRelay(pressureRelay, elements.relayValue, elements.relayIndicator, elements.relayButtonText);
  }
  if (releaseRelay !== null) {
    updateRelay(releaseRelay, elements.releaseRelayValue, elements.releaseRelayIndicator, elements.releaseRelayButtonText);
  }
}

document.querySelector("#refreshButton").addEventListener("click", refreshTelemetry);
async function toggleRelay(path, relayName) {
  try {
    await sendCommand(path);
    await refreshTelemetry();
    showToast(`${relayName} command sent.`);
  } catch (error) {
    showToast(`Could not control ${relayName.toLowerCase()}: ${error.message}`, true);
  }
}

document.querySelector("#relayButton").addEventListener("click", () => {
  toggleRelay("/pressureRelay", "Pressure relay");
});
document.querySelector("#releaseRelayButton").addEventListener("click", () => {
  toggleRelay("/releaseRelay", "Release relay");
});

elements.targetForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const angle = Number(elements.targetAngle.value);
  if (!Number.isFinite(angle) || angle < -100 || angle > 100) {
    showToast("Enter an angle from −100° to +100°.", true);
    return;
  }

  elements.moveButton.disabled = true;
  try {
    await sendCommand(`/target?angle=${encodeURIComponent(angle)}`);
    lastTargetReached = false;
    showToast(`Motor target set to ${angle.toFixed(1)}°.`);
    await refreshTelemetry();
  } catch (error) {
    showToast(`Could not set motor target: ${error.message}`, true);
    await refreshTelemetry();
  }
});

elements.stopButton.addEventListener("click", async () => {
  elements.stopButton.disabled = true;
  try {
    await sendCommand("/stop");
    showToast("Motor stopped.");
  } catch (error) {
    showToast(`Could not stop motor: ${error.message}`, true);
  }
  await refreshTelemetry();
});

elements.resetCalibrationButton.addEventListener("click", async () => {
  elements.resetCalibrationButton.disabled = true;
  try {
    await sendCommand("/calibration/reset");
    calibrationFinished = false;
    showToast("Calibration restarted. Capture the −100° position to begin.");
  } catch (error) {
    showToast(`Could not restart calibration: ${error.message}`, true);
  } finally {
    elements.resetCalibrationButton.disabled = false;
    await refreshTelemetry();
  }
});

elements.calibrateButton.addEventListener("click", async () => {
  const capturedStep = calibrationStepToCapture;
  elements.calibrateButton.disabled = true;
  try {
    const response = await sendCommand(`/calibrate?step=${capturedStep}`);
    const capturedAdc = response.match(/Captured ADC:\s*(\d+)/i)?.[1];
    if (capturedAdc !== undefined) {
      elements.calibrationReadings[capturedStep - 1].textContent = capturedAdc;
      elements.calibrationPoints[capturedStep - 1].classList.add("calibration-point-done");
    }

    elements.calibrationPoints.forEach((point) => {
      point.classList.remove("calibration-point-current");
    });

    if (response.includes("Calibration complete")) {
      calibrationFinished = true;
      calibrationStepToCapture = 1;
      elements.calibrationPrompt.textContent = "Calibration saved. To recalibrate, reposition the assembly at −100° and capture each of the three positions again.";
      elements.calibrateButton.textContent = "Recalibrate · capture −100°";
      showToast("All three positions captured; calibration saved.");
    } else {
      calibrationFinished = false;
      calibrationStepToCapture = capturedStep + 1;
      const nextAngle = ["−100°", "0°", "+100°"][calibrationStepToCapture - 1];
      elements.calibrateButton.textContent = `Capture ${nextAngle}`;
      elements.calibrationPrompt.textContent = `Step ${calibrationStepToCapture} of 3: Move the assembly by hand to ${nextAngle}, then click Capture to read this position.`;
      elements.calibrationPoints[calibrationStepToCapture - 1].classList.add("calibration-point-current");
      showToast(`Position ${capturedStep} captured${capturedAdc ? `: ${capturedAdc} ADC` : ""}.`);
    }
  } catch (error) {
    const capturedAdc = error.message.match(/Captured ADC:\s*(\d+)/i)?.[1];
    if (capturedAdc !== undefined) {
      elements.calibrationReadings[capturedStep - 1].textContent = capturedAdc;
      elements.calibrationPoints[capturedStep - 1].classList.add("calibration-point-done");
    }
    showToast(`Could not capture this calibration position: ${error.message}`, true);
    elements.calibrationPrompt.textContent = `Capture failed: ${error.message}. Check the device connection and try this position again.`;
  } finally {
    elements.calibrateButton.disabled = false;
    await refreshTelemetry();
  }
});

refreshTelemetry();
window.setInterval(refreshTelemetry, 500);
