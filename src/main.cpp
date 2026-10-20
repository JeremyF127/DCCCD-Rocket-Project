#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <DHT.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <LittleFS.h>

#define DHT11_PIN 6   //Pin locations
#define HORI_PIN 4
#define VERT_PIN 5
#define SDA 21
#define SCL 20
#define RELAY_PIN 45

const int ENA = 17;
const int IN1 = 16;
const int IN2 = 15;

const int PWM_CHANNEL = 0;
const int PWM_FREQUENCY = 1000;
const int PWM_RESOLUTION = 8;

const int MAX_SPEED = 255;
const int MIN_SPEED = 70;
const float POSITION_DEADBAND = 1.0;
const float SLOWDOWN_RANGE = 20.0;
const float MIN_ANGLE = -100.0;
const float MAX_ANGLE = 100.0;
const unsigned long MOTOR_TIMEOUT = 30000;

int adcMinus100 = 0;
int adcZero = 2047;
int adcPlus100 = 4095;
float targetAngle = 0.0;
bool targetActive = false;
bool targetReached = false;
unsigned long movementStartTime = 0;
Preferences preferences;
bool systemReady = false;
bool calibrationActive = false;
int calibrationStep = 0;
int stagedAdcMinus100 = 0;
int stagedAdcZero = 0;
int stagedAdcPlus100 = 0;
bool calibrationMinus100Captured = false;
bool calibrationZeroCaptured = false;
bool calibrationPlus100Captured = false;

DHT dht11(DHT11_PIN, DHT11);

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64

long lastUpdateDHT = 0;
long lastUpdateDegree = 0;
const int interval = 2000;
int currentDisplay[2] = {0, 0};
float tempC;
float tempF; 
float humidity;
int x = 0;
bool relayState = LOW;
float currentDegree = 0;
int potValueMin = 0;
int potValueMax = 0;
int rangePot = 0;
int rangeDegrees = 0;
int total2 = 0;

Adafruit_SSD1306 display(
    SCREEN_WIDTH,
    SCREEN_HEIGHT,
    &Wire,
    -1
);

// Replace these with your Wi-Fi information
const char* ssid = "";
const char* password = "";

// Create a web server listening on port 80
WebServer server(80);


void handleRoot(){
    File file = LittleFS.open("/index.html", "r");
    if (!file) {
        server.send(500, "text/plain", "Website files are missing. Build the Vite app and upload the filesystem image.");
        return;
    }

    server.streamFile(file, "text/html");
    file.close();
}

void handlePot(){
    int potValue = analogRead(HORI_PIN);

    server.send(200, "text/plain", String(potValue));
}

void handleRelay(){
     relayState = !relayState;
     digitalWrite(RELAY_PIN, relayState);
    server.send(200, "text/plain", relayState ? "ON" : "OFF");
}

void handleRelayState(){
    if(relayState == LOW){
        server.send(200, "text/plain", "OFF");
    }
    if(relayState == HIGH){
        server.send(200, "text/plain", "ON");
    }
}

int readPotADC() {
    const int NUM_SAMPLES = 20;
    long total = 0;

    for (int i = 0; i < NUM_SAMPLES; i++) {
        total += analogRead(HORI_PIN);
        delayMicroseconds(500);
    }

    return total / NUM_SAMPLES;
}

float adcToAngle(int adc) {
    float angle;

    if (adc < adcZero) {
        if (adcZero == adcMinus100) {
            return 0.0;
        }

        angle = -100.0f * ((float)(adcZero - adc) / (float)(adcZero - adcMinus100));
    } else {
        if (adcPlus100 == adcZero) {
            return 0.0;
        }

        angle = 100.0f * ((float)(adc - adcZero) / (float)(adcPlus100 - adcZero));
    }

    return constrain(angle, MIN_ANGLE, MAX_ANGLE);
}

void motorStop() {
    digitalWrite(IN1, LOW);
    digitalWrite(IN2, LOW);
    ledcWrite(PWM_CHANNEL, 0);
}

void motorClockwise(int speed) {
    speed = constrain(speed, 0, 255);
    digitalWrite(IN1, HIGH);
    digitalWrite(IN2, LOW);
    ledcWrite(PWM_CHANNEL, speed);
}

void motorCounterClockwise(int speed) {
    speed = constrain(speed, 0, 255);
    digitalWrite(IN1, LOW);
    digitalWrite(IN2, HIGH);
    ledcWrite(PWM_CHANNEL, speed);
}

void saveCalibration() {
    preferences.begin("position", false);
    preferences.putInt("minus100", adcMinus100);
    preferences.putInt("zero", adcZero);
    preferences.putInt("plus100", adcPlus100);
    preferences.end();
    Serial.println("Calibration saved.");
}

bool loadCalibration() {
    preferences.begin("position", true);
    bool valid = preferences.isKey("minus100") && preferences.isKey("zero") && preferences.isKey("plus100");

    if (valid) {
        adcMinus100 = preferences.getInt("minus100", 0);
        adcZero = preferences.getInt("zero", 2047);
        adcPlus100 = preferences.getInt("plus100", 4095);
        stagedAdcMinus100 = adcMinus100;
        stagedAdcZero = adcZero;
        stagedAdcPlus100 = adcPlus100;
        calibrationMinus100Captured = true;
        calibrationZeroCaptured = true;
        calibrationPlus100Captured = true;
    }

    preferences.end();
    return valid;
}

int calculateMotorSpeed(float error) {
    float absoluteError = abs(error);

    if (absoluteError >= SLOWDOWN_RANGE) {
        return MAX_SPEED;
    }

    float ratio = (absoluteError - POSITION_DEADBAND) / (SLOWDOWN_RANGE - POSITION_DEADBAND);
    ratio = constrain(ratio, 0.0f, 1.0f);

    float speed = MIN_SPEED + ratio * (MAX_SPEED - MIN_SPEED);
    return constrain((int)speed, MIN_SPEED, MAX_SPEED);
}

void updateMotor() {
    int adc = readPotADC();
    float actualAngle = adcToAngle(adc);
    float error = targetAngle - actualAngle;

    if (actualAngle <= -99.5 && error < 0) {
        motorStop();
        targetActive = false;
        targetReached = false;
        Serial.println("SAFETY STOP: -100° limit.");
        return;
    }

    if (actualAngle >= 99.5 && error > 0) {
        motorStop();
        targetActive = false;
        targetReached = false;
        Serial.println("SAFETY STOP: +100° limit.");
        return;
    }

    if (abs(error) <= POSITION_DEADBAND) {
        motorStop();
        targetActive = false;
        targetReached = true;
        Serial.print("TARGET REACHED: ");
        Serial.print(actualAngle, 2);
        Serial.println("°");
        return;
    }

    if (millis() - movementStartTime > MOTOR_TIMEOUT) {
        motorStop();
        targetActive = false;
        targetReached = false;
        Serial.println("SAFETY STOP: Motor timeout.");
        return;
    }

    int speed = calculateMotorSpeed(error);

    if (error > 0) {
        motorClockwise(speed);
    } else {
        motorCounterClockwise(speed);
    }
}

void handleCalibrate() {
    if (!server.hasArg("step")) {
        server.send(400, "text/plain", "Missing calibration step (1, 2, or 3)");
        return;
    }

    int requestedStep = server.arg("step").toInt();
    if (requestedStep < 1 || requestedStep > 3) {
        server.send(400, "text/plain", "Calibration step must be 1, 2, or 3");
        return;
    }

    if (requestedStep == 1) {
        motorStop();
        targetActive = false;
        targetReached = false;
        calibrationActive = true;
        calibrationStep = 1;
        calibrationMinus100Captured = false;
        calibrationZeroCaptured = false;
        calibrationPlus100Captured = false;
    } else if (!calibrationActive || requestedStep != calibrationStep) {
        server.send(409, "text/plain", "Calibration step is out of sequence");
        return;
    }

    const int capturedAdc = readPotADC();
    if (requestedStep == 1) {
        stagedAdcMinus100 = capturedAdc;
        calibrationMinus100Captured = true;
        calibrationStep = 2;
    } else if (requestedStep == 2) {
        stagedAdcZero = capturedAdc;
        calibrationZeroCaptured = true;
        calibrationStep = 3;
    } else {
        stagedAdcPlus100 = capturedAdc;
        calibrationPlus100Captured = true;
        bool increasing = stagedAdcMinus100 < stagedAdcZero &&
                          stagedAdcZero < stagedAdcPlus100;
        bool decreasing = stagedAdcMinus100 > stagedAdcZero &&
                          stagedAdcZero > stagedAdcPlus100;

        if (!increasing && !decreasing) {
            calibrationActive = false;
            calibrationStep = 0;
            server.send(422, "text/plain",
                        "Captured ADC: " + String(capturedAdc) +
                        "\nCalibration readings must be distinct and monotonic. Restart calibration and recapture all three positions.");
            return;
        }

        adcMinus100 = stagedAdcMinus100;
        adcZero = stagedAdcZero;
        adcPlus100 = stagedAdcPlus100;
        saveCalibration();
        systemReady = true;
        calibrationActive = false;
        calibrationStep = 0;
    }

    Serial.print("Calibration step ");
    Serial.print(requestedStep);
    Serial.print(" captured ADC ");
    Serial.println(capturedAdc);

    if (requestedStep == 3) {
        server.send(200, "text/plain",
                    "Captured ADC: " + String(capturedAdc) +
                    "\nCalibration complete and saved");
    } else {
        server.send(200, "text/plain",
                    "Captured ADC: " + String(capturedAdc) +
                    ". Next calibration step: " + String(calibrationStep));
    }
}

void handleStopMotor() {
    targetActive = false;
    targetReached = false;
    calibrationActive = false;
    calibrationStep = 0;
    motorStop();
    server.send(200, "text/plain", "Motor stopped; active calibration cancelled");
}

void handleResetCalibration() {
    motorStop();
    targetActive = false;
    targetReached = false;
    calibrationActive = true;
    calibrationStep = 1;
    stagedAdcMinus100 = 0;
    stagedAdcZero = 0;
    stagedAdcPlus100 = 0;
    calibrationMinus100Captured = false;
    calibrationZeroCaptured = false;
    calibrationPlus100Captured = false;
    server.send(200, "text/plain", "Calibration reset. Capture the -100 degree position to begin again.");
}

void handleSetTarget() {
    if (calibrationActive) {
        server.send(409, "text/plain", "Finish or restart calibration before moving the motor");
        return;
    }

    if (!systemReady) {
        server.send(409, "text/plain", "System not calibrated yet");
        return;
    }

    if (!server.hasArg("angle")) {
        server.send(400, "text/plain", "Missing angle parameter");
        return;
    }

    float newTarget = server.arg("angle").toFloat();
    if (newTarget < MIN_ANGLE || newTarget > MAX_ANGLE) {
        server.send(400, "text/plain", "Target must be between -100 and +100 degrees");
        return;
    }

    targetAngle = newTarget;
    targetReached = false;
    targetActive = true;
    movementStartTime = millis();
    server.send(200, "text/plain", String(targetAngle, 1));
}

void handleMotorStatus() {
    int adc = readPotADC();
    float actualAngle = adcToAngle(adc);

    String response = "systemReady=" + String(systemReady ? "true" : "false") + "\n";
    response += "targetActive=" + String(targetActive ? "true" : "false") + "\n";
    response += "targetReached=" + String(targetReached ? "true" : "false") + "\n";
    response += "calibrationActive=" + String(calibrationActive ? "true" : "false") + "\n";
    response += "calibrationStep=" + String(calibrationStep) + "\n";
    response += "calibrationMinus100Captured=" + String(calibrationMinus100Captured ? "true" : "false") + "\n";
    response += "calibrationMinus100=" + String(stagedAdcMinus100) + "\n";
    response += "calibrationZeroCaptured=" + String(calibrationZeroCaptured ? "true" : "false") + "\n";
    response += "calibrationZero=" + String(stagedAdcZero) + "\n";
    response += "calibrationPlus100Captured=" + String(calibrationPlus100Captured ? "true" : "false") + "\n";
    response += "calibrationPlus100=" + String(stagedAdcPlus100) + "\n";
    response += "actualAngle=" + String(actualAngle, 2) + "\n";
    response += "targetAngle=" + String(targetAngle, 2) + "\n";
    response += "adc=" + String(adc);

    server.send(200, "text/plain", response);
}

void handleDegree(){
    int potValue = analogRead(HORI_PIN);

    float objectiveDegree = (8.0/117.0) * potValue;
    float displayedDegree = objectiveDegree - 140.0;

    server.send(200, "text/plain", String(displayedDegree, 2));

} 



void handleTemp(){

    if(isnan(tempC) || isnan(tempF)){
        server.send(200, "text/plain", "INVALID READING");
        }
    else{
        String data = String(tempC) + " | " + String(tempF);
    server.send(200, "text/plain", data);
    }
    }

void handleHumidity(){
    if(isnan(humidity)){
        server.send(200, "text/plain", "INVALID READING");
    }
    else{
    server.send(200, "text/plain", String(humidity));
    }
}

void setup()
{
    Wire.begin(SDA, SCL);
    Serial.begin(115200);

    if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
        Serial.println("OLED initialization failed");
        while (true);
    }

    dht11.begin();
    if (!LittleFS.begin(false)) {
        Serial.println("LittleFS mount failed. Upload the website filesystem image.");
    }

    // Connect ESP32 to Wi-Fi
    WiFi.begin(ssid, password);

    Serial.println("Connecting to Wi-Fi...");

    while (WiFi.status() != WL_CONNECTED)
    {
        delay(500);
        Serial.print(".");
    }

    Serial.println();
    Serial.println("Connected!");

    // Print the ESP32's local IP address
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());

    server.on("/", handleRoot);
    server.serveStatic("/assets/", LittleFS, "/assets/");

    // When browser requests "/pot", run handlePot
    server.on("/pot", handlePot);

    // When browser requests "/degree", run handleDegree
    server.on("/degree", handleDegree);

    server.on("/temp", handleTemp);


    server.on("/humidity", handleHumidity);

    server.on("/relay", handleRelay);  //relay button

    server.on("/relayState", handleRelayState); //checks for current relay state
    server.on("/calibrate", handleCalibrate);
    server.on("/calibration/reset", handleResetCalibration);
    server.on("/stop", handleStopMotor);
    server.on("/target", handleSetTarget);
    server.on("/motorStatus", handleMotorStatus);

    // Start web server
    server.begin();

    Serial.println("Web server started.");

    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);

    display.clearDisplay();
    display.display();

    pinMode(RELAY_PIN, OUTPUT);
    pinMode(IN1, OUTPUT);
    pinMode(IN2, OUTPUT);
    ledcSetup(PWM_CHANNEL, PWM_FREQUENCY, PWM_RESOLUTION);
    ledcAttachPin(ENA, PWM_CHANNEL);
    motorStop();

    if (loadCalibration()) {
        systemReady = true;
        Serial.println("Saved calibration loaded.");
    } else {
        systemReady = false;
        Serial.println("NO CALIBRATION FOUND");
        Serial.println("Use the website's three-step calibration controls to calibrate the motor.");
    }
}


void loop()
{
    server.handleClient();

    if (systemReady && targetActive) {
        updateMotor();
    }

    display.setCursor(0, 40);
    display.println("Degrees Rotation");

    long currentTime = millis();

    if(currentTime - lastUpdateDegree >= 250){
        int potValue = analogRead(HORI_PIN);
        float objectiveDegree = (8.0/117.0) * potValue;
        float displayedDegree = objectiveDegree - 140.0;
        display.fillRect(0, 48, 128, 8, SSD1306_BLACK);
        display.display();
        display.setCursor(0, 48);
        display.print(displayedDegree);
        display.display();
        lastUpdateDegree = currentTime;
    }

    if(currentTime - lastUpdateDHT >= 2000){
        humidity = dht11.readHumidity();
        tempC = dht11.readTemperature();
        tempF = dht11.readTemperature(true);
        lastUpdateDHT = currentTime;

        display.setCursor(0, 0);
        display.fillRect(0, 0, 128, 8, SSD1306_BLACK);
        display.display();
        if(x == 0){
            display.println("Temperature");
        }
        if(x == 1){
            display.println("Humidity");
        }

        display.setCursor(0, 16);
        display.fillRect(0, 16, 128, 8, SSD1306_BLACK);
        if(x == 0){
            if(isnan(tempC) || isnan(tempF)){
                display.println("READING ERROR");
            }
            else {
                display.print(tempC);
                display.print("C | ");
                display.print(tempF);
                display.println("F");
            }
        }
        if(x == 1){
            if(isnan(humidity)){
                display.println("READING ERROR");
            }
            else{
                display.println(humidity);
            }
        }

        x++;
        if(x == 2){
            x = 0;
        }
    }
    display.display();
}