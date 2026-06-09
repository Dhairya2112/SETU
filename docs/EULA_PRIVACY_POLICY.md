# POOKIE AI Agent - End User License Agreement (EULA) & Privacy Policy

**Last Updated:** June 2026

By installing, accessing, or using the POOKIE AI Agent ("Software"), you ("User") agree to the terms and conditions outlined in this agreement. If you do not agree to these terms, do not install or use the Software.

---

## 1. Privacy Policy: Local-First & Zero Telemetry

POOKIE is architected entirely around user privacy. Unlike traditional cloud-based assistants, POOKIE operates on a **Local-First** paradigm.

### 1.1 Data Processing
*   **Microphone Audio:** All wake-word detection ("Hey POOKIE") happens entirely on your local CPU. Continuous audio streams are processed locally and discarded immediately. Audio is never sent to external servers unless you explicitly configure a third-party Cloud API (e.g., Groq) for text generation.
*   **Screen Capture (Context Awareness):** Any screenshots taken for "On-Screen Context Awareness" are processed strictly in your device's RAM (memory) by a local offline model. **The image buffer is immediately purged** after processing. No screen data is saved to your hard drive or transmitted to the internet.
*   **Document & File Access:** POOKIE only accesses files within your user directory when you explicitly grant "Level 2 Elevated Access." POOKIE does not index your hard drive in the background, nor does it upload your files.

### 1.2 Zero Cloud Retention
We do not own, rent, or maintain any central database storing your personal information, conversation history, or telemetry data. 
*   All conversation logs are stored in a local MongoDB database hosted directly on your machine.
*   We cannot access, read, or monetize your data because it never leaves your hardware.

---

## 2. Terms of Service & Software Usage

### 2.1 Software Permissions
You grant POOKIE the local permissions required to execute tasks on your behalf. You acknowledge that enabling Level 2 (App & File Access) or Level 3 (System Control) permissions allows the AI to autonomously modify, create, or delete files on your system. 

### 2.2 User Responsibility
Because POOKIE is capable of autonomous system control:
1.  **You are solely responsible** for the consequences of the commands you issue to the AI.
2.  The developers of POOKIE are **not liable** for accidental data loss, system misconfiguration, or unintended application behavior resulting from AI execution.
3.  You must review Windows UAC or Linux polkit prompts before granting Level 3 administrative access.

### 2.3 Legal Compliance
You agree not to use POOKIE to engage in illegal activities, including but not limited to unauthorized access to external systems, malware creation, or data theft.

---

## 3. Disclaimers and Limitations of Liability

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

---

**Acceptance of Terms**
By clicking "I Accept", continuing through the Onboarding Setup, or using the application, you confirm that you have read, understood, and agree to be bound by this EULA and Privacy Policy.
