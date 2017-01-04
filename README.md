# webvr-demo

A low-poly snow scene to demonstrate [webVR API](https://webvr.info/) for the [Show Me The Code](https://www.facebook.com/groups/1122128014540022/) event.

![](http://i.imgur.com/kCat7Sf.png)

## Instructions

Since WebVR is not supported in all stable versions of mainstream browser, in order to interact from the scene:

### For mobile devices

For all phones (only tested on Android), if webVR is not available in your browser, a polyfill will be loaded so it will be available on all phones. If you have a Google Cardboard or similar mobile VR devices (currently only the Google I/O cardboard parameters are included), you can enter Cardboard Mode.

If you happen to have an Android 7.0+ devices, you can [Google VR Service](https://play.google.com/store/apps/details?id=com.google.vr.vrcore&hl=en) and install an experimental build of Chromium with webVR support by following the instructions [here](https://github.com/Web-VR/iswebvrready/wiki/Instructions%3A-Chromium), then when you enter VR mode, the built-in Google VR API will then take over, so Google Daydream devices / all cardboard devices will be supported.

If you are using iOS, I have no idea when or whether Apple will ever implement the WebVR API in Safari, because Apple.

### For desktop computers

You can use the mouse to rotate the camera.

Alternatively, you can use the [WebVR emulator Chrome extension](https://chrome.google.com/webstore/detail/webvr-api-emulation/gbdnpaebafagioggnhkacnaaahpiefil) to emulate a VR device.

In theory it would work for HTC Vive / Oculus Rift but I have no way to verify.

## Details

### Libraries/API used

* [THREE.js](https://threejs.org/) which gives a good abstraction over the WebGL api while remaining quite flexible.

* [WebVR](https://developer.mozilla.org/en-US/docs/Web/API/WebVR_API) provided via the [webvr-polyfill](https://github.com/googlevr/webvr-polyfill), which also included the screen distortion logic for Google Cardboard devices.

### Scene

* The tree / fox / rock meshes are obtained from http://opengameart.org/.

* Art style inspired by [Google Daydream](https://vr.google.com/daydream/) UI and [low poly art style](https://www.reddit.com/r/low_poly/).
