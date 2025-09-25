// MQTT Client for ESP32
// Install PubSubClient library in Arduino IDE: Sketch > Include Library > Manage Libraries > Search for "PubSubClient"

#include <WiFi.h>
#include <PubSubClient.h>

// WiFi credentials
const char* ssid = "AIMS-WIFI";
const char* password = "Aimswifi#2025";

// MQTT Broker settings
const char* mqtt_server = "172.16.3.171"; // Your backend IP (or localhost if running on same machine)
const int mqtt_port = 1883;
const char* mqtt_user = ""; // Leave empty if no auth
const char* mqtt_password = ""; // Leave empty if no auth

// Device settings
const char* device_id = "esp32_001";
const char* switch_topic = "esp32/switches";
const char* state_topic = "esp32/state";

WiFiClient espClient;
PubSubClient client(espClient);

// Relay pins (example)
#define RELAY1 16
#define RELAY2 17

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Connecting to ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi connected");
  Serial.println("IP address: ");
  Serial.println(WiFi.localIP());
}

void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.print("] ");

  String message;
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.println(message);

  // Parse MQTT message for switch commands
  if (String(topic) == switch_topic) {
    // Expected format: "relay1:on" or "relay1:off"
    int colonIndex = message.indexOf(':');
    if (colonIndex > 0) {
      String relay = message.substring(0, colonIndex);
      String state = message.substring(colonIndex + 1);

      if (relay == "relay1") {
        digitalWrite(RELAY1, state == "on" ? HIGH : LOW);
        Serial.printf("Relay1 set to %s\n", state.c_str());
      } else if (relay == "relay2") {
        digitalWrite(RELAY2, state == "on" ? HIGH : LOW);
        Serial.printf("Relay2 set to %s\n", state.c_str());
      }
    }
  }
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    if (client.connect(device_id, mqtt_user, mqtt_password)) {
      Serial.println("connected");
      client.subscribe(switch_topic);
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(RELAY1, OUTPUT);
  pinMode(RELAY2, OUTPUT);

  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  // Publish state every 30 seconds
  static unsigned long lastMsg = 0;
  unsigned long now = millis();
  if (now - lastMsg > 30000) {
    lastMsg = now;
    String stateMsg = String("relay1:") + (digitalRead(RELAY1) ? "on" : "off") +
                      ",relay2:" + (digitalRead(RELAY2) ? "on" : "off");
    client.publish(state_topic, stateMsg.c_str());
    Serial.println("Published state: " + stateMsg);
  }
}