# Changelog

Changes against the original app, `live_adjustments` 0.9.3 (Engine Config) in
[cauliflowermossgrape/idrive7-apps](https://github.com/cauliflowermossgrape/idrive7-apps), taken at commit `2c6cfdf`
(Merge PR #139). This repository's version numbers start at 10.10.0.

## 10.17.0

- **Sender button on every page.** With MG Flasher picked, a button under *Send log* in the top-right corner shows the
  tester address in use (`Sender 0xF2`, or `Sender 0xF4` in red) and one press flips it. It changes the same setting as
  *MG Flasher tester address* in Settings. Not shown for the other tunes.

## 10.16.0

- **Setting *MG Flasher tester address*** (`0xF2` the head unit, default; `0xF4` the ENET tester). MG Flasher's own app
  reaches the DME as `0xF4` (its `TesterInterfaceIds.ETHERNET`); the head unit's proxy sends as `0xF2`. On a tester's car
  MG Flasher switches burbles and Max Cooling, but every write from this app got NRC 69, also with tester present, the
  ignition read and the pause, so the sender's address is the main difference left. With `0xF4` every MG Flasher request
  (the prep reads and the write) is sent as `0xF4` and the log says `(as F4)`. The DME's reply goes to that address, so
  this app may not receive it and show a timeout even when the write worked: check on the car. Not yet tried on a car.
- The log's start line names the tester address.

## 10.15.0

- **MG Flasher: read-only probes of the tune's DIDs.** With the other steps before each write, the app now also reads
  `22 69 45`, `22 69 46` and `22 69 47` (map slot, burble slot, Max Cooling) and logs the answers (`MG Flasher prep < ...`).
  A value means the DME knows the DID and holds something there; NRC 31 means it does not know it; NRC 69 means the
  refusal comes before the write. Nothing is changed on the car by a read. Added to find out why every write got NRC 69.

## 10.14.0

- **MG Flasher: the steps the tune's own app takes before a write.** Before each map, burble or Max Cooling write the app
  now sends tester present (`3E 00`), reads DID `0x5820` (the DME's ignition state) and waits 200 ms, as the Android app
  does (its `InitializeModule` with tester present, `GetIgnitionState`, `Thread.Sleep(200)`). The replies are only
  logged (`MG Flasher prep > 3e 00`, `MG Flasher prep < ...`); a refusal there does not stop the write. This is a test
  for the NRC 69 seen on a tester's car, where every write was refused: not yet tried on a car.
- **Burbles: five slots**, not six. The tune's own app shows slots 0 to 4 (OEM, App Slider, Level 1 to 3).

## 10.13.1

- **Send log resolves the server's name through the uplink.** On the car the first test said "No internet"
  (`getaddrinfo ENOTFOUND`): the unit's own resolver (127.0.0.1) does not reach the internet, and `mgu-uplink` hands
  an allowed app its own DNS servers in `<dataDir>/uplink.json` (`/run/mgu-uplink/lease.json` for everyone). `logsend.js`
  now reads them and looks the host up through them (`lookupVia`); with no lease it uses the system resolver as before.
  The log gets a line `log upload: dns <servers|system>`. Test: `kit/tools/test_logsend.js`.

## 10.13.0

- **Send log button** on every page (top-right, under the version): uploads the previous and the current app log to an
  Azure Function, and shows the result (sent / no internet / timed out / rejected / too large / server error).
  New file `logsend.js`; `app.json` gains `"internet": true` and `config.logUpload`; `kit/tools/build.py` writes
  `"mguInternet": true` into the built `package.json` for an app that says `internet`. Test: `kit/tools/test_logsend.js`.

## 10.12.0

- **Every diagnostic request and reply is logged.** For MG Flasher and MHD the app log gets one line per request and per
  reply, for example `MG Flasher > 2e 69 45 02 b0` then `MG Flasher < 6e 69 45`, or `MG Flasher < NRC 69` for a refusal,
  so a failed press can be analysed from the log alone.
- **NRC names.** MG Flasher refusals name the code: NRC 69 reads "invalid DID or data", NRC 96 "incorrect checksum".
- **Startup line.** The log starts with the app version and the chosen tuning software.
- **Log size.** The app log rotates at 25 MB and keeps one old copy (`.log.1`), so the two files stay within 50 MB.

## 10.11.0

- **A refusal from the DME shows its code.** "Not available on this car" now reads "Not available on this car (NRC 31)"
  (the UDS negative response code), so the reason (unknown DID, wrong session, security access) can be read off the screen
  and not only from the app's log. This applies to MHD and MG Flasher alike.
- **The app's version is shown** in small grey text in the top-right corner of every page (`v10.11.0`). The Settings tab is
  drawn by the kit and has none.

## 10.10.0

### The app: `advokat_live_adjustments`

- **Installs beside the original.** The app id is `advokat_live_adjustments` (folder `apps/advokat_live_adjustments`), the
  tile is called "Advokat Engine Config", and the log id is `ADV0` (the original's is `OAA0`). Its settings and data are
  separate from the original's. The shared GPU renderer and controller gate serve both.
- **New tuning software: MG Flasher** (setting *Tuning software*, Custom Code 6.9 and later):
  - **Engine Map:** five slots (Map 1–5, MG Flasher's slots 0–4).
  - **Burbles:** six slots (0–5), one press picks one. BM3 keeps its aggression control.
  - **Max Cooling:** on and off.
  - The requests are the ones MG Flasher's Android app sends: `2E <DID hi> <DID lo> <value> <checksum>` with DIDs
    `0x6945` (map), `0x6946` (burbles) and `0x6947` (Max Cooling), accepted on `6E <DID>`, and asked again while the
    DME is busy (NRC `0x21`, up to 20 times).
  - **Writes only, not tried on a car.** The active slot and which slots are valid are read from RAM addresses that
    come from the Custom Code version's A2L and are not known, so the screen says *accepted*, never *confirmed*, and
    greys out no slot.
- **Tune code is generic.** `tune.js` (`TuneControl`) no longer branches per tuner: what a tune sends is a driver in the
  new `tuners.js`. MHD and MG Flasher are plain data (a spec of requests, how the DME's answer is accepted, optional
  identification and read-back); BM3 is a class. Adding a tune no longer means copying the control logic. The behaviour
  of BM3 and MHD is unchanged: the original's tests for both pass as they were.
- **Pages follow the tune:** Engine Map draws as many slots as the tune has (4 or 5), Burbles shows a slot picker for slot
  tunes, slots the DME does not offer are dimmed and refuse presses, and the "engine light may flash" note is shown for
  MHD only.
- **Safer presses:** a tune with an identification step sends nothing until the DME is identified, and a slot that is
  out of range or not offered is refused without sending.
- Description and *Tuning software* choices in `app.json` name MG Flasher; the README's tuned-DME section, "Adding a
  tune" and the test list are updated.
- Unchanged from the original: Exhaust Flap, Drive mode, the rpm guard, xDrive (experimental), xDrive live, BM3 and
  MHD behaviour, the diagnostic transport. Only two code comments in `diaglink.js` and `xdrive_live.js` no longer name
  apps that are not here.

### The repository

- **Only this app.** The other apps (Redline, M Vitals, eDrive, Live Data, ZF 8HP, Fault Scanner, Doom and the rest), their
  assets, tests and tools, the Doom engine source and the Korean, Russian and Chinese READMEs are removed. The original
  has them.
- **mgu Store source.** `mgu-repo.json` lists `apps/*` only. The original also required the GPU renderer
  (`idrive7-renderd` 2.1.7) and the controller gate (`mgu-inputgate` 1.0.0) and shipped them; this repository requires
  neither, so they must already be on the car. Add the repository to the Store as the branch `main`; the head unit
  builds the app, no catalog is published.
- **Build and tests.** `kit/tools/build.py` loses its special cases for the removed apps. The CI workflows are one kit
  test job (`app-tests.yml`) and `live-adjustments.yml`. `test_live_adjustments.js` gains MG Flasher cases (the real
  requests, busy retry, a refusing DME, plus a made-up-bytes spec for identification, read-back, valid slots and the
  engine rule).
- **README** rewritten for this app, with a disclaimer: use at your own risk, not made or endorsed by BMW.
