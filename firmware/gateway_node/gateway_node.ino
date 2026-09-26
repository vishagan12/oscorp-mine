#include <WiFi.h>
#include <esp_now.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ─── Network Config ─────────────────────────────────────────────────────────
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* BACKEND_URL = "http://192.168.1.100:5001"; // Update to match backend IP

// ─── Known MAC Addresses ──────────────────────────────────────────────────
uint8_t SEISMIC_MAC[] = {0xAA, 0xBB, 0xCC, 0x11, 0x22, 0x33};
uint8_t HELMET_MAC[]  = {0xAA, 0xBB, 0xCC, 0x44, 0x55, 0x66};
uint8_t HEXAPOD_MAC[] = {0xAA, 0xBB, 0xCC, 0x77, 0x88, 0x99};

// ─── Data Structures ──────────────────────────────────────────────────────────
typedef struct SeismicPacket {
  char zone[32];
  float magnitude;
  float confidence;
} SeismicPacket;

typedef struct HelmetPacket {
  char worker_id[16];
  int bpm;
  float temp;
  bool helmet_on;
} HelmetPacket;

typedef struct ScanPacket {
  float robot_x;
  float robot_y;
  float robot_heading;
  float distances[19];
  int gas_ppm;
} ScanPacket;

// Helper to compare MAC addresses
bool matchMac(const uint8_t *mac1, const uint8_t *mac2) {
  for (int i=0; i<6; i++) {
    if (mac1[i] != mac2[i]) return false;
  }
  return true;
}

// ─── HTTP POST Helper ────────────────────────────────────────────────────────
void postData(const char* endpoint, const char* jsonPayload) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    String url = String(BACKEND_URL) + endpoint;
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    
    int httpResponseCode = http.POST(jsonPayload);
    Serial.printf("POST to %s - Response Code: %d\n", endpoint, httpResponseCode);
    http.end();
  } else {
    Serial.println("WiFi Disconnected. Cannot POST.");
  }
}

// ─── ESP-NOW Receive Callback ────────────────────────────────────────────────
void OnDataRecv(const uint8_t * mac, const uint8_t *incomingData, int len) {
  StaticJsonDocument<1024> doc;
  char jsonBuffer[1024];

  if (matchMac(mac, SEISMIC_MAC)) {
    if (len == sizeof(SeismicPacket)) {
      SeismicPacket pkt;
      memcpy(&pkt, incomingData, sizeof(pkt));
      doc["zone"] = pkt.zone;
      doc["magnitude"] = pkt.magnitude;
      doc["confidence"] = pkt.confidence;
      serializeJson(doc, jsonBuffer);
      postData("/api/seismic", jsonBuffer);
    }
  } 
  else if (matchMac(mac, HELMET_MAC)) {
    if (len == sizeof(HelmetPacket)) {
      HelmetPacket pkt;
      memcpy(&pkt, incomingData, sizeof(pkt));
      // Split into two endpoints matching backend logic
      doc["workerId"] = pkt.worker_id;
      doc["bpm"] = pkt.bpm;
      doc["temp"] = pkt.temp;
      serializeJson(doc, jsonBuffer);
      postData("/api/worker/vitals", jsonBuffer);
      
      doc.clear();
      doc["workerId"] = pkt.worker_id;
      doc["helmetOn"] = pkt.helmet_on;
      serializeJson(doc, jsonBuffer);
      postData("/api/worker/helmet", jsonBuffer);
    }
  }
  else if (matchMac(mac, HEXAPOD_MAC)) {
    if (len == sizeof(ScanPacket)) {
      ScanPacket pkt;
      memcpy(&pkt, incomingData, sizeof(pkt));
      doc["robot_x"] = pkt.robot_x;
      doc["robot_y"] = pkt.robot_y;
      doc["robot_heading"] = pkt.robot_heading;
      doc["gas_ppm"] = pkt.gas_ppm;
      
      JsonArray distances = doc.createNestedArray("distances");
      for (int i=0; i<19; i++) {
        distances.add(pkt.distances[i]);
      }
      
      serializeJson(doc, jsonBuffer);
      postData("/api/hexapod/scan", jsonBuffer);
    }
  } else {
    Serial.println("Received packet from unknown MAC address.");
  }
}

void setup() {
  Serial.begin(115200);

  // Connect WiFi
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected.");

  // Init ESP-NOW
  if (esp_now_init() != ESP_OK) {
    Serial.println("Error initializing ESP-NOW");
    return;
  }
  
  // Register callback
  esp_now_register_recv_cb(OnDataRecv);
  Serial.println("Gateway Node ready. Listening for sensor packets...");
}

void loop() {
  // ESP-NOW handles receiving in the background.
  delay(10000);
}
