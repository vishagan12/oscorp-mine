#include <esp_now.h>
#include <WiFi.h>
#include <ESP32Servo.h>

// ─── Pin Configurations ───────────────────────────────────────────────────────
const int SERVO_PIN = 18;
const int TRIG_PIN = 5;
const int ECHO_PIN = 17;
const int GAS_PIN = 3; // ADC1_CH3

// ─── Network Settings ─────────────────────────────────────────────────────────
// Set to the MAC Address of the Gateway Node
uint8_t gatewayMacAddress[] = {0x11, 0x22, 0x33, 0x44, 0x55, 0x66};

// ─── Data Structures ──────────────────────────────────────────────────────────
typedef struct ScanPacket {
  float robot_x;
  float robot_y;
  float robot_heading;
  float distances[19]; // 19 steps (0 to 180 degrees by 10)
  int gas_ppm;
} ScanPacket;

ScanPacket packet;
esp_now_peer_info_t peerInfo;
Servo scannerServo;

// ─── Dead-reckoning State ─────────────────────────────────────────────────────
float current_x = -185.0; // Start at some default
float current_y = 0.0;
float current_heading = 0.0;

// Callback when data is sent
void OnDataSent(const uint8_t *mac_addr, esp_now_send_status_t status) {
  Serial.print("Last Packet Send Status: ");
  Serial.println(status == ESP_NOW_SEND_SUCCESS ? "Delivery Success" : "Delivery Fail");
}

float measureDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  
  long duration = pulseIn(ECHO_PIN, HIGH, 30000); // 30ms timeout (~5 meters)
  if (duration == 0) return -1.0; // timeout/no reflection
  
  float distance = duration * 0.034 / 2.0; // speed of sound in cm/us
  return distance / 100.0; // return in meters
}

void setup() {
  Serial.begin(115200);
  
  // Initialize Pins
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  
  scannerServo.attach(SERVO_PIN);
  
  // Initialize WiFi
  WiFi.mode(WIFI_STA);
  if (esp_now_init() != ESP_OK) {
    Serial.println("Error initializing ESP-NOW");
    return;
  }
  
  // Register peer
  esp_now_register_send_cb(OnDataSent);
  memcpy(peerInfo.peer_addr, gatewayMacAddress, 6);
  peerInfo.channel = 0;  
  peerInfo.encrypt = false;
  
  if (esp_now_add_peer(&peerInfo) != ESP_OK){
    Serial.println("Failed to add peer");
    return;
  }
}

void loop() {
  Serial.println("--- Starting Sweep ---");
  
  // Simulate movement (dead-reckoning)
  current_x += 0.2; 
  // Update packet with latest position
  packet.robot_x = current_x;
  packet.robot_y = current_y;
  packet.robot_heading = current_heading;
  
  // Read gas sensor (rough mapping from analog to PPM for demo)
  int rawGas = analogRead(GAS_PIN);
  packet.gas_ppm = map(rawGas, 0, 4095, 140, 1000); 

  // Sweep Servo 0 to 180 in 10 degree increments (19 readings)
  for (int i = 0; i <= 18; i++) {
    int angle = i * 10;
    scannerServo.write(angle);
    delay(50); // wait for servo to reach position
    
    packet.distances[i] = measureDistance();
    Serial.printf("Angle: %d deg, Dist: %.2f m\n", angle, packet.distances[i]);
  }
  
  // Return servo to 0 quickly for next sweep
  scannerServo.write(0);
  
  // Send packet via ESP-NOW
  esp_err_t result = esp_now_send(gatewayMacAddress, (uint8_t *) &packet, sizeof(ScanPacket));
  
  if (result == ESP_OK) {
    Serial.println("Sent with success");
  } else {
    Serial.println("Error sending the data");
  }
  
  delay(1000);
}
