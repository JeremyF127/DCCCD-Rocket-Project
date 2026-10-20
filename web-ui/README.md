# Flight Desk

A Vite + Tailwind dashboard for the ESP32 test stand. Vite provides a local development server; production assets are served from the ESP32's LittleFS filesystem.

## Run locally

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env.local` and set `ESP32_URL` to the device IP printed in the PlatformIO serial monitor. This is used by Vite's development proxy.
3. From this directory, run:

   ```powershell
   npm install
   npm run dev
   ```

4. Open the local URL printed by Vite (usually `http://localhost:5173`).

The dashboard displays the potentiometer ADC reading, calibrated motor angle, temperature, and humidity. It can toggle the relay, calibrate the motor, command a target angle from −100° to +100°, stop the motor, and show calibration/movement status. Calibration is an interactive three-step process: manually position the assembly at −100°, 0°, and +100°, clicking Capture at each position. Each capture averages 20 quick potentiometer readings. The calibration panel shows the live ADC value and each captured calibration reading; the firmware does not run a timer or move the motor during calibration. After the third capture, it validates and saves the readings. If a set fails validation, use **Restart calibration** to clear the staged readings and begin again at −100°. Any previously saved valid calibration remains in place until a new set succeeds.

During development, Vite proxies `/pot`, `/degree`, `/temp`, `/humidity`, `/relay`, `/relayState`, `/calibrate`, `/calibration/reset`, `/target`, `/stop`, and `/motorStatus` to `ESP32_URL`, avoiding browser CORS restrictions.

## Deploy to the ESP32

The Vite build writes its static files to the PlatformIO project's `data/` folder. From this directory, run:

```powershell
npm run build
pio run -e freenove_esp32_s3_wroom -t uploadfs
pio run -e freenove_esp32_s3_wroom -t upload
```

Open the ESP32's IP address in a browser. After changing frontend code, run the build and `uploadfs` commands again. The firmware upload is only needed when firmware code changes.

## Device API notes

The firmware exposes `/calibrate?step=1`, `/calibrate?step=2`, and `/calibrate?step=3` to capture each calibration point in order, `/calibration/reset` to clear staged captures and restart at step 1, `/target?angle=<degrees>` to command a target, `/stop` to stop movement, and `/motorStatus` for calibration and motion state. Angle commands are unavailable until calibration is saved.
