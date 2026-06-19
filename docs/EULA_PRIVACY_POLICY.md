# Setu AI — End User License Agreement (EULA) & Privacy Policy

**Last Updated:** June 2026

By installing, accessing, or using the Setu AI automation system ("Software"), you ("User") agree to the terms outlined below. If you do not agree, do not install or use the Software.

> Setu (सेतु) is a local-first, privacy-first AI automation system. Your data stays on your hardware.

---

## 1. Privacy Policy: Local-First & Zero Telemetry

Setu is architected entirely around user privacy. Unlike cloud-based AI assistants, Setu operates on a **Local-First** paradigm.

### 1.1 Data Processing

- **Microphone Audio:** All wake-word detection ("Hey Setu") happens entirely on your local CPU using OpenWakeWord. Audio is never streamed to external servers. Speech-to-text (Faster-Whisper) also runs locally. Audio buffers are discarded immediately after transcription.
- **Voice Commands:** Text commands are sent to your configured LLM API (NVIDIA NIM, OpenRouter, or Google Gemini) for processing. These are third-party services with their own privacy policies. Commands are not retained by Setu itself. You acknowledge this by configuring your own API keys.
- **Screen Capture:** Any screenshots taken for task feedback are processed in RAM only, compressed, and sent via your local network WebSocket to your phone. Screenshots are **never written to disk** and **never stored in MongoDB**. The buffer is purged immediately after transmission.
- **File Access:** Setu only accesses files within your home directory when you explicitly grant Level 2 Elevated Access. Setu does not index your hard drive or upload your files.
- **Cross-Device Commands:** Phone-to-laptop commands travel exclusively over your local area network (LAN). No data is relayed through external servers. Commands are encrypted using AES-256-GCM with keys that only exist on your devices.

### 1.2 Zero Cloud Retention

We do not own, rent, or maintain any central database storing your information.

- All conversation history, task logs, user memory, and contacts are stored in a local MongoDB database on your machine.
- We cannot access, read, or monetize your data because it never leaves your hardware.
- LLM API calls are made directly from your machine to the API provider. We are not a proxy.

### 1.3 What IS Stored Locally

| Data | Where | Retention |
|---|---|---|
| Task history (command logs) | Local MongoDB | Auto-deleted after 90 days |
| Conversation messages | Local MongoDB | Until you delete them |
| User memory (preferences, facts) | Local MongoDB | Until you delete them |
| Contacts | Local MongoDB | Until you delete them |
| Device pairing keys (HMAC only) | Local MongoDB | Until pairing is revoked |
| JWT refresh tokens | Local MongoDB | Auto-deleted on expiry (7 days) |

---

## 2. Terms of Service & Software Usage

### 2.1 Software Permissions

You grant Setu the local permissions required to execute tasks on your behalf. You acknowledge that enabling Level 2 (Elevated) permissions allows the AI to open applications, read/write files in your home directory, control browsers, and capture screenshots.

Level 3 (Admin) actions — such as installing software or modifying system settings — will always trigger a native Windows UAC prompt. Setu will never auto-execute Level 3 actions.

### 2.2 User Responsibility

Because Setu is capable of autonomous task execution:

1. **You are solely responsible** for the consequences of the commands you issue.
2. The developers of Setu are **not liable** for accidental data loss, system misconfiguration, or unintended application behavior resulting from AI execution.
3. You must review Windows UAC prompts before granting any Level 3 administrative access.
4. You are responsible for securing your local network. Setu's cross-device feature is LAN-only and assumes your home network is trusted.

### 2.3 Multi-User Accounts

Each user account is isolated. Users cannot access each other's task history, memory, contacts, or paired devices. OAuth authentication (Google/GitHub) is required — no local passwords are stored.

### 2.4 Legal Compliance

You agree not to use Setu to engage in illegal activities, including unauthorized access to external systems, surveillance of others, malware creation, or data theft. Level 4 actions (keylogging, unauthorized remote access, data exfiltration) are hardcoded prohibitions and cannot be enabled under any circumstances.

---

## 3. Prohibited Uses

The following are strictly prohibited and hardcoded off regardless of any user instruction:

- Keylogging or monitoring another person's keystrokes
- Unauthorized remote access to devices you do not own
- Data exfiltration to external servers
- Surveillance or recording of other people without consent

---

## 4. Disclaimers and Limitations of Liability

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

---

**Acceptance**

By clicking "I Accept" in the onboarding wizard, you confirm that you have read, understood, and agree to be bound by this EULA and Privacy Policy.
