# David Screen Fire TV Wrapper

This is a very small Android wrapper for Fire TV.

The dashboard itself still lives on the hosted website.
This app just opens that one URL and stays out of the way.

## Chosen SDK Values

- `compileSdk 34`
- `targetSdk 30`
- `minSdk 25`

Why these:

- `minSdk 25` keeps the wrapper practical for older Fire TV / Fire OS devices
- `targetSdk 30` stays close to Fire OS 8 / Android 11 behavior, which is a
  sensible middle ground for a sideloaded home-use TV app
- `compileSdk 34` lets the project build with a current Android toolchain

## Package And Launch Details

- Package name: `com.davidscreen.firetv`
- Main activity: `com.davidscreen.firetv.MainActivity`

## Where To Change Things Later

- Hosted URL: `app/src/main/java/com/davidscreen/firetv/AppConfig.java`
- App name: `app/src/main/res/values/strings.xml`
- App icon mark: `app/src/main/res/drawable/ic_david_mark.xml`
- Launcher icon set: `app/src/main/res/mipmap-anydpi-v26/`
- TV banner: `app/src/main/res/drawable/tv_banner.xml`

## Open In Android Studio

1. Open Android Studio
2. Choose `Open`
3. Select the `firetv-wrapper` folder
4. Let Gradle sync

## Build Debug APK

From the `firetv-wrapper` folder:

```bash
./gradlew assembleDebug
```

APK output:

```text
app/build/outputs/apk/debug/app-debug.apk
```

## ADB Connect To Fire TV

Turn on developer options and ADB debugging on the Fire TV first.

ADB connect format:

```bash
adb connect FIRE_TV_IP:5555
```

Example:

```bash
adb connect 192.168.1.50:5555
```

## Install The APK

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## Launch The App

Using the exact activity:

```bash
adb shell am start -n com.davidscreen.firetv/.MainActivity
```

If you want the launcher-category route instead:

```bash
adb shell monkey -p com.davidscreen.firetv -c android.intent.category.LEANBACK_LAUNCHER 1
```

## What The App Does

- opens one hosted dashboard URL
- uses a full-screen WebView
- blocks random external browsing
- shows a simple reconnect screen if the page fails
- gives one big Retry button
- auto-retries in the background

## Small Practical Notes

- This is meant for sideloading and home use, not Appstore submission yet.
- Future dashboard updates should happen on the hosted site, not by rebuilding
  the wrapper.
- If the hosted URL changes, update `AppConfig.java`, rebuild, and reinstall.
