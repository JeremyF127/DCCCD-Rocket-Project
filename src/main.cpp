#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <DHT.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define DHT11_PIN 5   //Pin locations
#define POT_PIN 4
#define SDA 21
#define SCL 20
#define RELAY_PIN 45

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

Adafruit_SSD1306 display(
    SCREEN_WIDTH,
    SCREEN_HEIGHT,
    &Wire,
    -1
);

// Replace these with your Wi-Fi information
const char* ssid = "WIFI SSID";
const char* password = "WIFI PASSWORD";

// Create a web server listening on port 80
WebServer server(80);


// This function runs when someone visits "/"
void handleRoot(){

    server.send(    //website architecture in HTML then Javascript for updating function values on the webpage
        200,
        "text/html",
        R"rawliteral(
        <html>
        <body>
            <h1> Potentiometer Display </h1>
            <br>
            <h2> ADC Reading </h2>
            <span id = "potValue">0</span>
            <br>
            <h2> Degrees for Disk </h2>
            <span id = "degreeValue">0</span>
            <br>
            <h2> Temperature </h2>
            <span id = "tempValue">0</span>
            <br>
            <h2> Humidity </h2>
            <span id = "humidityValue">0</span>

            <br>

            <button onclick="turnRelayOn()">Relay Control</button> 



            <script>    
                function turnRelayOn(){
                fetch("/relay")}

                function updatePot(){   // potentiometer function
                fetch("/pot")
                .then(response => response.text())
                .then(value => {
                    document.getElementById("potValue").textContent=value;
                    })       
                    }

                function updateDegree(){
                fetch("/degree")
                .then(response => response.text())
                .then(value => {
                    document.getElementById("degreeValue").textContent=value;
                })
                }
                

                function updateTemp(){
                fetch("/temp")
                .then(response => response.text())
                .then(value => {
                    document.getElementById("tempValue").textContent=value;
                })
                }

                function updateHumidity(){
                fetch("/humidity")
                .then(response => response.text())
                .then(value => {
                    document.getElementById("humidityValue").textContent=value;
                })
                }
                setInterval(updatePot, 500);
                setInterval(updateDegree, 500);
                setInterval(updateTemp, 2000);
                setInterval(updateHumidity, 2000);

            </script>

        )rawliteral"
        );
}

void handlePot(){
    int potValue = analogRead(POT_PIN);

    server.send(200, "text/plain", String(potValue));
}

void handleRelay(){
     relayState = !relayState;
     digitalWrite(RELAY_PIN, relayState);
}

void handleDegree(){
    int potValue = analogRead(POT_PIN);

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

    // When browser requests "/", run handleRoot()
    server.on("/", handleRoot);

    // When browser requests "/pot", run handlePot
    server.on("/pot", handlePot);

    // When browser requests "/degree", run handleDegree
    server.on("/degree", handleDegree);

    server.on("/temp", handleTemp);


    server.on("/humidity", handleHumidity);

    server.on("/relay", handleRelay);  //relay button

    // Start web server
    server.begin();

    Serial.println("Web server started.");

    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);

    display.clearDisplay();
    display.display();

    pinMode(RELAY_PIN, OUTPUT);
   
}


void loop()
{
    // Check for incoming browser requests
    server.handleClient();


    display.setCursor(0, 40);    //display logic for potentiometer readings
    display.println("Degrees Rotation");
    

    


    long currentTime = millis();
    

    if(currentTime - lastUpdateDegree >= 250){
        int potValue = analogRead(4);
        float objectiveDegree = (8.0/117.0) * potValue;
        float displayedDegree = objectiveDegree - 140.0;
        display.fillRect(0, 48, 128, 8, SSD1306_BLACK);
        display.display();
        display.setCursor(0, 48);
        display.print(displayedDegree);
        display.display();
        lastUpdateDegree = currentTime;
    }

    if(currentTime - lastUpdateDHT >= 2000){  //updating temp and humidity every 2s to not stress sensor
        humidity = dht11.readHumidity();
        tempC = dht11.readTemperature();
        tempF = dht11.readTemperature(true);
        lastUpdateDHT = currentTime;


        display.setCursor(0, 0);     //updating alternating temp and humidity readings every 2s while keeping degrees always
        display.fillRect(0, 0, 128, 8, SSD1306_BLACK);
        display.display();
        if(x == 0){   //
            display.println("Temperature");   //temp = 0, humidity = 1
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